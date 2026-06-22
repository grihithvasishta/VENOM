/**
 * VenomOrchestrator — Main Pipeline Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * The orchestrator itself contains NO business logic. It delegates EVERYTHING
 * to the 6 subagent workers:
 *
 *   RouterWorker     → decides which pipeline to use
 *   PlannerWorker    → decomposes tasks into structured steps
 *   ExecutorWorker   → executes a single step with tool support
 *   ValidatorWorker  → validates step output quality
 *   AssemblerWorker  → synthesises multi-step outputs into final response
 *   WriterWorker     → handles the full writing pipeline
 *
 * Three execution pipelines:
 *   DIRECT  →  RouterWorker → MainAgent (single call)
 *   WRITE   →  RouterWorker → WriterWorker (classify → examples → write)
 *   AGENT   →  RouterWorker → PlannerWorker → ExecutorWorker[] (parallel)
 *             → ValidatorWorker → retry if invalid → AssemblerWorker
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { VenomAgentRegistry } from '../src/agents/VenomAgentRegistry';
import { AgentMode, VenomMessage } from '../src/shared/types';
import { VenomTelemetry } from './telemetry/VenomTelemetry';
import { VenomMemorySync } from './memory-sync/VenomMemorySync';

// Workers
import { RouterWorker, PipelineType } from './workers/RouterWorker';
import { PlannerWorker } from './workers/PlannerWorker';
import { ExecutorWorker } from './workers/ExecutorWorker';
import { ValidatorWorker } from './workers/ValidatorWorker';
import { AssemblerWorker } from './workers/AssemblerWorker';
import { WriterWorker } from './workers/WriterWorker';

import { VenomPlan, VenomStepResult } from './types/orchestrationTypes';

export class VenomOrchestrator {
  /** Exposed so the CLI/Telegram can toggle thinking mode. */
  public readonly telemetry: VenomTelemetry;

  constructor(
    private readonly registry: VenomAgentRegistry,
    private readonly memorySync: VenomMemorySync,
    telemetry: VenomTelemetry,
    private readonly routerWorker: RouterWorker,
    private readonly plannerWorker: PlannerWorker,
    private readonly executorWorker: ExecutorWorker,
    private readonly validatorWorker: ValidatorWorker,
    private readonly assemblerWorker: AssemblerWorker,
    private readonly writerWorker: WriterWorker
  ) {
    this.telemetry = telemetry;
  }

  // ─── Public Entry Point ───────────────────────────────────────────────────

  async execute(input: string, mode: AgentMode): Promise<string> {
    this.memorySync.syncInput(input);
    const context = this.memorySync.getContextString();

    // Step 1: Route — let the RouterWorker decide which pipeline to use
    const pipeline: PipelineType = await this.routerWorker.route(input, mode);

    let result: string;

    switch (pipeline) {
      case 'WRITE':
        result = await this.writePipeline(input, context);
        break;

      case 'AGENT':
        result = await this.agentPipeline(input, context);
        break;

      case 'DIRECT':
      default:
        result = await this.directPipeline(input, context);
        break;
    }

    this.memorySync.syncOutput(result);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PIPELINE: DIRECT
  // Single MainAgent call — fast, no planning overhead.
  // ═══════════════════════════════════════════════════════════════════════════

  private async directPipeline(input: string, context: string): Promise<string> {
    this.telemetry.logStage('Pipeline:DIRECT', 'Starting direct pipeline.');

    const mainAgent = this.registry.getAgent('MainAgent');
    if (!mainAgent) throw new Error('MainAgent is not registered.');

    const messages: VenomMessage[] = context
      ? [{ role: 'system', content: context }]
      : [];

    const result = await mainAgent.execute(input, messages);
    this.telemetry.logStage('Pipeline:DIRECT', 'Response generated.');
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PIPELINE: WRITE
  // Delegates entirely to WriterWorker subagent.
  // ═══════════════════════════════════════════════════════════════════════════

  private async writePipeline(input: string, context: string): Promise<string> {
    this.telemetry.logStage('Pipeline:WRITE', 'Starting write pipeline.');
    const result = await this.writerWorker.write(input, context);
    this.telemetry.logStage('Pipeline:WRITE', 'Writing complete.');
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PIPELINE: AGENT (FABLE5)
  // Full multi-subagent pipeline with planning, parallel execution,
  // validation, retry, and assembly.
  // ═══════════════════════════════════════════════════════════════════════════

  private async agentPipeline(input: string, context: string): Promise<string> {
    this.telemetry.logStage('Pipeline:AGENT', 'Starting FABLE5 agent pipeline.');

    // ── Phase 1: Plan ────────────────────────────────────────────────────────
    this.telemetry.logStage('Pipeline:AGENT', 'Phase 1 → PlannerWorker');
    const plan: VenomPlan = await this.plannerWorker.createPlan(input, context);
    this.telemetry.logStage(
      'Pipeline:AGENT',
      `Plan: ${plan.steps.length} step(s) → ${plan.steps.map((s) => `[${s.id}:${s.agentType}]`).join(' ')}`
    );

    // ── Phase 2: Execute (parallel within priority groups) ───────────────────
    this.telemetry.logStage('Pipeline:AGENT', 'Phase 2 → ExecutorWorker (parallel)');
    const priorityGroups = this.groupByPriority(plan);
    const allResults: VenomStepResult[] = [];

    for (const [priority, steps] of priorityGroups) {
      this.telemetry.logStage(
        'Pipeline:AGENT',
        `Priority ${priority}: ${steps.length} step(s) launching in parallel.`
      );

      const groupResults = await Promise.all(
        steps.map((step) => this.executorWorker.execute(step, context))
      );

      // ── Phase 3: Validate + Retry ──────────────────────────────────────────
      for (let i = 0; i < groupResults.length; i++) {
        const result = groupResults[i];
        const step = steps[i];

        const validation = await this.validatorWorker.validate(result, step.description);

        if (!validation.isValid && validation.confidence > 0.6) {
          // Retry once with the validation feedback injected
          this.telemetry.logStage(
            'Pipeline:AGENT',
            `Step ${result.stepId} invalid (confidence ${validation.confidence}): ${validation.feedback}. Retrying...`
          );

          const retryContext = context
            ? `${context}\n\n[Previous attempt failed: ${validation.feedback}]\nPlease fix and try again.`
            : `[Previous attempt failed: ${validation.feedback}]\nPlease fix and try again.`;

          const retried = await this.executorWorker.execute(step, retryContext);
          allResults.push(retried);
        } else {
          allResults.push(result);
        }
      }
    }

    // ── Phase 4: Assemble ────────────────────────────────────────────────────
    this.telemetry.logStage('Pipeline:AGENT', 'Phase 4 → AssemblerWorker');
    const assembly = await this.assemblerWorker.assemble(input, allResults);

    this.telemetry.logStage(
      'Pipeline:AGENT',
      `Complete: ${assembly.stepCount} steps, ${assembly.totalDurationMs}ms total, ${assembly.failedSteps.length} failures.`
    );

    return assembly.response;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private groupByPriority(plan: VenomPlan): Map<number, typeof plan.steps> {
    const groups = new Map<number, typeof plan.steps>();
    for (const step of plan.steps) {
      if (!groups.has(step.priority)) groups.set(step.priority, []);
      groups.get(step.priority)!.push(step);
    }
    return new Map([...groups.entries()].sort(([a], [b]) => a - b));
  }
}
