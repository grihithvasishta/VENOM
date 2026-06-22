/**
 * createVenomOrchestrator — Factory Function
 * ─────────────────────────────────────────────────────────────────────────────
 * Wires up every dependency and returns a ready-to-use VenomOrchestrator.
 * All 6 subagent workers, 4 memory systems, and both runtimes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { VenomProviderManager } from '../src/providers/VenomProviderManager';
import { VenomAgentRegistry } from '../src/agents/VenomAgentRegistry';
import { VenomWorkingMemory } from '../src/memory/VenomWorkingMemory';
import { VenomLearningMemory } from '../src/memory/VenomLearningMemory';
import { VenomProjectMemory } from '../src/memory/VenomProjectMemory';
import { VenomKnowledgeGraph } from '../src/memory/VenomKnowledgeGraph';
import { VenomShellRuntime } from '../src/tools/VenomShellRuntime';
import { VenomBrowserRuntime } from '../src/browser/VenomBrowserRuntime';

import { VenomMemorySync } from './memory-sync/VenomMemorySync';
import { VenomTelemetry } from './telemetry/VenomTelemetry';
import { VenomOrchestrator } from './VenomOrchestrator';

// Workers
import { RouterWorker } from './workers/RouterWorker';
import { PlannerWorker } from './workers/PlannerWorker';
import { ExecutorWorker } from './workers/ExecutorWorker';
import { ValidatorWorker } from './workers/ValidatorWorker';
import { AssemblerWorker } from './workers/AssemblerWorker';
import { WriterWorker } from './workers/WriterWorker';

export interface CreateVenomOrchestratorOptions {
  workspaceRoot?: string;
  providerManager?: VenomProviderManager;
  workingMemory?: VenomWorkingMemory;
  learningMemory?: VenomLearningMemory;
  projectMemory?: VenomProjectMemory;
  knowledgeGraph?: VenomKnowledgeGraph;
  shellRuntime?: VenomShellRuntime;
  browserRuntime?: VenomBrowserRuntime;
}

export function createVenomOrchestrator(
  options: CreateVenomOrchestratorOptions = {}
): VenomOrchestrator {
  const workspaceRoot = options.workspaceRoot ?? process.cwd();

  // ── Providers ─────────────────────────────────────────────────────────────
  const providerManager = options.providerManager ?? new VenomProviderManager();

  // ── Agent Registry ────────────────────────────────────────────────────────
  const registry = new VenomAgentRegistry(providerManager);

  // ── Memory (all 4 systems) ────────────────────────────────────────────────
  const workingMemory = options.workingMemory ?? new VenomWorkingMemory();
  const learningMemory = options.learningMemory ?? new VenomLearningMemory();
  const projectMemory = options.projectMemory ?? new VenomProjectMemory();
  const knowledgeGraph = options.knowledgeGraph ?? new VenomKnowledgeGraph();
  const memorySync = new VenomMemorySync(workingMemory, learningMemory, projectMemory, knowledgeGraph);

  // ── Runtimes ──────────────────────────────────────────────────────────────
  const shellRuntime = options.shellRuntime ?? new VenomShellRuntime({ workspaceRoot });
  const browserRuntime = options.browserRuntime ?? new VenomBrowserRuntime();

  // ── Telemetry ─────────────────────────────────────────────────────────────
  const telemetry = new VenomTelemetry();

  // ── Workers (all 6 subagents) ─────────────────────────────────────────────
  const routerWorker = new RouterWorker(registry, telemetry);
  const plannerWorker = new PlannerWorker(registry, telemetry);
  const executorWorker = new ExecutorWorker(registry, telemetry, shellRuntime, browserRuntime, memorySync);
  const validatorWorker = new ValidatorWorker(registry, telemetry);
  const assemblerWorker = new AssemblerWorker(registry, telemetry);
  const writerWorker = new WriterWorker(registry, telemetry);

  // ── Orchestrator ──────────────────────────────────────────────────────────
  return new VenomOrchestrator(
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
}
