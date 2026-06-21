import { VenomAgentRegistry } from '../../agents/VenomAgentRegistry';
import { VenomScheduler } from '../scheduler/VenomScheduler';
import { VenomExecutionEngine } from '../execution/VenomExecutionEngine';
import { VenomToolCallParser } from '../tools/VenomToolCallParser';

export class VenomCoordinator {
    private toolCallParser = new VenomToolCallParser();

    constructor(
        private registry: VenomAgentRegistry,
        private scheduler: VenomScheduler,
        private executionEngine: VenomExecutionEngine
    ) {}

    async coordinateTask(taskId: string, targetAgent: string, taskDesc: string, contextString: string = ''): Promise<string> {
        const agent = this.registry.getAgent(targetAgent);
        if (!agent) throw new Error(`Agent ${targetAgent} not found`);

        this.scheduler.updateStatus(taskId, 'running');
        try {
            // Append tool execution instructions to the task description
            const toolInstructions = `
If you need to perform an action on the local machine or browser, output exactly one of the following JSON blocks anywhere in your response, starting with "TOOL_CALL:":
- TOOL_CALL: {"action": "write_file", "filepath": "path/to/file", "content": "..."}
- TOOL_CALL: {"action": "run_command", "command": "..."}
- TOOL_CALL: {"action": "navigate_browser", "url": "..."}
- TOOL_CALL: {"action": "extract_browser_text"}
Use a tool call only when it is required to complete the task.
`;
            
            const fullPrompt = `${contextString}\n\nTask: ${taskDesc}\n\n${toolInstructions}`;
            let result = await agent.execute(fullPrompt);
            
            const parsedToolCalls = this.toolCallParser.parse(result);
            if (parsedToolCalls.errors.length > 0) {
                result += `\n\n[Tool Parse Errors]:\n${parsedToolCalls.errors.join('\n')}`;
            }

            const maxToolCalls = this.executionEngine.getMaxToolCallsPerStep();
            const toolCalls = parsedToolCalls.calls.slice(0, maxToolCalls);
            if (parsedToolCalls.calls.length > maxToolCalls) {
                result += `\n\n[Tool Execution Notice]:\nSkipped ${parsedToolCalls.calls.length - maxToolCalls} tool call(s) because the per-step limit is ${maxToolCalls}.`;
            }

            for (const toolCall of toolCalls) {
                const toolResult = await this.executionEngine.executeToolCall(toolCall);
                const status = toolResult.success ? 'Result' : 'Failed';
                result += `\n\n[Tool Execution ${status}]:\n${toolResult.output}`;
            }

            this.scheduler.updateStatus(taskId, 'completed', result);
            return result;
        } catch (error: any) {
            this.scheduler.updateStatus(taskId, 'failed', undefined, error.message);
            throw error;
        }
    }
}
