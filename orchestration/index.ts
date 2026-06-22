/**
 * orchestration/index.ts — Public API Barrel
 * Re-exports everything callers need from the orchestration layer.
 */

// Core
export { VenomOrchestrator } from './VenomOrchestrator';
export { createVenomOrchestrator } from './createVenomOrchestrator';
export type { CreateVenomOrchestratorOptions } from './createVenomOrchestrator';

// Workers
export { RouterWorker } from './workers/RouterWorker';
export type { PipelineType } from './workers/RouterWorker';
export { PlannerWorker } from './workers/PlannerWorker';
export { ExecutorWorker } from './workers/ExecutorWorker';
export { ValidatorWorker } from './workers/ValidatorWorker';
export { AssemblerWorker } from './workers/AssemblerWorker';
export { WriterWorker } from './workers/WriterWorker';
export type { WriterTopic } from './workers/WriterWorker';

// Support
export { VenomTelemetry } from './telemetry/VenomTelemetry';
export type { VenomTelemetryEvent } from './telemetry/VenomTelemetry';
export { VenomMemorySync } from './memory-sync/VenomMemorySync';

// Types
export type {
  AgentType,
  VenomPlan,
  VenomPlanStep,
  VenomStepResult,
  ToolExecutionResult,
  ValidationResult,
  AssemblyResult,
} from './types/orchestrationTypes';
