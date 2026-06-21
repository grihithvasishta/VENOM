import { VenomTask } from '../../shared/types';
import { VenomCoordinator } from '../coordinator/VenomCoordinator';

export class VenomRecovery {
    constructor(private coordinator: VenomCoordinator) {}

    async attemptRecovery(task: VenomTask, agentName: string, errorFeedback: string, contextString: string = ''): Promise<string> {
        const prompt = `The previous attempt failed with this error: ${errorFeedback}\nTask was: ${task.description}\nPlease try to fix it and provide the result.`;
        return await this.coordinator.coordinateTask(task.id, agentName, prompt, contextString);
    }
}
