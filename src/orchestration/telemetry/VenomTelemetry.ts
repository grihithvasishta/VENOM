export class VenomTelemetry {
    private isThinkingEnabled = false;

    enableThinking() {
        this.isThinkingEnabled = true;
    }

    disableThinking() {
        this.isThinkingEnabled = false;
    }

    logStage(stage: string, message: string) {
        if (this.isThinkingEnabled) {
            console.log(`[${stage}]\n${message}\n`);
        }
    }
}
