import { VenomTask } from '../../shared/types';

export class VenomScheduler {
    private queue: VenomTask[] = [];

    schedule(task: VenomTask) {
        this.queue.push(task);
    }

    getNextTask(): VenomTask | undefined {
        return this.queue.find(t => t.status === 'pending');
    }

    updateStatus(taskId: string, status: VenomTask['status'], result?: string, error?: string) {
        const task = this.queue.find(t => t.id === taskId);
        if (task) {
            task.status = status;
            task.result = result;
            task.error = error;
        }
    }

    getPendingTasks(): VenomTask[] {
        return this.queue.filter(t => t.status === 'pending');
    }
}
