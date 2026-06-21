import { VenomProviderManager } from '../providers/VenomProviderManager';
import { VenomMessage } from '../shared/types';

export interface VenomAgent {
    name: string;
    description: string;
    execute(prompt: string, context?: VenomMessage[]): Promise<string>;
}

export class MainAgent implements VenomAgent {
    name = 'MainAgent';
    description = 'Normal conversation, routing decisions, tool invocation (NVIDIA NIM Llama 3.1 8B)';
    constructor(private providerManager: VenomProviderManager) {}
    
    async execute(prompt: string, context: VenomMessage[] = []): Promise<string> {
        const systemMessage: VenomMessage = { 
            role: 'system', 
            content: "You are VENOM, an advanced, highly intelligent AI operating system. Be concise, direct, and sharp. Never use generic assistant boilerplate like 'I can assist you with...' or 'It seems like...'. Just answer the user." 
        };
        const messages = [systemMessage, ...context, { role: 'user', content: prompt }];
        return this.providerManager.generateNimMainCompletion(process.env.VENOM_MAIN_MODEL ?? 'meta/llama-3.1-8b-instruct', messages);
    }
}

export class PlanningAgent implements VenomAgent {
    name = 'PlanningAgent';
    description = 'Planning, architecture, task decomposition (OpenRouter Nemotron Ultra)';
    constructor(private providerManager: VenomProviderManager) {}

    async execute(prompt: string, context: VenomMessage[] = []): Promise<string> {
        const messages = [...context, { role: 'user', content: prompt }];
        return this.providerManager.generateOpenRouterCompletion(process.env.VENOM_PLANNING_MODEL ?? 'nvidia/nemotron-4-340b-instruct', messages);
    }
}

export class CodingAgent implements VenomAgent {
    name = 'CodingAgent';
    description = 'Code generation, refactoring, bug fixing (OpenRouter Kimi K2.6)';
    constructor(private providerManager: VenomProviderManager) {}

    async execute(prompt: string, context: VenomMessage[] = []): Promise<string> {
        const systemMessage: VenomMessage = { 
            role: 'system', 
            content: "You are an expert senior software engineer. Your primary objective is to write robust, fully functional, and production-ready code that solves the user's problem." 
        };
        const messages = [systemMessage, ...context, { role: 'user', content: prompt }];
        return this.providerManager.generateOpenRouterCompletion(process.env.VENOM_CODING_MODEL ?? 'moonshotai/moonshot-v1-8k', messages);
    }
}

export class MultiPurposeAgent implements VenomAgent {
    name = 'MultiPurposeAgent';
    description = 'Mixed tasks, validation, research (Groq Llama 70B)';
    constructor(private providerManager: VenomProviderManager) {}

    async execute(prompt: string, context: VenomMessage[] = []): Promise<string> {
        const messages = [...context, { role: 'user', content: prompt }];
        return this.providerManager.generateGroqCompletion(process.env.VENOM_MULTIPURPOSE_MODEL ?? 'llama-3.1-70b-instruct', messages);
    }
}

export class VenomAgentRegistry {
    private agents: Map<string, VenomAgent> = new Map();

    constructor(providerManager: VenomProviderManager) {
        this.registerAgent(new MainAgent(providerManager));
        this.registerAgent(new PlanningAgent(providerManager));
        this.registerAgent(new CodingAgent(providerManager));
        this.registerAgent(new MultiPurposeAgent(providerManager));
    }

    private registerAgent(agent: VenomAgent) {
        this.agents.set(agent.name, agent);
    }

    getAgent(name: string): VenomAgent | undefined {
        return this.agents.get(name);
    }
}
