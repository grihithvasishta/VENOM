export enum AgentMode {
  NORMAL = 'NORMAL',
  FABLE5 = 'FABLE5', // Full Agent Mode
  FABLEFOFF = 'FABLEFOFF' // Direct Mode
}

export interface VenomMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface VenomTask {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export interface ProviderValidationResult {
  provider: string;
  isValid: boolean;
  error?: string;
}

export type VenomToolCall =
  | { action: 'write_file'; filepath: string; content: string }
  | { action: 'run_command'; command: string }
  | { action: 'navigate_browser'; url: string }
  | { action: 'extract_browser_text' };

export interface VenomToolExecutionPolicy {
  allowFileWrites: boolean;
  allowShellCommands: boolean;
  allowBrowserNavigation: boolean;
  maxToolCallsPerStep: number;
}

export interface VenomToolExecutionResult {
  call: VenomToolCall;
  success: boolean;
  output: string;
}
