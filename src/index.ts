// ─── Core types ───────────────────────────────────────────────────────────────
export * from './shared/types';

// ─── Config ───────────────────────────────────────────────────────────────────
export * from './config/VenomSettings';

// ─── Providers ────────────────────────────────────────────────────────────────
export * from './providers/VenomProviderManager';

// ─── Agents ───────────────────────────────────────────────────────────────────
export * from './agents/VenomAgentRegistry';

// ─── Memory ───────────────────────────────────────────────────────────────────
export * from './memory/VenomWorkingMemory';
export * from './memory/VenomProjectMemory';
export * from './memory/VenomLearningMemory';
export * from './memory/VenomKnowledgeGraph';

// ─── Tools / Runtime ─────────────────────────────────────────────────────────
export * from './tools/VenomShellRuntime';
export * from './browser/VenomBrowserRuntime';

// ─── Telegram ─────────────────────────────────────────────────────────────────
export * from './telegram/VenomTelegramGateway';

// ─── Orchestration (root-level package — NOT in src/) ────────────────────────
export {
  VenomOrchestrator,
  createVenomOrchestrator,
  VenomTelemetry,
  VenomMemorySync,
  RouterWorker,
  PlannerWorker,
  ExecutorWorker,
  ValidatorWorker,
  AssemblerWorker,
  WriterWorker,
} from '../orchestration';
export type {
  CreateVenomOrchestratorOptions,
  PipelineType,
  WriterTopic,
  AgentType,
  VenomPlan,
  VenomPlanStep,
  VenomStepResult,
  ToolExecutionResult,
  ValidationResult,
  AssemblyResult,
  VenomTelemetryEvent,
} from '../orchestration';
