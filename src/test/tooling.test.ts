import test from 'node:test';
import assert from 'node:assert';
import { VenomShellRuntime } from '../tools/VenomShellRuntime';

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
