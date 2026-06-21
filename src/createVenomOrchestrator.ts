import { VenomProviderManager } from './providers/VenomProviderManager';
import { VenomAgentRegistry } from './agents/VenomAgentRegistry';
import { VenomRouter } from './orchestration/router/VenomRouter';
import { VenomPlanner } from './orchestration/planner/VenomPlanner';
import { VenomScheduler } from './orchestration/scheduler/VenomScheduler';
import { VenomCoordinator } from './orchestration/coordinator/VenomCoordinator';
import { VenomValidator } from './orchestration/validator/VenomValidator';
import { VenomExecutionEngine } from './orchestration/execution/VenomExecutionEngine';
import { VenomRecovery } from './orchestration/recovery/VenomRecovery';
import { VenomMemorySync } from './orchestration/memory-sync/VenomMemorySync';
import { VenomWorkingMemory } from './memory/VenomWorkingMemory';
import { VenomProjectMemory } from './memory/VenomProjectMemory';
import { VenomLearningMemory } from './memory/VenomLearningMemory';
import { VenomKnowledgeGraph } from './memory/VenomKnowledgeGraph';
import { VenomShellRuntime } from './tools/VenomShellRuntime';
import { VenomBrowserRuntime } from './browser/VenomBrowserRuntime';
import { VenomOrchestrator } from './orchestration/VenomOrchestrator';
import { VenomToolExecutionPolicy } from './shared/types';

export interface CreateVenomOrchestratorOptions {
    workspaceRoot?: string;
    providerManager?: VenomProviderManager;
    shellRuntime?: VenomShellRuntime;
    browserRuntime?: VenomBrowserRuntime;
    executionPolicy?: Partial<VenomToolExecutionPolicy>;
    workingMemory?: VenomWorkingMemory;
    projectMemory?: VenomProjectMemory;
    learningMemory?: VenomLearningMemory;
    knowledgeGraph?: VenomKnowledgeGraph;
}

export function createVenomOrchestrator(options: CreateVenomOrchestratorOptions = {}): VenomOrchestrator {
    const providerManager = options.providerManager ?? new VenomProviderManager();
    const registry = new VenomAgentRegistry(providerManager);

    const router = new VenomRouter(registry);
    const planner = new VenomPlanner(registry);
    const scheduler = new VenomScheduler();
    const shellRuntime = options.shellRuntime ?? new VenomShellRuntime({ workspaceRoot: options.workspaceRoot });
    const browserRuntime = options.browserRuntime ?? new VenomBrowserRuntime();
    const executionEngine = new VenomExecutionEngine(shellRuntime, browserRuntime, options.executionPolicy);
    const coordinator = new VenomCoordinator(registry, scheduler, executionEngine);
    const validator = new VenomValidator(registry);
    const recovery = new VenomRecovery(coordinator);

    const workingMemory = options.workingMemory ?? new VenomWorkingMemory();
    const projectMemory = options.projectMemory ?? new VenomProjectMemory();
    const learningMemory = options.learningMemory ?? new VenomLearningMemory();
    const knowledgeGraph = options.knowledgeGraph ?? new VenomKnowledgeGraph();
    const memorySync = new VenomMemorySync(workingMemory, projectMemory, learningMemory, knowledgeGraph);

    return new VenomOrchestrator(
        registry,
        router,
        planner,
        scheduler,
        coordinator,
        validator,
        executionEngine,
        recovery,
        memorySync,
        projectMemory,
        learningMemory,
        knowledgeGraph
    );
}
