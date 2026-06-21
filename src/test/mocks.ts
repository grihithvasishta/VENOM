import { VenomProviderManager } from '../providers/VenomProviderManager';
import { ProviderValidationResult } from '../shared/types';

export class MockVenomProviderManager extends VenomProviderManager {
    constructor() {
        super();
    }

    async validateProviders(): Promise<ProviderValidationResult[]> {
        return [
            { provider: 'Groq', isValid: true },
            { provider: 'OpenRouter', isValid: true },
            { provider: 'NVIDIA NIM', isValid: true },
        ];
    }

    async generateGroqCompletion(model: string, messages: any[]): Promise<string> {
        const lastMessage = messages[messages.length - 1].content;
        
        if (lastMessage.includes('Route the following task')) {
            return 'CodingAgent';
        }

        if (lastMessage.includes('Validate the following result')) {
            if (lastMessage.includes('fail')) return 'INVALID: Intentional failure';
            return 'VALID';
        }

        if (lastMessage.includes('Assemble these steps')) {
            return 'Assembled: ' + messages[messages.length - 1].content;
        }

        return `Mock Groq response to: ${lastMessage}`;
    }

    async generateOpenRouterCompletion(model: string, messages: any[]): Promise<string> {
        const lastMessage = messages[messages.length - 1].content;
        
        if (lastMessage.includes('Decompose this task')) {
            return 'Step 1: Do A\nStep 2: Do B';
        }
        
        return `Mock OpenRouter response to: ${lastMessage}`;
    }

    async generateNimCompletion(model: string, messages: any[]): Promise<string> {
        const lastMessage = messages[messages.length - 1].content;
        
        if (lastMessage.includes('write file tool test')) {
            return 'TOOL_CALL: {"action": "write_file", "filepath": "test.txt", "content": "hello"}';
        }
        if (lastMessage.includes('run command tool test')) {
             return 'TOOL_CALL: {"action": "run_command", "command": "echo test"}';
        }
        if (lastMessage.includes('malformed tool')) {
             return 'TOOL_CALL: {"action": "write_file", filepath: "broken}'; // Intentional bad JSON
        }

        return `Mock NIM response to: ${lastMessage}`;
    }
}
