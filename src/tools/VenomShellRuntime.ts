import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface VenomShellRuntimeOptions {
    workspaceRoot?: string;
    commandTimeoutMs?: number;
    maxBufferBytes?: number;
}

export class VenomShellRuntime {
    private workspaceRoot: string;
    private commandTimeoutMs: number;
    private maxBufferBytes: number;

    constructor(options: string | VenomShellRuntimeOptions = {}) {
        const resolvedOptions = typeof options === 'string' ? { workspaceRoot: options } : options;
        this.workspaceRoot = path.resolve(resolvedOptions.workspaceRoot ?? process.cwd());
        this.commandTimeoutMs = resolvedOptions.commandTimeoutMs ?? 30000;
        this.maxBufferBytes = resolvedOptions.maxBufferBytes ?? 1024 * 1024 * 10;
    }

    private resolveWithinWorkspace(filePath: string): string {
        const fullPath = path.resolve(this.workspaceRoot, filePath);
        const relativePath = path.relative(this.workspaceRoot, fullPath);

        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            throw new Error(`Path escapes workspace: ${filePath}`);
        }

        return fullPath;
    }

    executeCommand(command: string): Promise<string> {
        this.assertCommandAllowed(command);

        return new Promise((resolve, reject) => {
            exec(command, {
                cwd: this.workspaceRoot,
                timeout: this.commandTimeoutMs,
                maxBuffer: this.maxBufferBytes
            }, (error, stdout, stderr) => {
                if (error) {
                    reject(`Error: ${error.message}\nStderr: ${stderr}`);
                    return;
                }
                resolve(stdout);
            });
        });
    }

    readFile(filePath: string): string {
        return fs.readFileSync(this.resolveWithinWorkspace(filePath), 'utf-8');
    }

    writeFile(filePath: string, content: string): void {
        const fullPath = this.resolveWithinWorkspace(filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf-8');
    }

    listFiles(dirPath: string = '.'): string[] {
        return fs.readdirSync(this.resolveWithinWorkspace(dirPath));
    }

    private assertCommandAllowed(command: string) {
        const trimmedCommand = command.trim();
        if (!trimmedCommand) {
            throw new Error('Cannot execute an empty command.');
        }

        if (trimmedCommand.length > 4000) {
            throw new Error('Command is too long to execute safely.');
        }

        if (/[\u0000-\u001f]/.test(trimmedCommand)) {
            throw new Error('Command contains unsupported control characters.');
        }

        const blockedPatterns = [
            /\brm\s+-rf\b/i,
            /\bdel\s+\/[sq]\b/i,
            /\brmdir\s+\/[sq]\b/i,
            /\bRemove-Item\b.*-(Recurse|Force)\b/i,
            /\bgit\s+reset\s+--hard\b/i,
            /\bformat\b/i,
            /\bshutdown\b/i,
            /\breg\s+delete\b/i
        ];

        if (blockedPatterns.some(pattern => pattern.test(trimmedCommand))) {
            throw new Error('Command blocked by VENOM safety policy.');
        }
    }
}
