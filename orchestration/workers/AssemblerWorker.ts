/**
 * AssemblerWorker — VENOM Assembly Subagent
 * ─────────────────────────────────────────────────────────────────────────────
 * Takes all step results from the execution phase and synthesises them
 * into a single, coherent final response using MainAgent.
 *
 * Also produces metadata about the execution:
 *   • Total duration
 *   • Step count
 *   • Which steps failed
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { VenomAgentRegistry } from '../../src/agents/VenomAgentRegistry';
import { VenomTelemetry } from '../telemetry/VenomTelemetry';
import { ASSEMBLER_SYSTEM_PROMPT } from '../prompts/orchestrationPrompts';
import { VenomStepResult, AssemblyResult } from '../types/orchestrationTypes';

export class AssemblerWorker {
  constructor(
    private readonly registry: VenomAgentRegistry,
    private readonly telemetry: VenomTelemetry
  ) {}

  /**
   * Assemble all step results into a final coherent response.
   * Uses MainAgent to synthesise. Falls back to concatenation if MainAgent is unavailable.
   */
  async assemble(
    originalInput: string,
    results: VenomStepResult[]
  ): Promise<AssemblyResult> {
    const totalDurationMs = results.reduce((sum, r) => sum + r.durationMs, 0);
    const failedSteps = results.filter((r) => !r.success).map((r) => r.stepId);

    this.telemetry.logStage(
      'AssemblerWorker',
      `Assembling ${results.length} step(s) (${failedSteps.length} failed) — total ${totalDurationMs}ms.`
    );

    // If only one step and it succeeded, return its output directly (no LLM call needed)
    const successfulResults = results.filter((r) => r.success && r.output.trim());
    if (successfulResults.length === 1) {
      this.telemetry.logStage('AssemblerWorker', 'Single successful step — returning directly.');
      return {
        response: successfulResults[0].output,
        stepCount: results.length,
        totalDurationMs,
        failedSteps,
      };
    }

    // If no successful results, return error summary
    if (successfulResults.length === 0) {
      const errorSummary = results
        .map((r) => `Step ${r.stepId}: ${r.error ?? 'Unknown error'}`)
        .join('\n');
      return {
        response: `All execution steps failed:\n${errorSummary}`,
        stepCount: results.length,
        totalDurationMs,
        failedSteps,
      };
    }

    // Multiple results — use MainAgent to synthesise
    const mainAgent = this.registry.getAgent('MainAgent');
    if (!mainAgent) {
      // Fallback: concatenate outputs
      this.telemetry.logStage('AssemblerWorker', 'MainAgent unavailable — concatenating outputs.');
      const concatenated = successfulResults.map((r) => r.output).join('\n\n');
      return {
        response: concatenated,
        stepCount: results.length,
        totalDurationMs,
        failedSteps,
      };
    }

    try {
      const stepSummaries = results
        .map((r, i) => {
          const status = r.success ? 'COMPLETED' : 'FAILED';
          const content = r.success ? r.output : `[Error: ${r.error}]`;
          return `--- Step ${i + 1} [${r.agentType}] ${status} (${r.durationMs}ms) ---\n${content}`;
        })
        .join('\n\n');

      const assemblerPrompt = [
        `Original user request: "${originalInput}"`,
        '',
        `Execution results:`,
        stepSummaries,
        '',
        'Synthesise the above into a single, polished final response for the user.',
      ].join('\n');

      const response = await mainAgent.execute(assemblerPrompt, [
        { role: 'system', content: ASSEMBLER_SYSTEM_PROMPT },
      ]);

      this.telemetry.logStage('AssemblerWorker', 'Final response assembled.');

      return {
        response,
        stepCount: results.length,
        totalDurationMs,
        failedSteps,
      };
    } catch (err) {
      this.telemetry.logError('AssemblerWorker', err);
      // Fallback to concatenation
      const concatenated = successfulResults.map((r) => r.output).join('\n\n');
      return {
        response: concatenated,
        stepCount: results.length,
        totalDurationMs,
        failedSteps,
      };
    }
  }
}
