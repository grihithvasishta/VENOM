import { VenomToolCall } from '../../shared/types';

export interface ParsedToolCalls {
    calls: VenomToolCall[];
    errors: string[];
}

export class VenomToolCallParser {
    parse(response: string): ParsedToolCalls {
        const calls: VenomToolCall[] = [];
        const errors: string[] = [];
        let searchIndex = 0;

        while (searchIndex < response.length) {
            const markerIndex = response.indexOf('TOOL_CALL:', searchIndex);
            if (markerIndex === -1) break;

            const jsonStart = response.indexOf('{', markerIndex);
            if (jsonStart === -1) {
                errors.push('TOOL_CALL marker found without a JSON object.');
                break;
            }

            const jsonEnd = this.findJsonObjectEnd(response, jsonStart);
            if (jsonEnd === -1) {
                errors.push('TOOL_CALL JSON object is incomplete.');
                break;
            }

            const jsonText = response.slice(jsonStart, jsonEnd + 1);
            try {
                const parsed = JSON.parse(jsonText);
                calls.push(this.validate(parsed));
            } catch (error: any) {
                errors.push(`Invalid TOOL_CALL: ${error.message}`);
            }

            searchIndex = jsonEnd + 1;
        }

        return { calls, errors };
    }

    private findJsonObjectEnd(text: string, start: number): number {
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < text.length; i++) {
            const char = text[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (inString && char === '\\') {
                escaped = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (char === '{') depth++;
            if (char === '}') depth--;
            if (depth === 0) return i;
        }

        return -1;
    }

    private validate(value: any): VenomToolCall {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new Error('Tool call must be a JSON object.');
        }

        if (value.action === 'write_file') {
            this.requireString(value.filepath, 'filepath');
            this.requireString(value.content, 'content');
            return { action: 'write_file', filepath: value.filepath, content: value.content };
        }

        if (value.action === 'run_command') {
            this.requireString(value.command, 'command');
            return { action: 'run_command', command: value.command };
        }

        if (value.action === 'navigate_browser') {
            this.requireString(value.url, 'url');
            return { action: 'navigate_browser', url: value.url };
        }

        if (value.action === 'extract_browser_text') {
            return { action: 'extract_browser_text' };
        }

        throw new Error(`Unsupported tool action: ${String(value.action)}`);
    }

    private requireString(value: unknown, fieldName: string) {
        if (typeof value !== 'string' || value.length === 0) {
            throw new Error(`Tool call field "${fieldName}" must be a non-empty string.`);
        }
    }
}
