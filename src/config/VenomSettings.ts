import fs from 'fs';
import os from 'os';
import path from 'path';

export interface VenomSettings {
    version: number;
    providers: {
        groqApiKey?: string;
        openRouterApiKey?: string;
        nvidiaNimApiKey?: string;
    };
    models: {
        main: string;
        planning: string;
        coding: string;
        multipurpose: string;
    };
    telegram: {
        enabled: boolean;
        botToken?: string;
    };
}

export function getVenomSettingsDir(): string {
    return path.join(os.homedir(), '.venom');
}

export function getVenomSettingsPath(): string {
    return path.join(getVenomSettingsDir(), 'settings.json');
}

export function createDefaultVenomSettings(): VenomSettings {
    return {
        version: 1,
        providers: {},
        models: {
            main: 'meta/llama-3.1-8b-instruct',
            planning: 'nvidia/nemotron-4-340b-instruct',
            coding: 'moonshotai/moonshot-v1-8k',
            multipurpose: 'llama-3.1-70b-instruct'
        },
        telegram: {
            enabled: false
        }
    };
}

export function readVenomSettings(): VenomSettings | null {
    const settingsPath = getVenomSettingsPath();
    if (!fs.existsSync(settingsPath)) return null;

    const rawSettings = fs.readFileSync(settingsPath, 'utf-8');
    return {
        ...createDefaultVenomSettings(),
        ...JSON.parse(rawSettings)
    };
}

export function writeVenomSettings(settings: VenomSettings): void {
    fs.mkdirSync(getVenomSettingsDir(), { recursive: true });
    fs.writeFileSync(getVenomSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
}

export function loadVenomSettingsIntoEnv(): VenomSettings | null {
    const settings = readVenomSettings();
    if (!settings) return null;

    setEnvIfPresent('GROQ_API_KEY', settings.providers.groqApiKey);
    setEnvIfPresent('OPENROUTER_API_KEY', settings.providers.openRouterApiKey);
    setEnvIfPresent('NVIDIA_NIM_API_KEY', settings.providers.nvidiaNimApiKey);

    setEnvIfPresent('VENOM_MAIN_MODEL', settings.models.main);
    setEnvIfPresent('VENOM_PLANNING_MODEL', settings.models.planning);
    setEnvIfPresent('VENOM_CODING_MODEL', settings.models.coding);
    setEnvIfPresent('VENOM_MULTIPURPOSE_MODEL', settings.models.multipurpose);

    if (settings.telegram.enabled) {
        setEnvIfPresent('TELEGRAM_BOT_TOKEN', settings.telegram.botToken);
    }

    return settings;
}

export function hasConfiguredProvider(settings: VenomSettings | null = readVenomSettings()): boolean {
    return Boolean(
        process.env.GROQ_API_KEY ||
        process.env.OPENROUTER_API_KEY ||
        process.env.NVIDIA_NIM_API_KEY ||
        settings?.providers.groqApiKey ||
        settings?.providers.openRouterApiKey ||
        settings?.providers.nvidiaNimApiKey
    );
}

function setEnvIfPresent(name: string, value?: string) {
    if (!process.env[name] && value && value.trim().length > 0) {
        process.env[name] = value.trim();
    }
}
