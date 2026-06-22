import test from 'node:test';
import assert from 'node:assert';
import { MockVenomProviderManager } from './mocks';
import { VenomAgentRegistry } from '../agents/VenomAgentRegistry';
import { RouterWorker } from '../../orchestration/workers/RouterWorker';
import { PlannerWorker } from '../../orchestration/workers/PlannerWorker';
import { ValidatorWorker } from '../../orchestration/workers/ValidatorWorker';
import { VenomTelemetry } from '../../orchestration/telemetry/VenomTelemetry';
import { AgentMode } from '../shared/types';

test('RouterWorker Tests', async (t) => {
    const mockProvider = new MockVenomProviderManager();
    const registry = new VenomAgentRegistry(mockProvider);
    const telemetry = new VenomTelemetry();
    const router = new RouterWorker(registry, telemetry);
    
    // Explicit modes should bypass LLM
    assert.strictEqual(await router.route('Hello', AgentMode.NORMAL), 'DIRECT'); // Fallback to DIRECT if LLM fails/mock
    assert.strictEqual(await router.route('Hello', AgentMode.FABLEFOFF), 'DIRECT');
    assert.strictEqual(await router.route('Hello', AgentMode.FABLE5), 'AGENT');
    assert.strictEqual(await router.route('Hello', AgentMode.WRITE), 'WRITE');
});

test('PlannerWorker Tests', async (t) => {
    const mockProvider = new MockVenomProviderManager();
    const registry = new VenomAgentRegistry(mockProvider);
    const telemetry = new VenomTelemetry();
    const planner = new PlannerWorker(registry, telemetry);
    
    // Using mock fallback
    const plan = await planner.createPlan('Decompose this task', '');
    assert.strictEqual(plan.steps.length > 0, true);
});

test('ValidatorWorker Tests', async (t) => {
    const mockProvider = new MockVenomProviderManager();
    const registry = new VenomAgentRegistry(mockProvider);
    const telemetry = new VenomTelemetry();
    const validator = new ValidatorWorker(registry, telemetry);
    
    const validRes = await validator.validate(
        { stepId: '1', agentType: 'MainAgent', output: 'good code', success: true, durationMs: 100, toolResults: [] },
        'Validate the following result'
    );
    assert.strictEqual(validRes.isValid, true);
});
