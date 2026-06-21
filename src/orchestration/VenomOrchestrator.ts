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

    async execute(input: string, mode: AgentMode): Promise<string> {
        this.memorySync.syncWorkingContext('user', input);
        const contextStr = this.buildContextString();

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
