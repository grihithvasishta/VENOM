/**
 * ValidatorWorker — VENOM Validation Subagent
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates the output of a completed execution step against the original
 * task description. Uses MultiPurposeAgent (Groq, fast) to judge quality.
 *
 * Returns a ValidationResult:
 *   • isValid:    boolean — does the output satisfy the task?
 *   • confidence: 0.0–1.0 — how confident is the validator?
 *   • feedback:   string  — explanation if invalid
 *
 * Falls back to "valid" on any LLM error to avoid blocking the pipeline.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { VenomAgentRegistry } from '../../src/agents/VenomAgentRegistry';
import { VenomTelemetry } from '../telemetry/VenomTelemetry';
import { VALIDATOR_SYSTEM_PROMPT } from '../prompts/orchestrationPrompts';
import { ValidationResult, VenomStepResult } from '../types/orchestrationTypes';

export class ValidatorWorker {
  constructor(
    private readonly registry: VenomAgentRegistry,
    private readonly telemetry: VenomTelemetry
  ) {}

  /**
   * Validate a step's output against its original task.
   * Never throws — returns valid on any error.
   */
  async validate(stepResult: VenomStepResult, taskDescription: string): Promise<ValidationResult> {
    // Skip validation for failed steps — they need retry, not validation
    if (!stepResult.success) {
      return { isValid: false, confidence: 1.0, feedback: stepResult.error ?? 'Step execution failed.' };
    }

    // Skip validation if output is empty
    if (!stepResult.output.trim()) {
      return { isValid: false, confidence: 1.0, feedback: 'Step produced empty output.' };
    }

    const validator = this.registry.getAgent('MultiPurposeAgent');
    if (!validator) {
      this.telemetry.logStage('ValidatorWorker', 'MultiPurposeAgent unavailable — accepting output.');
      return { isValid: true, confidence: 0.5 };
    }

    try {
      this.telemetry.logStage('ValidatorWorker', `Validating step ${stepResult.stepId}...`);

      const prompt = [
        `Task description: "${taskDescription}"`,
        '',
        `Step output (first 2000 chars):`,
        stepResult.output.slice(0, 2000),
      ].join('\n');

      const response = await validator.execute(prompt, [
        { role: 'system', content: VALIDATOR_SYSTEM_PROMPT },
      ]);

      const result = this.parseValidation(response);
      this.telemetry.logStage(
        'ValidatorWorker',
        `Step ${stepResult.stepId}: ${result.isValid ? 'VALID' : 'INVALID'} (confidence: ${result.confidence})`
      );
      return result;
    } catch (err) {
      this.telemetry.logError('ValidatorWorker', err);
      // Default to valid on error — don't block the pipeline
      return { isValid: true, confidence: 0.3, feedback: 'Validation skipped due to error.' };
    }
  }

  /**
   * Parse the validator's JSON response.
   * Handles common LLM output variations (markdown fences, extra text).
   */
  private parseValidation(raw: string): ValidationResult {
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    // Find the JSON object
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      // If we can't parse, check for simple keywords
      const upper = stripped.toUpperCase();
      if (upper.includes('INVALID') || upper.includes('"ISVALID": FALSE') || upper.includes('"ISVALID":FALSE')) {
        return { isValid: false, confidence: 0.5, feedback: stripped };
      }
      return { isValid: true, confidence: 0.5 };
    }

    try {
      const parsed = JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
      return {
        isValid: parsed.isValid === true,
        confidence: typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
        feedback: typeof parsed.feedback === 'string' ? parsed.feedback : undefined,
      };
    } catch {
      return { isValid: true, confidence: 0.3 };
    }
  }
}
