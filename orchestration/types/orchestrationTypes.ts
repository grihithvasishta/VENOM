/**
 * VENOM Orchestration Types
 * ─────────────────────────────────────────────────────────────────────────────
 * Strongly-typed interfaces for the subagent worker pipeline.
 * Imported by every worker, the orchestrator, and the factory.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Every registered agent name in the VENOM registry. */
export type AgentType =
  | 'MainAgent'
  | 'PlanningAgent'
  | 'CodingAgent'
  | 'MultiPurposeAgent';

/** A single decomposed step produced by the PlannerWorker. */
export interface VenomPlanStep {
  /** Unique step identifier, e.g. "step-1" */
  id: string;
  /** Human-readable, self-contained description of what to do */
  description: string;
  /** Which registered agent should handle this step */
  agentType: AgentType;
  /**
   * Execution priority group.
   * Steps sharing the same priority run concurrently (Promise.all).
   * Lower number = executed first.
   */
  priority: number;
}

/** Structured execution plan returned by PlannerWorker. */
export interface VenomPlan {
  steps: VenomPlanStep[];
}

/** Result produced by ExecutorWorker after running one plan step. */
export interface VenomStepResult {
  /** Matches VenomPlanStep.id */
  stepId: string;
  /** Which agent handled this step */
  agentType: AgentType;
  /** Raw output text from the agent */
  output: string;
  /** Whether the step completed without an unrecoverable error */
  success: boolean;
  /** Execution wall-clock time in milliseconds */
  durationMs: number;
  /** Present only when success === false */
  error?: string;
  /** Tool calls that were executed during this step */
  toolResults: ToolExecutionResult[];
}

/** Result of a single tool call executed by ExecutorWorker. */
export interface ToolExecutionResult {
  action: string;
  success: boolean;
  summary: string;
}

/** Validation verdict from ValidatorWorker. */
export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  feedback?: string;
}

/** Assembled final response from AssemblerWorker. */
export interface AssemblyResult {
  response: string;
  stepCount: number;
  totalDurationMs: number;
  failedSteps: string[];
}
