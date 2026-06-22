/**
 * VenomTelemetry
 * ─────────────────────────────────────────────────────────────────────────────
 * Functional timestamped telemetry for the orchestration pipeline.
 *
 * Stage logs are gated behind the thinking toggle so they only appear
 * when the user appends "think=gs" to their chat input. Errors are always
 * visible regardless of the toggle.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface VenomTelemetryEvent {
  timestamp: string;
  stage: string;
  message: string;
}

export class VenomTelemetry {
  private thinking = false;
  private readonly history: VenomTelemetryEvent[] = [];

  // ─── Toggle ──────────────────────────────────────────────────────────────

  /** Enable verbose stage logging (triggered by `think=gs` in chat). */
  enableThinking(): void {
    this.thinking = true;
  }

  /** Disable verbose stage logging. */
  disableThinking(): void {
    this.thinking = false;
  }

  /** Returns true if thinking (verbose) mode is currently active. */
  isThinkingEnabled(): boolean {
    return this.thinking;
  }

  // ─── Logging ─────────────────────────────────────────────────────────────

  /**
   * Log a pipeline stage event.
   * Only printed to stdout when thinking mode is enabled.
   * Always appended to internal history.
   */
  logStage(stage: string, message: string): void {
    const event: VenomTelemetryEvent = {
      timestamp: new Date().toISOString(),
      stage,
      message,
    };
    this.history.push(event);
    if (this.thinking) {
      console.log(
        `\x1b[36m[${event.timestamp}] [${stage}]\x1b[0m ${message}`
      );
    }
  }

  /**
   * Log an error — always visible regardless of thinking mode.
   */
  logError(stage: string, error: unknown): void {
    const msg = error instanceof Error ? error.message : String(error);
    const event: VenomTelemetryEvent = {
      timestamp: new Date().toISOString(),
      stage,
      message: `ERROR: ${msg}`,
    };
    this.history.push(event);
    console.error(
      `\x1b[31m[${event.timestamp}] [${stage}] ERROR:\x1b[0m ${msg}`
    );
  }

  // ─── History ─────────────────────────────────────────────────────────────

  /** Return a copy of all recorded telemetry events. */
  getHistory(): VenomTelemetryEvent[] {
    return [...this.history];
  }

  /** Clear all stored telemetry history. */
  clearHistory(): void {
    this.history.length = 0;
  }
}
