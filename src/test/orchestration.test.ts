import test from 'node:test';
import assert from 'node:assert';
import { MockVenomProviderManager } from './mocks';
import { VenomAgentRegistry } from '../agents/VenomAgentRegistry';
import { VenomRouter } from '../orchestration/router/VenomRouter';
import { VenomPlanner } from '../orchestration/planner/VenomPlanner';
import { VenomScheduler } from '../orchestration/scheduler/VenomScheduler';
import { VenomValidator } from '../orchestration/validator/VenomValidator';
import { VenomTask } from '../shared/types';

test('VenomRouter Tests', async (t) => {
    const mockProvider = new MockVenomProviderManager();
    const registry = new VenomAgentRegistry(mockProvider);
    const router = new VenomRouter(registry);
    
    // Direct mode should bypass
    assert.strictEqual(await router.route('Hello', 'NORMAL'), 'MainAgent');
    assert.strictEqual(await router.route('Hello', 'FABLEFOFF'), 'MainAgent');
    
    // FABLE5 should use LLM logic (mocked to return CodingAgent)
    const routed = await router.route('Route the following task to test', 'FABLE5');
    assert.strictEqual(routed, 'CodingAgent');
});

test('VenomPlanner Tests', async (t) => {
    const mockProvider = new MockVenomProviderManager();
    const registry = new VenomAgentRegistry(mockProvider);
    const planner = new VenomPlanner(registry);
    
    const plan = await planner.createPlan('Decompose this task');
    assert.strictEqual(plan.length, 2);
    assert.strictEqual(plan[0], 'Step 1: Do A');
    assert.strictEqual(plan[1], 'Step 2: Do B');
});

test('VenomScheduler Tests', (t) => {
    const scheduler = new VenomScheduler();
    const task1: VenomTask = { id: '1', description: 'T1', status: 'pending' };
    const task2: VenomTask = { id: '2', description: 'T2', status: 'pending' };
    
    scheduler.schedule(task1);
    scheduler.schedule(task2);
    
    assert.strictEqual(scheduler.getPendingTasks().length, 2);
    assert.strictEqual(scheduler.getNextTask()?.id, '1');
    
    scheduler.updateStatus('1', 'running');
    assert.strictEqual(scheduler.getNextTask()?.id, '2');
    
    scheduler.updateStatus('1', 'completed', 'Result 1');
    assert.strictEqual(scheduler.getPendingTasks().length, 1);
    
    // Test updating missing task doesn't throw
    scheduler.updateStatus('999', 'failed');
});

test('VenomValidator Tests', async (t) => {
    const mockProvider = new MockVenomProviderManager();
    const registry = new VenomAgentRegistry(mockProvider);
    const validator = new VenomValidator(registry);
    
    const validRes = await validator.validate('good code', 'Validate the following result');
    assert.strictEqual(validRes.isValid, true);
    
    const invalidRes = await validator.validate('bad code fail', 'Validate the following result');
    assert.strictEqual(invalidRes.isValid, false);
    assert.strictEqual(invalidRes.feedback, 'Intentional failure');
});
