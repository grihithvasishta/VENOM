import { VenomAgentRegistry } from '../../agents/VenomAgentRegistry';
import { AgentMode } from '../../shared/types';

export class VenomRouter {
    constructor(private registry: VenomAgentRegistry) {}

    async route(input: string, mode: AgentMode | string): Promise<string> {
        // Based on the task, determine complexity (mocked logic for brevity)
        if (mode === AgentMode.FABLEFOFF || mode === AgentMode.NORMAL) {
            return 'MainAgent';
        }
        
        // In FABLE5, tasks might need Planning and execution
        const mainAgent = this.registry.getAgent('MainAgent');
        if (mainAgent) {
             const decision = await mainAgent.execute(
                 `Route the following task to either PlanningAgent, CodingAgent, or MultiPurposeAgent. Only output the agent name.\nTask: ${input}`
             );
             const routedAgent = decision.trim().match(/\b(PlanningAgent|CodingAgent|MultiPurposeAgent)\b/)?.[1];
             if (routedAgent) {
                 return routedAgent;
             }
        }
        
        return 'MainAgent';
    }
}
