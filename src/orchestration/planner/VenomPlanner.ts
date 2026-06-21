import { VenomAgentRegistry } from '../../agents/VenomAgentRegistry';

export class VenomPlanner {
    constructor(private registry: VenomAgentRegistry) {}

    async createPlan(input: string): Promise<string[]> {
        const planner = this.registry.getAgent('PlanningAgent');
        if (!planner) throw new Error('PlanningAgent not found');

        const planText = await planner.execute(`Decompose this task into a step-by-step plan. Return each step on a new line. Do not include markdown fences or commentary.\nTask: ${input}`);
        const steps = planText
            .split('\n')
            .map(step => step.trim())
            .map(step => step.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '').trim())
            .filter(step => step.length > 0)
            .filter(step => !step.startsWith('```'))
            .slice(0, 10);

        return steps.length > 0 ? steps : [input];
    }
}
