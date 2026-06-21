import test from 'node:test';
import assert from 'node:assert';
import { VenomToolCallParser } from '../orchestration/tools/VenomToolCallParser';
import { VenomShellRuntime } from '../tools/VenomShellRuntime';
import { VenomExecutionEngine } from '../orchestration/execution/VenomExecutionEngine';
import { VenomBrowserRuntime } from '../browser/VenomBrowserRuntime';

test('VenomToolCallParser parses JSON content containing braces', () => {
    const parser = new VenomToolCallParser();
    const parsed = parser.parse('TOOL_CALL: {"action":"write_file","filepath":"src/a.ts","content":"export const x = { value: 1 };"}');

    assert.strictEqual(parsed.errors.length, 0);
    assert.strictEqual(parsed.calls.length, 1);
    assert.deepStrictEqual(parsed.calls[0], {
        action: 'write_file',
        filepath: 'src/a.ts',
        content: 'export const x = { value: 1 };'
    });
});

test('VenomToolCallParser reports malformed tool calls', () => {
    const parser = new VenomToolCallParser();
    const parsed = parser.parse('TOOL_CALL: {"action":"run_command","command":');

    assert.strictEqual(parsed.calls.length, 0);
    assert.strictEqual(parsed.errors.length > 0, true);
});

test('VenomShellRuntime blocks filesystem escape attempts', () => {
    const runtime = new VenomShellRuntime({ workspaceRoot: process.cwd() });

    assert.throws(() => {
        runtime.writeFile('../outside.txt', 'nope');
    }, /Path escapes workspace/);
});

test('VenomShellRuntime blocks known destructive commands before execution', () => {
    const runtime = new VenomShellRuntime({ workspaceRoot: process.cwd() });

    assert.throws(() => {
        runtime.executeCommand('rm -rf .');
    }, /safety policy/);
});

test('VenomExecutionEngine honors disabled shell-command policy', async () => {
    const runtime = new VenomShellRuntime({ workspaceRoot: process.cwd() });
    const engine = new VenomExecutionEngine(runtime, new VenomBrowserRuntime(), {
        allowShellCommands: false
    });

    const result = await engine.executeToolCall({ action: 'run_command', command: 'echo hello' });

    assert.strictEqual(result.success, false);
    assert.match(result.output, /Shell commands are disabled/);
});
