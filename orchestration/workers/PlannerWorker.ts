/**
 * PlannerWorker — VENOM Planning Subagent
 * ─────────────────────────────────────────────────────────────────────────────
 * Decomposes a user request into a typed, structured VenomPlan by calling
 * the PlanningAgent with a strict JSON-output system prompt.
 *
 * The worker validates the raw JSON output before returning so the
 * ExecutorWorker always receives a well-formed plan.
 *
 * Fallback: if the planning agent returns malformed JSON or fails entirely,
 * PlannerWorker returns a single-step plan pointing at MainAgent so the
 * pipeline never stalls.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { VenomAgentRegistry } from '../../src/agents/VenomAgentRegistry';
import { VenomTelemetry } from '../telemetry/VenomTelemetry';
import { PLANNER_SYSTEM_PROMPT } from '../prompts/orchestrationPrompts';
import { AgentType, VenomPlan, VenomPlanStep } from '../types/orchestrationTypes';

const VALID_AGENT_TYPES = new Set<AgentType>([
  'MainAgent',
  'PlanningAgent',
  'CodingAgent',
  'MultiPurposeAgent',
]);

export class PlannerWorker {
  constructor(
    private readonly registry: VenomAgentRegistry,
    private readonly telemetry: VenomTelemetry
  ) {}

  /**
   * Decompose the user request into a structured VenomPlan.
   *
   * @param input      Raw user input string.
   * @param context    Memory context string (from VenomMemorySync.getContextString).
   * @returns          A validated VenomPlan — always has at least one step.
   */
  async createPlan(input: string, context: string): Promise<VenomPlan> {
    const planningAgent = this.registry.getAgent('PlanningAgent');
    if (!planningAgent) {
      this.telemetry.logError('PlannerWorker', 'PlanningAgent not registered — using single-step fallback.');
      return this.fallbackPlan(input);
    }

    let rawOutput = '';
    try {
      this.telemetry.logStage('PlannerWorker', 'Calling PlanningAgent to generate plan...');

      const systemPrompt = PLANNER_SYSTEM_PROMPT;

      const prompt = context
        ? `${context}\n\nTask:\n"${input}"`
        : `Task:\n"${input}"`;

      rawOutput = await planningAgent.execute(prompt, [
        { role: 'system', content: systemPrompt },
      ]);
      this.telemetry.logStage('PlannerWorker', `Raw plan output received (${rawOutput.length} chars).`);
    } catch (err) {
      this.telemetry.logError('PlannerWorker', err);
      return this.fallbackPlan(input);
    }

    const plan = this.parseAndValidate(rawOutput, input);
    this.telemetry.logStage(
      'PlannerWorker',
      `Plan created: ${plan.steps.length} step(s) across ${this.countPriorityGroups(plan)} priority group(s).`
    );
    return plan;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Strip optional markdown fences, extract the JSON array, parse it,
   * validate every field, and return a clean VenomPlan.
   */
  private parseAndValidate(raw: string, originalInput: string): VenomPlan {
    // Remove ```json ... ``` or ``` ... ``` wrappers that models sometimes emit
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    // Find the first '[' and last ']' to isolate the array
    const start = stripped.indexOf('[');
    const end = stripped.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      this.telemetry.logError('PlannerWorker', `No JSON array found in planner output. Falling back.`);
      return this.fallbackPlan(originalInput);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped.slice(start, end + 1));
    } catch (err) {
      this.telemetry.logError('PlannerWorker', `JSON parse failed: ${err}. Falling back.`);
      return this.fallbackPlan(originalInput);
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      this.telemetry.logError('PlannerWorker', 'Planner returned empty or non-array. Falling back.');
      return this.fallbackPlan(originalInput);
    }

    const steps: VenomPlanStep[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const raw = parsed[i] as Record<string, unknown>;

      const id = typeof raw.id === 'string' ? raw.id : `step-${i + 1}`;
      const description = typeof raw.description === 'string' && raw.description.trim().length > 0
        ? raw.description.trim()
        : originalInput;
      const agentType: AgentType = VALID_AGENT_TYPES.has(raw.agentType as AgentType)
        ? (raw.agentType as AgentType)
        : 'MainAgent';
      const priority = typeof raw.priority === 'number' && Number.isFinite(raw.priority)
        ? Math.max(1, Math.round(raw.priority))
        : i + 1;

      steps.push({ id, description, agentType, priority });
    }

    // Hard cap: never allow more than 8 steps
    return { steps: steps.slice(0, 8) };
  }

  /** Single-step fallback plan pointing at MainAgent. */
  private fallbackPlan(input: string): VenomPlan {
    return {
      steps: [
        {
          id: 'step-1',
          description: input,
          agentType: 'MainAgent',
          priority: 1,
        },
      ],
    };
  }

  private countPriorityGroups(plan: VenomPlan): number {
    return new Set(plan.steps.map((s) => s.priority)).size;
  }
}
