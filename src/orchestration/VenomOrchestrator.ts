import { VenomAgentRegistry } from '../agents/VenomAgentRegistry';
import { VenomRouter } from './router/VenomRouter';
import { VenomPlanner } from './planner/VenomPlanner';
import { VenomScheduler } from './scheduler/VenomScheduler';
import { VenomCoordinator } from './coordinator/VenomCoordinator';
import { VenomValidator } from './validator/VenomValidator';
import { VenomExecutionEngine } from './execution/VenomExecutionEngine';
import { VenomRecovery } from './recovery/VenomRecovery';
import { VenomTelemetry } from './telemetry/VenomTelemetry';
import { VenomMemorySync } from './memory-sync/VenomMemorySync';
import { VenomProjectMemory } from '../memory/VenomProjectMemory';
import { VenomLearningMemory } from '../memory/VenomLearningMemory';
import { VenomKnowledgeGraph } from '../memory/VenomKnowledgeGraph';
import { VenomTask, AgentMode, VenomMessage } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export class VenomOrchestrator {
    public telemetry: VenomTelemetry;
    
    constructor(
        private registry: VenomAgentRegistry,
        private router: VenomRouter,
        private planner: VenomPlanner,
        private scheduler: VenomScheduler,
        private coordinator: VenomCoordinator,
        private validator: VenomValidator,
        private executionEngine: VenomExecutionEngine,
        private recovery: VenomRecovery,
        private memorySync: VenomMemorySync,
        private projectMemory: VenomProjectMemory,
        private learningMemory: VenomLearningMemory,
        private knowledgeGraph: VenomKnowledgeGraph
    ) {
        this.telemetry = new VenomTelemetry();
    }

    private buildContextString(): string {
        const learned = this.learningMemory.getPatterns('system_preference').join('\n');
        return `[System Memory Context]\nLearned Preferences:\n${learned}\n`;
    }

    private async classifyWriterTopic(input: string): Promise<'ARTICLE' | 'MARKETING' | 'CONVERSATIONAL' | 'ESSAY_FORMAL'> {
        const mainAgent = this.registry.getAgent('MainAgent');
        if (!mainAgent) return 'ARTICLE';
        const prompt = `Classify the following writing request into exactly one category. Output ONLY the category name and nothing else.
Categories: ARTICLE, MARKETING, CONVERSATIONAL, ESSAY_FORMAL
Request: "${input}"`;
        const response = await mainAgent.execute(prompt, [{role: 'system', content: 'You are a precise classifier.'}]);
        const cleaned = response.trim().toUpperCase();
        if (cleaned.includes('MARKETING')) return 'MARKETING';
        if (cleaned.includes('CONVERSATIONAL')) return 'CONVERSATIONAL';
        if (cleaned.includes('ESSAY_FORMAL')) return 'ESSAY_FORMAL';
        return 'ARTICLE';
    }

    private getRandomJsonlExamples(filename: string, count: number): string {
        const filepath = path.join(process.cwd(), 'writing-assistant', filename);
        if (!fs.existsSync(filepath)) return '';
        try {
            const lines = fs.readFileSync(filepath, 'utf8').split('\n').filter(l => l.trim().length > 0);
            if (lines.length === 0) return '';
            const shuffled = lines.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, count);
            return selected.map((line, i) => {
                const parsed = JSON.parse(line);
                return `Example ${i + 1} (${parsed.topic}):\n${parsed.output}\n`;
            }).join('\n');
        } catch (e) {
            return '';
        }
    }

    async execute(input: string, mode: AgentMode): Promise<string> {
        this.memorySync.syncWorkingContext('user', input);
        const contextStr = this.buildContextString();

        if (mode === AgentMode.WRITE) {
            this.telemetry.logStage('Router', 'Write mode active. Classifying topic...');
            const topic = await this.classifyWriterTopic(input);
            this.telemetry.logStage('Router', `Topic classified as: ${topic}`);

            const writeAgent = this.registry.getAgent('MultiPurposeAgent');
            if (!writeAgent) throw new Error('MultiPurposeAgent not found');
            
            const promptPath = path.join(process.cwd(), 'writing-assistant', 'writer_prompt.md');
            let writerPromptStr = 'You are an expert writer.';
            if (fs.existsSync(promptPath)) {
                writerPromptStr = fs.readFileSync(promptPath, 'utf8');
            }
            
            let exampleFile = '';
            let voiceTarget = '';
            switch(topic) {
                case 'ARTICLE': 
                    exampleFile = 'examples_article.jsonl'; 
                    voiceTarget = 'Voice Target (ARTICLE): confident, concrete, leads with the real point, no throat-clearing';
                    break;
                case 'MARKETING': 
                    exampleFile = 'examples_marketing.jsonl'; 
                    voiceTarget = 'Voice Target (MARKETING): persuasive but specific, sells the real benefit not vague adjectives';
                    break;
                case 'CONVERSATIONAL': 
                    exampleFile = 'examples_conversational.jsonl'; 
                    voiceTarget = 'Voice Target (CONVERSATIONAL): short, plain, sounds like a real person typed it quickly';
                    break;
                case 'ESSAY_FORMAL': 
                    exampleFile = 'examples_essays.jsonl'; 
                    voiceTarget = 'Voice Target (ESSAY_FORMAL): a clear thesis or clear opening scene, structured paragraphs, no filler conclusion';
                    break;
            }

            const examplesStr = this.getRandomJsonlExamples(exampleFile, 3);
            if (examplesStr) {
                writerPromptStr += `\n\n### CATEGORY TARGET:\n${voiceTarget}\n\n### FEW-SHOT EXAMPLES:\n${examplesStr}\n`;
            }

            const contextMsg: VenomMessage = { role: 'system', content: writerPromptStr };
            const result = await writeAgent.execute(input, [contextMsg]);
            this.memorySync.syncWorkingContext('assistant', result);
            return result;
        }

        if (mode === AgentMode.FABLEFOFF || mode === AgentMode.NORMAL) {
            this.telemetry.logStage('Router', 'Direct mode active. Bypassing orchestration.');
            const mainAgent = this.registry.getAgent('MainAgent');
            if (!mainAgent) throw new Error('MainAgent not found');
            const contextMsg: VenomMessage = { role: 'system', content: contextStr };
            const result = await mainAgent.execute(input, [contextMsg]);
            this.memorySync.syncWorkingContext('assistant', result);
            return result;
        }

        // FABLE5 Mode Execution Flow
        this.telemetry.logStage('Router', 'Task classified for FABLE5 mode.');

        this.telemetry.logStage('Planner', 'Execution plan generated.');
        const plan = await this.planner.createPlan(input);

        let finalResult = '';

        for (const step of plan) {
            const task: VenomTask = { id: uuidv4(), description: step, status: 'pending' };
            this.scheduler.schedule(task);
            
            // Dynamically route EACH step
            const stepAgent = await this.router.route(step, mode);
            
            this.telemetry.logStage('Coordinator', `Dispatching to ${stepAgent}: ${step}`);
            let stepResult = await this.coordinator.coordinateTask(task.id, stepAgent, step, contextStr);

            this.telemetry.logStage('Validator', 'Verifying execution.');
            const validation = await this.validator.validate(stepResult, step);

            if (!validation.isValid) {
                this.telemetry.logStage('Recovery', `Validation failed: ${validation.feedback}. Attempting recovery.`);
                const recoveryTask: VenomTask = {
                    id: `${task.id}-recovery`,
                    description: step,
                    status: 'pending'
                };
                this.scheduler.schedule(recoveryTask);
                stepResult = await this.recovery.attemptRecovery(
                    recoveryTask,
                    stepAgent,
                    validation.feedback || 'Unknown error',
                    contextStr
                );
            }
            
            finalResult += stepResult + '\n';
        }

        this.telemetry.logStage('Assembler', 'Final response generated.');
        
        // Let MainAgent assemble the final response from all step results
        const mainAgent = this.registry.getAgent('MainAgent');
        if (!mainAgent) throw new Error('MainAgent not found');
        const finalAssemblerResponse = await mainAgent.execute(`Assemble these steps into a final cohesive response:\n${finalResult}`);
        
        this.memorySync.syncWorkingContext('assistant', finalAssemblerResponse);
        return finalAssemblerResponse;
    }
}
