import test from 'node:test';
import assert from 'node:assert';
import { VenomOrchestrator } from '../../orchestration/VenomOrchestrator';

test('Sanity check: Environment configuration and imports', (t) => {
    assert.strictEqual(typeof VenomOrchestrator, 'function', 'VenomOrchestrator should be exportable');
});
