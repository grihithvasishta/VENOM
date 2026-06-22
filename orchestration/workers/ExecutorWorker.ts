/**
 * ExecutorWorker — VENOM Execution Subagent
 * ─────────────────────────────────────────────────────────────────────────────
 * Executes a single VenomPlanStep by dispatching it to the correct agent.
 *
 * Features:
 *   • Routes each step to the right agent via agentType
 *   • Injects the correct per-agent system prompt
 *   • Parses TOOL_CALL blocks in agent output and executes them:
 *       - write_file:          via VenomShellRuntime (sandboxed)
 *       - run_command:         via VenomShellRuntime (sandboxed + blocked patterns)
 *       - read_file:           via VenomShellRuntime
 *       - navigate_browser:    via VenomBrowserRuntime
 *       - extract_browser_text via VenomBrowserRuntime
 *   • Tracks file writes in VenomMemorySync (project memory)
 *   • Measures wall-clock time
 *   • Never throws — captures all errors in VenomStepResult
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import { VenomAgentRegistry } from '../../src/agents/VenomAgentRegistry';
import { VenomShellRuntime } from '../../src/tools/VenomShellRuntime';
import { VenomBrowserRuntime } from '../../src/browser/VenomBrowserRuntime';
import { VenomTelemetry } from '../telemetry/VenomTelemetry';
import { VenomMemorySync } from '../memory-sync/VenomMemorySync';
import {
  MAIN_AGENT_EXECUTOR_PROMPT,
  CODING_AGENT_EXECUTOR_PROMPT,
  PLANNING_AGENT_EXECUTOR_PROMPT,
  MULTIPURPOSE_AGENT_EXECUTOR_PROMPT,
} from '../prompts/orchestrationPrompts';
import { AgentType, VenomPlanStep, VenomStepResult, ToolExecutionResult } from '../types/orchestrationTypes';

const AGENT_SYSTEM_PROMPTS: Record<AgentType, string> = {
  MainAgent: MAIN_AGENT_EXECUTOR_PROMPT,
  PlanningAgent: PLANNING_AGENT_EXECUTOR_PROMPT,
  CodingAgent: CODING_AGENT_EXECUTOR_PROMPT,
  MultiPurposeAgent: MULTIPURPOSE_AGENT_EXECUTOR_PROMPT,
};

// ─── Tool call types ─────────────────────────────────────────────────────────

type ParsedToolCall =
  | { action: 'write_file'; filepath: string; content: string }
  | { action: 'run_command'; command: string }
  | { action: 'read_file'; filepath: string }
  | { action: 'navigate_browser'; url: string }
  | { action: 'extract_browser_text' };

// ─── Worker ──────────────────────────────────────────────────────────────────

export class ExecutorWorker {
  /** Max tool calls allowed per step to prevent runaway execution. */
  private static readonly MAX_TOOL_CALLS = 3;

  constructor(
    private readonly registry: VenomAgentRegistry,
    private readonly telemetry: VenomTelemetry,
    private readonly shellRuntime: VenomShellRuntime,
    private readonly browserRuntime: VenomBrowserRuntime,
    private readonly memorySync: VenomMemorySync
  ) {}

  /**
   * Execute a single plan step. NEVER throws — all errors captured in result.
   */
  async execute(step: VenomPlanStep, context: string): Promise<VenomStepResult> {
    const start = Date.now();
    const toolResults: ToolExecutionResult[] = [];

    const agent = this.registry.getAgent(step.agentType);
    if (!agent) {
      return this.errorResult(step, start, `Agent "${step.agentType}" is not registered.`);
    }

    let systemPrompt = AGENT_SYSTEM_PROMPTS[step.agentType];
    
    // Inject Fable 5 prompt for CodingAgent specifically, as requested
    if (step.agentType === 'CodingAgent') {
      const fable5Path = path.join(process.cwd(), 'system-prompts', 'fable5.md');
      if (fs.existsSync(fable5Path)) {
        systemPrompt += `\n\n[CRITICAL BEHAVIOR CONTEXT]\n${fs.readFileSync(fable5Path, 'utf8')}`;
      }
    }

    const userPrompt = context
      ? `${context}\n\nTask: ${step.description}`
      : `Task: ${step.description}`;

    this.telemetry.logStage(
      'ExecutorWorker',
      `[${step.id}] → ${step.agentType}: "${step.description.slice(0, 80)}"`
    );

    // ── Call the agent ─────────────────────────────────────────────────────
    let rawOutput = '';
    try {
      rawOutput = await agent.execute(userPrompt, [
        { role: 'system', content: systemPrompt },
      ]);
    } catch (err) {
      this.telemetry.logError('ExecutorWorker', err);
      return this.errorResult(step, start, err instanceof Error ? err.message : String(err));
    }

    // ── Execute TOOL_CALL blocks ───────────────────────────────────────────
    const calls = this.parseToolCalls(rawOutput);
    const toolOutputParts: string[] = [];

    for (const call of calls) {
      const result = await this.executeToolCall(call, step.id);
      toolResults.push(result);
      toolOutputParts.push(`[${result.action}] ${result.success ? '✓' : '✗'} ${result.summary}`);
    }

    const finalOutput = toolOutputParts.length > 0
      ? `${rawOutput}\n\n[Tool Execution Results]\n${toolOutputParts.join('\n')}`
      : rawOutput;

    const durationMs = Date.now() - start;
    this.telemetry.logStage('ExecutorWorker', `[${step.id}] completed in ${durationMs}ms.`);

    return {
      stepId: step.id,
      agentType: step.agentType,
      output: finalOutput,
      success: true,
      durationMs,
      toolResults,
    };
  }

  // ─── Tool Call Execution ──────────────────────────────────────────────────

  private async executeToolCall(call: ParsedToolCall, stepId: string): Promise<ToolExecutionResult> {
    try {
      switch (call.action) {
        case 'write_file': {
          this.shellRuntime.writeFile(call.filepath, call.content);
          // Sync to project memory so future steps can see this file
          this.memorySync.syncFile(call.filepath, call.content);
          this.telemetry.logStage('ExecutorWorker', `[${stepId}] Wrote file: ${call.filepath}`);
          return { action: 'write_file', success: true, summary: `Written: ${call.filepath}` };
        }

        case 'run_command': {
          const output = await this.shellRuntime.executeCommand(call.command);
          this.telemetry.logStage('ExecutorWorker', `[${stepId}] Ran command: ${call.command}`);
          return { action: 'run_command', success: true, summary: `"${call.command}" → ${output.slice(0, 200)}` };
        }

        case 'read_file': {
          const content = this.shellRuntime.readFile(call.filepath);
          this.telemetry.logStage('ExecutorWorker', `[${stepId}] Read file: ${call.filepath}`);
          return { action: 'read_file', success: true, summary: `Read ${call.filepath} (${content.length} bytes)` };
        }

        case 'navigate_browser': {
          await this.browserRuntime.navigate(call.url);
          this.telemetry.logStage('ExecutorWorker', `[${stepId}] Navigated to: ${call.url}`);
          return { action: 'navigate_browser', success: true, summary: `Navigated to ${call.url}` };
        }

        case 'extract_browser_text': {
          const text = await this.browserRuntime.extractText();
          this.telemetry.logStage('ExecutorWorker', `[${stepId}] Extracted browser text (${text.length} chars).`);
          return { action: 'extract_browser_text', success: true, summary: `Extracted ${text.length} chars` };
        }

        default:
          return { action: 'unknown', success: false, summary: 'Unknown tool action' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.telemetry.logError('ExecutorWorker', `[${stepId}] Tool ${call.action} failed: ${msg}`);
      return { action: call.action, success: false, summary: msg };
    }
  }

  // ─── Tool Call Parsing ────────────────────────────────────────────────────

  private parseToolCalls(text: string): ParsedToolCall[] {
    const calls: ParsedToolCall[] = [];
    let searchFrom = 0;

    while (calls.length < ExecutorWorker.MAX_TOOL_CALLS) {
      const marker = text.indexOf('TOOL_CALL:', searchFrom);
      if (marker === -1) break;

      const jsonStart = text.indexOf('{', marker);
      if (jsonStart === -1) break;

      const jsonEnd = this.findObjectEnd(text, jsonStart);
      if (jsonEnd === -1) break;

      try {
        const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
        const call = this.validateToolCall(parsed);
        if (call) calls.push(call);
      } catch {
        // skip malformed JSON
      }

      searchFrom = jsonEnd + 1;
    }

    return calls;
  }

  private validateToolCall(parsed: Record<string, unknown>): ParsedToolCall | null {
    switch (parsed.action) {
      case 'write_file':
        if (typeof parsed.filepath === 'string' && typeof parsed.content === 'string') {
          return { action: 'write_file', filepath: parsed.filepath, content: parsed.content };
        }
        return null;

      case 'run_command':
        if (typeof parsed.command === 'string') {
          return { action: 'run_command', command: parsed.command };
        }
        return null;

      case 'read_file':
        if (typeof parsed.filepath === 'string') {
          return { action: 'read_file', filepath: parsed.filepath };
        }
        return null;

      case 'navigate_browser':
        if (typeof parsed.url === 'string') {
          return { action: 'navigate_browser', url: parsed.url };
        }
        return null;

      case 'extract_browser_text':
        return { action: 'extract_browser_text' };

      default:
        return null;
    }
  }

  private findObjectEnd(text: string, start: number): number {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (inString && ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private errorResult(step: VenomPlanStep, startTime: number, error: string): VenomStepResult {
    return {
      stepId: step.id,
      agentType: step.agentType,
      output: '',
      success: false,
      durationMs: Date.now() - startTime,
      error,
      toolResults: [],
    };
  }
}
