#!/usr/bin/env node

const originalEmit = process.emit;
process.emit = function (name: any, data: any, ...args: any[]) {
    if (name === 'warning' && typeof data === 'object' && data.name === 'ExperimentalWarning' && data.message.includes('SQLite')) {
        return false;
    }
    return originalEmit.apply(process, [name, data, ...args] as any);
} as any;

import { Command } from 'commander';
import { VenomProviderManager } from '../providers/VenomProviderManager';
import { VenomWorkingMemory } from '../memory/VenomWorkingMemory';
import { VenomShellRuntime } from '../tools/VenomShellRuntime';
import { VenomTelegramGateway } from '../telegram/VenomTelegramGateway';
import { AgentMode } from '../shared/types';
import { createVenomOrchestrator } from '../createVenomOrchestrator';
import {
    createDefaultVenomSettings,
    getVenomSettingsPath,
    hasConfiguredProvider,
    loadVenomSettingsIntoEnv,
    writeVenomSettings,
    readVenomSettings
} from '../config/VenomSettings';
import readline from 'readline';

const program = new Command();
loadVenomSettingsIntoEnv();

program
  .name('venom')
  .description('VENOM - Production-grade AI operating system CLI')
  .version('1.0.0');

const buildOrchestrator = () => createVenomOrchestrator();

const ask = (rl: readline.Interface, question: string): Promise<string> => {
    return new Promise(resolve => rl.question(`\x1b[1m\x1b[36m? \x1b[32m${question}\x1b[0m\n\x1b[1m\x1b[35m❯ \x1b[0m`, answer => resolve(answer.trim())));
};

const runSetupWizard = async (force = false): Promise<boolean> => {
    if (!force && hasConfiguredProvider()) {
        return true;
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const settings = createDefaultVenomSettings();

    console.log('\n\x1b[1m\x1b[35m=== VENOM Setup ===\x1b[0m\n');
    console.log('\x1b[37mWelcome! To get started, we need an API key for the AI models.\x1b[0m');
    console.log('\x1b[37mYou only need ONE key. If you don\'t have one, just hit Enter to skip.\x1b[0m\n');

    settings.providers.groqApiKey = await ask(rl, 'Groq API key (Recommended for fast chat):');
    settings.providers.openRouterApiKey = await ask(rl, 'OpenRouter API key (Optional):');
    settings.providers.nvidiaNimApiKey = await ask(rl, 'NVIDIA NIM API key (Optional):');

    console.log();
    const enableTelegram = (await ask(rl, 'Enable Telegram bot integration? (y/N):')).toLowerCase();
    settings.telegram.enabled = enableTelegram === 'y' || enableTelegram === 'yes';
    if (settings.telegram.enabled) {
        settings.telegram.botToken = await ask(rl, 'Telegram bot token:');
    }

    rl.close();

    if (
        !settings.providers.groqApiKey &&
        !settings.providers.openRouterApiKey &&
        !settings.providers.nvidiaNimApiKey
    ) {
        console.log('\n\x1b[31mNo provider keys were entered. Please run `venom init` when you have an API key!\x1b[0m\n');
        return false;
    }

    writeVenomSettings(settings);
    loadVenomSettingsIntoEnv();
    console.log('\n\x1b[1m\x1b[32m✔ Setup complete! Your settings have been saved.\x1b[0m');
    console.log('\x1b[36mStarting VENOM...\x1b[0m\n');
    return true;
};

const startChat = async (mode: AgentMode = AgentMode.NORMAL) => {
    const orchestrator = buildOrchestrator();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const askChat = () => {
        rl.question('\n\x1b[1m\x1b[32m❯ You: \x1b[0m', async (input) => {
            if (input.toLowerCase() === 'exit') { rl.close(); return; }
            if (input.includes('think=gs')) orchestrator.telemetry.enableThinking();
            else orchestrator.telemetry.disableThinking();

            try {
                let currentMode = mode;
                let finalInput = input.replace('think=gs','').trim();
                
                if (finalInput.startsWith('/write ')) {
                    currentMode = AgentMode.WRITE;
                    finalInput = finalInput.replace('/write ', '').trim();
                }

                const response = await orchestrator.execute(finalInput, currentMode);
                console.log(`\nVENOM: ${response}`);
            } catch (e: any) {
                console.error(`\nError: ${e.message}`);
            }
            askChat();
        });
    };
    askChat();
};

const playLogoAnimation = async () => {
    console.clear();
    const logoLines = [
        "██╗   ██╗███████╗███╗   ██╗ ██████╗ ███╗   ███╗",
        "██║   ██║██╔════╝████╗  ██║██╔═══██╗████╗ ████║",
        "██║   ██║█████╗  ██╔██╗ ██║██║   ██║██╔████╔██║",
        "╚██╗ ██╔╝██╔══╝  ██║╚██╗██║██║   ██║██║╚██╔╝██║",
        " ╚████╔╝ ███████╗██║ ╚████║╚██████╔╝██║ ╚═╝ ██║",
        "  ╚═══╝  ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝     ╚═╝"
    ];
    
    const colors = [
        [255, 255, 255],
        [230, 204, 255],
        [204, 153, 255],
        [179, 102, 255],
        [153, 51, 255],
        [128, 0, 255]
    ];
    
    console.log();
    for (let i = 0; i < logoLines.length; i++) {
        const [r, g, b] = colors[i];
        console.log(`\x1b[38;2;${r};${g};${b}m${logoLines[i]}\x1b[0m`);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log();
    await new Promise(resolve => setTimeout(resolve, 300));
};

program.action(async () => {
    await playLogoAnimation();
    const isReady = await runSetupWizard(false);
    if (isReady) {
        await startChat(AgentMode.NORMAL);
    }
});

program.command('start')
  .description('Start the VENOM Telegram Gateway')
  .action(() => {
      if (!process.env.TELEGRAM_BOT_TOKEN) {
          console.log('Telegram is not configured. Run `venom setup --force` and enable Telegram if you want to use it.');
          return;
      }

      console.log('Initializing VENOM Orchestrator...');
      const orchestrator = buildOrchestrator();
      const gateway = new VenomTelegramGateway(orchestrator);
      gateway.start();
      process.once('SIGINT', () => gateway.stop('SIGINT'));
      process.once('SIGTERM', () => gateway.stop('SIGTERM'));
  });

program.command('doctor')
  .description('Validate Provider Connections')
  .action(async () => {
      const providerManager = new VenomProviderManager();
      const results = await providerManager.validateProviders();
      console.log('VENOM Provider Status:');
      results.forEach(res => {
          console.log(`- ${res.provider}: ${res.isValid ? 'ACTIVE' : `FAILED (${res.error})`}`);
      });
  });

program.command('setup')
  .description('Create or update the global VENOM settings.json')
  .option('-f, --force', 'Overwrite existing settings')
  .action(async (options) => {
      await runSetupWizard(Boolean(options.force));
  });

program.command('init')
  .description('Alias for setup')
  .action(async () => {
      await runSetupWizard(false);
  });

program.command('chat')
  .description('Start interactive CLI chat')
  .option('-m, --mode <mode>', 'Agent mode: NORMAL, FABLE5, FABLEFOFF', 'NORMAL')
  .action(async (options) => {
      const isReady = await runSetupWizard(false);
      if (!isReady) return;
      const mode = AgentMode[options.mode as keyof typeof AgentMode] || AgentMode.NORMAL;
      await startChat(mode);
  });

program.command('shell')
  .description('Execute a raw shell command via VENOM runtime')
  .argument('<cmd...>', 'Command to execute')
  .action(async (cmdParts) => {
      const cmd = cmdParts.join(' ');
      const runtime = new VenomShellRuntime();
      try {
          console.log(await runtime.executeCommand(cmd));
      } catch (e: any) {
          console.error(e);
      }
  });

program.command('memory')
  .description('Clear working memory')
  .action(() => {
      const wm = new VenomWorkingMemory();
      wm.clear();
      console.log('VENOM Working Memory cleared.');
  });

program.command('clear')
  .description('Flushes all API keys completely without modifying your other code or settings')
  .action(() => {
      const settings = readVenomSettings();
      if (settings) {
          settings.providers.groqApiKey = '';
          settings.providers.openRouterApiKey = '';
          settings.providers.nvidiaNimApiKey = '';
          if (settings.telegram) {
              settings.telegram.botToken = '';
          }
          writeVenomSettings(settings);
          console.log('\n\x1b[1m\x1b[32m✔ All API keys have been completely flushed from your settings.\x1b[0m\n');
      } else {
          console.log('\n\x1b[31mNo settings file found. Nothing to clear.\x1b[0m\n');
      }
  });

program.command('provider')
  .description('Check provider keys from environment')
  .action(() => {
      console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Set' : 'Missing');
      console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'Set' : 'Missing');
      console.log('NVIDIA_NIM_API_KEY:', process.env.NVIDIA_NIM_API_KEY ? 'Set' : 'Missing');
  });

program.command('models')
  .description('List configured models per agent')
  .action(() => {
      console.log(`Main Agent: ${process.env.VENOM_MAIN_MODEL ?? 'meta/llama-3.1-8b-instruct'} (NVIDIA NIM)`);
      console.log(`Planning Agent: ${process.env.VENOM_PLANNING_MODEL ?? 'nvidia/nemotron-4-340b-instruct'} (OpenRouter)`);
      console.log(`Coding Agent: ${process.env.VENOM_CODING_MODEL ?? 'moonshotai/moonshot-v1-8k'} (OpenRouter)`);
      console.log(`Multi-Purpose Agent: ${process.env.VENOM_MULTIPURPOSE_MODEL ?? 'llama-3.1-70b-instruct'} (Groq)`);
  });

program.command('telemetry')
  .description('Toggle telemetry (thinking) mode on/off')
  .action(() => {
      console.log('To see execution stages, append "think=gs" to your input in chat or telegram.');
  });

program.command('agent')
  .description('List available VENOM agents')
  .action(() => {
      console.log('1. MainAgent (NVIDIA NIM)');
      console.log('2. PlanningAgent (OpenRouter)');
      console.log('3. CodingAgent (OpenRouter)');
      console.log('4. MultiPurposeAgent (Groq)');
  });

program.parse(process.argv);
