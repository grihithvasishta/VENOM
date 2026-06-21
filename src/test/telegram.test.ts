import test from 'node:test';
import assert from 'node:assert';
import { VenomTelegramGateway } from '../telegram/VenomTelegramGateway';
import { AgentMode } from '../shared/types';

// Mock Orchestrator
class MockOrchestrator {
    public telemetry = {
        enableThinking: () => {},
        disableThinking: () => {}
    };
    
    async execute(input: string, mode: AgentMode): Promise<string> {
        return `Response to ${input} in mode ${mode}`;
    }
}

test('VenomTelegramGateway Initialization', (t) => {
    // Should throw if no token is defined
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    
    assert.throws(() => {
        new VenomTelegramGateway(new MockOrchestrator() as any);
    }, /TELEGRAM_BOT_TOKEN is not defined/);
    
    // Should initialize successfully with a fake token
    process.env.TELEGRAM_BOT_TOKEN = 'fake:token';
    assert.doesNotThrow(() => {
        new VenomTelegramGateway(new MockOrchestrator() as any);
    });
    
    process.env.TELEGRAM_BOT_TOKEN = originalToken; // restore
});
