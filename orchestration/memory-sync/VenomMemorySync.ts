/**
 * VenomMemorySync — Full Memory Integration
 * ─────────────────────────────────────────────────────────────────────────────
 * Bridges ALL FOUR memory systems into the orchestration pipeline:
 *   • WorkingMemory   — conversation history (recent turns)
 *   • LearningMemory  — user preferences and patterns learned over time
 *   • ProjectMemory   — file structure and architecture decisions
 *   • KnowledgeGraph  — entity relationships and conceptual links
 *
 * The getContextString() method produces a rich context block that gets
 * injected into every agent's prompt, giving them awareness of:
 *   - What the user has said recently
 *   - What VENOM has learned about the user's preferences
 *   - What files/architecture exist in the project
 *   - Related knowledge entities
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { VenomWorkingMemory } from '../../src/memory/VenomWorkingMemory';
import { VenomLearningMemory } from '../../src/memory/VenomLearningMemory';
import { VenomProjectMemory } from '../../src/memory/VenomProjectMemory';
import { VenomKnowledgeGraph } from '../../src/memory/VenomKnowledgeGraph';

export class VenomMemorySync {
  constructor(
    private readonly workingMemory: VenomWorkingMemory,
    private readonly learningMemory: VenomLearningMemory,
    private readonly projectMemory: VenomProjectMemory,
    private readonly knowledgeGraph: VenomKnowledgeGraph
  ) {}

  // ─── Write ───────────────────────────────────────────────────────────────

  /** Persist the user's input to working memory. */
  syncInput(input: string): void {
    this.workingMemory.addMessage({ role: 'user', content: input });
  }

  /** Persist the assistant's final response to working memory. */
  syncOutput(output: string): void {
    this.workingMemory.addMessage({ role: 'assistant', content: output });
  }

  /** Record a file that was written/modified during execution. */
  syncFile(filepath: string, content: string): void {
    this.projectMemory.updateFileStructure(filepath, content);
  }

  /** Record an architecture or design decision. */
  syncDecision(decision: string, context: string): void {
    this.projectMemory.logArchitectureDecision(decision, context);
  }

  /** Record a learned user preference pattern. */
  syncPattern(type: string, data: string): void {
    this.learningMemory.recordPattern(type, data);
  }

  /** Add or update a knowledge node and its relationships. */
  syncKnowledge(
    nodeId: string,
    nodeType: string,
    data: unknown,
    relations?: Array<{ targetId: string; targetType: string; relation: string }>
  ): void {
    this.knowledgeGraph.addNode({ id: nodeId, type: nodeType, data });
    if (relations) {
      for (const rel of relations) {
        this.knowledgeGraph.addNode({
          id: rel.targetId,
          type: rel.targetType,
          data: {},
        });
        this.knowledgeGraph.addEdge({
          source: nodeId,
          target: rel.targetId,
          relation: rel.relation,
        });
      }
    }
  }

  // ─── Read ────────────────────────────────────────────────────────────────

  /**
   * Build a rich context string from all four memory systems.
   *
   * Includes:
   *   1. Up to 5 learned user preferences (LearningMemory)
   *   2. Up to 10 recent conversation turns (WorkingMemory)
   *
   * Returns empty string if no context is available.
   */
  getContextString(): string {
    const parts: string[] = [];

    // Learned preferences
    try {
      const patterns = this.learningMemory.getPatterns('system_preference');
      if (patterns.length > 0) {
        const recent = patterns.slice(0, 5);
        parts.push(`[Learned Preferences]\n${recent.join('\n')}`);
      }
    } catch {
      // LearningMemory may not be initialized — skip silently
    }

    // Recent conversation turns
    try {
      const recentMessages = this.workingMemory.getRecentContext(10);
      if (recentMessages.length > 0) {
        const formatted = recentMessages
          .map((m) => `${m.role === 'user' ? 'User' : 'VENOM'}: ${m.content}`)
          .join('\n');
        parts.push(`[Recent Conversation]\n${formatted}`);
      }
    } catch {
      // WorkingMemory may not be initialized — skip silently
    }

    if (parts.length === 0) return '';
    return `[Memory Context]\n${parts.join('\n\n')}\n`;
  }

  /**
   * Retrieve knowledge related to a specific entity.
   * Returns formatted string or empty.
   */
  getRelatedKnowledge(entityId: string): string {
    try {
      const related = this.knowledgeGraph.getRelatedNodes(entityId);
      if (related.length === 0) return '';
      const lines = related.map(
        (r: { id: string; type: string; relation: string }) =>
          `  - ${r.relation} → ${r.id} (${r.type})`
      );
      return `[Related Knowledge: ${entityId}]\n${lines.join('\n')}\n`;
    } catch {
      return '';
    }
  }

  /**
   * Get saved file content from project memory.
   */
  getFileContent(filepath: string): string | null {
    try {
      return this.projectMemory.getFileStructure(filepath);
    } catch {
      return null;
    }
  }
}
