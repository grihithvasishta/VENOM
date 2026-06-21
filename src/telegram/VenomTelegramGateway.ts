import { Telegraf } from 'telegraf';
import { VenomOrchestrator } from '../orchestration/VenomOrchestrator';
import { AgentMode } from '../shared/types';
import dotenv from 'dotenv';

dotenv.config();

export class VenomTelegramGateway {
    private bot: Telegraf;
    private chatModes = new Map<string, AgentMode>();

    constructor(private orchestrator: VenomOrchestrator) {
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            throw new Error('TELEGRAM_BOT_TOKEN is not defined in the environment.');
        }
        this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
        this.setupHandlers();
    }

    private setupHandlers() {
        this.bot.command('fable5', (ctx) => {
            this.chatModes.set(String(ctx.chat?.id ?? ctx.from?.id ?? 'global'), AgentMode.FABLE5);
            ctx.reply('VENOM Full Agent Mode activated. Orchestration Engine online.');
        });

        this.bot.command('fablefoff', (ctx) => {
            this.chatModes.set(String(ctx.chat?.id ?? ctx.from?.id ?? 'global'), AgentMode.FABLEFOFF);
            ctx.reply('VENOM Direct Mode activated. Subagents inactive. Maximum response speed.');
        });

        this.bot.on('text', async (ctx) => {
            try {
                // Determine if we need to enable telemetry for this request
                if (ctx.message.text.includes('think=gs')) {
                    this.orchestrator.telemetry.enableThinking();
                } else {
                    this.orchestrator.telemetry.disableThinking();
                }

                // Clean the input
                const input = ctx.message.text.replace('think=gs', '').trim();
                const mode = this.chatModes.get(String(ctx.chat?.id ?? ctx.from?.id ?? 'global')) ?? AgentMode.NORMAL;
                
                // Let orchestrator handle the logic
                const response = await this.orchestrator.execute(input, mode);
                await this.replyInChunks(ctx, response);
            } catch (error: any) {
                await this.replyInChunks(ctx, `Error executing task: ${error.message}`);
            }
        });
    }

    private async replyInChunks(ctx: any, text: string) {
        const maxTelegramMessageLength = 3900;
        const safeText = text.length > 0 ? text : '(empty response)';

        for (let i = 0; i < safeText.length; i += maxTelegramMessageLength) {
            await ctx.reply(safeText.slice(i, i + maxTelegramMessageLength));
        }
    }

    start() {
        this.bot.launch();
        console.log('VENOM Telegram Gateway is running...');
    }

    stop(reason: string) {
        this.bot.stop(reason);
    }
}
