import test from 'node:test';
import assert from 'node:assert';
import { MockVenomProviderManager } from './mocks';
import { VenomAgentRegistry } from '../agents/VenomAgentRegistry';
import { VenomWorkingMemory } from '../memory/VenomWorkingMemory';
import { VenomProjectMemory } from '../memory/VenomProjectMemory';
import { VenomLearningMemory } from '../memory/VenomLearningMemory';
import { VenomKnowledgeGraph } from '../memory/VenomKnowledgeGraph';
import { VenomShellRuntime } from '../tools/VenomShellRuntime';
import { VenomBrowserRuntime } from '../browser/VenomBrowserRuntime';
import { VenomOrchestrator } from '../../orchestration/VenomOrchestrator';
import { VenomMemorySync } from '../../orchestration/memory-sync/VenomMemorySync';
import { VenomTelemetry } from '../../orchestration/telemetry/VenomTelemetry';
import { RouterWorker } from '../../orchestration/workers/RouterWorker';
import { PlannerWorker } from '../../orchestration/workers/PlannerWorker';
import { ExecutorWorker } from '../../orchestration/workers/ExecutorWorker';
import { ValidatorWorker } from '../../orchestration/workers/ValidatorWorker';
import { AssemblerWorker } from '../../orchestration/workers/AssemblerWorker';
import { WriterWorker } from '../../orchestration/workers/WriterWorker';
import { AgentMode } from '../shared/types';
import fs from 'fs';
import path from 'path';

test('VenomOrchestrator Integration Test', async (t) => {
    // Setup clean environment
    const testDir = path.join(process.cwd(), 'test_integration');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
    const dbPath = path.join(testDir, 'test.db');
    
    // Build Orchestrator with mock dependencies
    const mockProvider = new MockVenomProviderManager();
    const registry = new VenomAgentRegistry(mockProvider);
    
    class MockShellRuntime extends VenomShellRuntime {
        executeCommand(cmd: string): Promise<string> {
            if (cmd === 'echo test') return Promise.resolve('test output');
            return Promise.resolve('');
        }
    }
    
    const shellRuntime = new MockShellRuntime();
    const browserRuntime = new VenomBrowserRuntime();
    
    const workingMemory = new VenomWorkingMemory(dbPath);
    const projectMemory = new VenomProjectMemory(dbPath);
    const learningMemory = new VenomLearningMemory(dbPath);
    const knowledgeGraph = new VenomKnowledgeGraph(dbPath);
    
    const memorySync = new VenomMemorySync(workingMemory, learningMemory, projectMemory, knowledgeGraph);
    const telemetry = new VenomTelemetry();

    const routerWorker = new RouterWorker(registry, telemetry);
    const plannerWorker = new PlannerWorker(registry, telemetry);
    const executorWorker = new ExecutorWorker(registry, telemetry, shellRuntime, browserRuntime, memorySync);
    const validatorWorker = new ValidatorWorker(registry, telemetry);
    const assemblerWorker = new AssemblerWorker(registry, telemetry);
    const writerWorker = new WriterWorker(registry, telemetry);

    const orchestrator = new VenomOrchestrator(
        registry,
        memorySync,
        telemetry,
        routerWorker,
        plannerWorker,
        executorWorker,
        validatorWorker,
        assemblerWorker,
        writerWorker
    );

    // Test NORMAL Mode
    const normalResponse = await orchestrator.execute('hello', AgentMode.NORMAL);
    assert.strictEqual(normalResponse.includes('Mock Groq response to'), true);

    // Test FABLE5 Mode
    const task = "Decompose this task and run command tool test";
    const fableResponse = await orchestrator.execute(task, AgentMode.FABLE5);
    
    assert.strictEqual(fableResponse.length > 0, true);
    
    // Check Working memory
    const history = workingMemory.getRecentContext();
    assert.strictEqual(history.length >= 4, true); // User normal, Asst normal, User fable, Asst fable
    
    // Clean up
    workingMemory.close();
    projectMemory.close();
    learningMemory.close();
    knowledgeGraph.close();
    fs.unlinkSync(dbPath);
    fs.rmdirSync(testDir);
});
