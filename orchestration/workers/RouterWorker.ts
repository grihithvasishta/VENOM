/**
 * RouterWorker — VENOM Routing Subagent
 * ─────────────────────────────────────────────────────────────────────────────
 * Classifies user input and decides which pipeline to use.
 * When mode is explicitly set (FABLE5, WRITE, FABLEFOFF), respects that.
 * When mode is NORMAL, uses the LLM to auto-detect the best pipeline.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { VenomAgentRegistry } from '../../src/agents/VenomAgentRegistry';
import { AgentMode } from '../../src/shared/types';
import { VenomTelemetry } from '../telemetry/VenomTelemetry';
import { ROUTER_SYSTEM_PROMPT } from '../prompts/orchestrationPrompts';

export type PipelineType = 'DIRECT' | 'AGENT' | 'WRITE';

export class RouterWorker {
  constructor(
    private readonly registry: VenomAgentRegistry,
    private readonly telemetry: VenomTelemetry
  ) {}

  /**
   * Decide which pipeline to use for the given input and mode.
   *
   * - FABLE5    → always AGENT
   * - FABLEFOFF → always DIRECT
   * - WRITE     → always WRITE
   * - NORMAL    → LLM auto-classify (falls back to DIRECT)
   */
  async route(input: string, mode: AgentMode): Promise<PipelineType> {
    // Explicit modes bypass the LLM entirely
    if (mode === AgentMode.FABLE5) {
      this.telemetry.logStage('RouterWorker', 'Explicit FABLE5 → AGENT pipeline.');
      return 'AGENT';
    }
    if (mode === AgentMode.FABLEFOFF) {
      this.telemetry.logStage('RouterWorker', 'Explicit FABLEFOFF → DIRECT pipeline.');
      return 'DIRECT';
    }
    if (mode === AgentMode.WRITE) {
      this.telemetry.logStage('RouterWorker', 'Explicit WRITE → WRITE pipeline.');
      return 'WRITE';
    }

    // NORMAL mode → auto-classify using MainAgent
    return this.autoClassify(input);
  }

  /**
   * Use MainAgent to classify whether the input needs
   * DIRECT, AGENT, or WRITE pipeline.
   */
  private async autoClassify(input: string): Promise<PipelineType> {
    const mainAgent = this.registry.getAgent('MainAgent');
    if (!mainAgent) {
      this.telemetry.logStage('RouterWorker', 'MainAgent unavailable — defaulting to DIRECT.');
      return 'DIRECT';
    }

    try {
      this.telemetry.logStage('RouterWorker', 'Auto-classifying input...');
      const response = await mainAgent.execute(
        `Classify this request:\n"${input.slice(0, 300)}"`,
        [{ role: 'system', content: ROUTER_SYSTEM_PROMPT }]
      );

      const cleaned = response.trim().toUpperCase();

      if (cleaned.includes('AGENT')) {
        this.telemetry.logStage('RouterWorker', 'Auto-classified → AGENT pipeline.');
        return 'AGENT';
      }
      if (cleaned.includes('WRITE')) {
        this.telemetry.logStage('RouterWorker', 'Auto-classified → WRITE pipeline.');
        return 'WRITE';
      }

      this.telemetry.logStage('RouterWorker', 'Auto-classified → DIRECT pipeline.');
      return 'DIRECT';
    } catch (err) {
      this.telemetry.logError('RouterWorker', err);
      return 'DIRECT';
    }
  }
}
