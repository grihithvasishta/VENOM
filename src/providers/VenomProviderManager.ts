import Groq from 'groq-sdk';
import { OpenAI } from 'openai';
import { ProviderValidationResult } from '../shared/types';
import dotenv from 'dotenv';

dotenv.config();

export class VenomProviderManager {
  private groqClient: Groq | null = null;
  private openRouterClient: OpenAI | null = null;
  private nimClient: OpenAI | null = null;

  constructor() {
    if (process.env.GROQ_API_KEY) {
      this.groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    if (process.env.OPENROUTER_API_KEY) {
      this.openRouterClient = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/venom/core',
          'X-Title': 'VENOM Core',
        },
      });
    }
    if (process.env.NVIDIA_NIM_API_KEY) {
      this.nimClient = new OpenAI({
        baseURL: 'https://integrate.api.nvidia.com/v1',
        apiKey: process.env.NVIDIA_NIM_API_KEY,
      });
    }
  }

  async validateProviders(): Promise<ProviderValidationResult[]> {
    const results: ProviderValidationResult[] = [];

    // Validate Groq
    if (this.groqClient) {
      try {
        await this.groqClient.models.list();
        results.push({ provider: 'Groq', isValid: true });
      } catch (e: any) {
        results.push({ provider: 'Groq', isValid: false, error: e.message });
      }
    } else {
        results.push({ provider: 'Groq', isValid: false, error: 'Missing API Key' });
    }

    // Validate OpenRouter
    if (this.openRouterClient) {
      try {
        await this.openRouterClient.models.list();
        results.push({ provider: 'OpenRouter', isValid: true });
      } catch (e: any) {
        results.push({ provider: 'OpenRouter', isValid: false, error: e.message });
      }
    } else {
        results.push({ provider: 'OpenRouter', isValid: false, error: 'Missing API Key' });
    }

    // Validate NVIDIA NIM
    if (this.nimClient) {
      try {
        await this.nimClient.models.list();
        results.push({ provider: 'NVIDIA NIM', isValid: true });
      } catch (e: any) {
        results.push({ provider: 'NVIDIA NIM', isValid: false, error: e.message });
      }
    } else {
        results.push({ provider: 'NVIDIA NIM', isValid: false, error: 'Missing API Key' });
    }

    return results;
  }

  async generateGroqCompletion(model: string, messages: any[]): Promise<string> {
    if (!this.groqClient) throw new Error('Groq provider inactive');
    const response = await this.groqClient.chat.completions.create({
      model,
      messages,
    });
    return response.choices[0]?.message?.content || '';
  }

  async generateOpenRouterCompletion(model: string, messages: any[]): Promise<string> {
    if (!this.openRouterClient) throw new Error('OpenRouter provider inactive');
    const response = await this.openRouterClient.chat.completions.create({
      model,
      messages,
    });
    return response.choices[0]?.message?.content || '';
  }

  async generateNimCompletion(model: string, messages: any[]): Promise<string> {
      if (!this.nimClient) throw new Error('NVIDIA NIM provider inactive');
      const response = await this.nimClient.chat.completions.create({
        model,
        messages,
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 1
      });
      return response.choices[0]?.message?.content || '';
  }

  async generateNimMainCompletion(model: string, messages: any[]): Promise<string> {
      if (!this.nimClient) throw new Error('NVIDIA NIM provider inactive');
      const response = await this.nimClient.chat.completions.create({
        model,
        messages,
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 1024,
      });
      return response.choices[0]?.message?.content || '';
  }
}
