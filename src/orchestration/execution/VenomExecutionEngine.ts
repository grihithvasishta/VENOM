import { VenomShellRuntime } from '../../tools/VenomShellRuntime';
import { VenomBrowserRuntime } from '../../browser/VenomBrowserRuntime';
import { VenomToolCall, VenomToolExecutionPolicy, VenomToolExecutionResult } from '../../shared/types';

export class VenomExecutionEngine {
    private policy: VenomToolExecutionPolicy;

    constructor(
        private shellRuntime: VenomShellRuntime,
        private browserRuntime: VenomBrowserRuntime,
        policy: Partial<VenomToolExecutionPolicy> = {}
    ) {
        this.policy = {
            allowFileWrites: true,
            allowShellCommands: true,
            allowBrowserNavigation: true,
            maxToolCallsPerStep: 3,
            ...policy
        };
    }

    getMaxToolCallsPerStep(): number {
        return this.policy.maxToolCallsPerStep;
    }

    async executeToolCall(call: VenomToolCall): Promise<VenomToolExecutionResult> {
        try {
            let output = '';

            if (call.action === 'write_file') {
                this.assertAllowed(this.policy.allowFileWrites, 'File writes are disabled by policy.');
                output = await this.executeCode(call.content, call.filepath);
            } else if (call.action === 'run_command') {
                this.assertAllowed(this.policy.allowShellCommands, 'Shell commands are disabled by policy.');
                output = await this.runCommand(call.command);
            } else if (call.action === 'navigate_browser') {
                this.assertAllowed(this.policy.allowBrowserNavigation, 'Browser navigation is disabled by policy.');
                output = await this.navigateBrowser(call.url);
            } else if (call.action === 'extract_browser_text') {
                output = await this.extractBrowserText();
            }

            return { call, success: true, output };
        } catch (error: any) {
            return { call, success: false, output: error.message ?? String(error) };
        }
    }

    async executeCode(code: string, filepath: string): Promise<string> {
        this.shellRuntime.writeFile(filepath, code);
        return `File ${filepath} written successfully.`;
    }

    async runCommand(command: string): Promise<string> {
        return await this.shellRuntime.executeCommand(command);
    }
    
    async navigateBrowser(url: string): Promise<string> {
        await this.browserRuntime.navigate(url);
        return `Browser navigated to ${url}`;
    }
    
    async extractBrowserText(): Promise<string> {
        return await this.browserRuntime.extractText();
    }
    
    async closeBrowser(): Promise<void> {
        await this.browserRuntime.close();
    }

    private assertAllowed(isAllowed: boolean, message: string) {
        if (!isAllowed) {
            throw new Error(message);
        }
    }
}
