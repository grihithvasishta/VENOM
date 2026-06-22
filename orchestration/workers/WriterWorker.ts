/**
 * WriterWorker — VENOM Writing Subagent
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles the complete write pipeline:
 *   1. Classify the topic (ARTICLE / MARKETING / CONVERSATIONAL / ESSAY_FORMAL)
 *   2. Load the writer system prompt from disk (or fallback)
 *   3. Inject voice target for the classified topic
 *   4. Load few-shot examples from JSONL files
 *   5. Execute the writing task via MultiPurposeAgent
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import { VenomAgentRegistry } from '../../src/agents/VenomAgentRegistry';
import { VenomMessage } from '../../src/shared/types';
import { VenomTelemetry } from '../telemetry/VenomTelemetry';
import {
  DEFAULT_WRITER_SYSTEM_PROMPT,
  WRITER_CLASSIFIER_PROMPT,
  WRITER_VOICE_TARGETS,
  WRITER_EXAMPLE_FILES,
} from '../prompts/orchestrationPrompts';

export type WriterTopic = 'ARTICLE' | 'MARKETING' | 'CONVERSATIONAL' | 'ESSAY_FORMAL';

export class WriterWorker {
  constructor(
    private readonly registry: VenomAgentRegistry,
    private readonly telemetry: VenomTelemetry
  ) {}

  /**
   * Execute the full write pipeline and return the written content.
   */
  async write(input: string, context: string): Promise<string> {
    // Step 1: Classify topic
    const topic = await this.classifyTopic(input);
    this.telemetry.logStage('WriterWorker', `Topic classified as: ${topic}`);

    // Step 2: Get the write agent
    const writeAgent = this.registry.getAgent('MultiPurposeAgent');
    if (!writeAgent) throw new Error('MultiPurposeAgent is not registered.');

    // Step 3: Build the system prompt
    let systemPrompt = this.loadWriterPromptFile();

    // Step 4: Inject voice target
    const voiceTarget = WRITER_VOICE_TARGETS[topic] ?? '';
    if (voiceTarget) {
      systemPrompt += `\n\n### CATEGORY TARGET:\n${voiceTarget}`;
    }

    // Step 5: Inject few-shot examples
    const exampleFile = WRITER_EXAMPLE_FILES[topic] ?? '';
    const examplesStr = exampleFile ? this.loadJsonlExamples(exampleFile, 3) : '';
    if (examplesStr) {
      systemPrompt += `\n\n### FEW-SHOT EXAMPLES:\n${examplesStr}`;
    }

    // Step 6: Execute
    this.telemetry.logStage('WriterWorker', `Executing write task with ${topic} voice...`);
    const messages: VenomMessage[] = [{ role: 'system', content: systemPrompt }];
    if (context) {
      messages.push({ role: 'system', content: context });
    }

    return writeAgent.execute(input, messages);
  }

  // ─── Topic Classification ────────────────────────────────────────────────

  private async classifyTopic(input: string): Promise<WriterTopic> {
    const mainAgent = this.registry.getAgent('MainAgent');
    if (!mainAgent) return 'ARTICLE';

    try {
      this.telemetry.logStage('WriterWorker', 'Classifying writing topic...');
      const prompt = `${WRITER_CLASSIFIER_PROMPT}"${input}"`;
      const response = await mainAgent.execute(prompt, [
        { role: 'system', content: 'You are a precise classifier. Output only one word.' },
      ]);

      const cleaned = response.trim().toUpperCase();
      if (cleaned.includes('MARKETING')) return 'MARKETING';
      if (cleaned.includes('CONVERSATIONAL')) return 'CONVERSATIONAL';
      if (cleaned.includes('ESSAY_FORMAL')) return 'ESSAY_FORMAL';
      return 'ARTICLE';
    } catch (err) {
      this.telemetry.logError('WriterWorker', err);
      return 'ARTICLE';
    }
  }

  // ─── File Loading ─────────────────────────────────────────────────────────

  private loadWriterPromptFile(): string {
    const promptPath = path.join(process.cwd(), 'writing-assistant', 'writer_prompt.md');
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, 'utf8');
    }
    return DEFAULT_WRITER_SYSTEM_PROMPT;
  }

  private loadJsonlExamples(filename: string, count: number): string {
    const filePath = path.join(process.cwd(), 'writing-assistant', filename);
    if (!fs.existsSync(filePath)) return '';
    try {
      const lines = fs
        .readFileSync(filePath, 'utf8')
        .split('\n')
        .filter((l) => l.trim().length > 0);
      if (lines.length === 0) return '';
      const shuffled = [...lines].sort(() => Math.random() - 0.5);
      return shuffled
        .slice(0, count)
        .map((line, i) => {
          const parsed = JSON.parse(line) as { topic?: string; output?: string };
          return `Example ${i + 1} (${parsed.topic ?? 'unknown'}):\n${parsed.output ?? line}\n`;
        })
        .join('\n');
    } catch {
      return '';
    }
  }
}
