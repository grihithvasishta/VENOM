<div align="center">
  <img src="assets/logo.svg" alt="VENOM Logo" width="200" />

  <h1>VENOM AI Operating System</h1>
  <p><strong>A Telegram-native, multi-agent AI operating system distributed as a TypeScript npm package.</strong></p>

  [![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
  [![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
</div>

---

## ⚡ Overview

**VENOM** is a proprietary, production-grade orchestration platform built completely from the ground up. It bypasses third-party agent frameworks (like LangChain or AutoGen) to deliver a streamlined, highly-optimized AI coordination engine directly to your local machine and Telegram client.

### Key Features

- 🧠 **Proprietary Multi-Agent Orchestration**: Router, Planner, Coordinator, Scheduler, and Validator engines.
- 💾 **Advanced 4-Tier Memory System**: Backed by `better-sqlite3`, includes Working Memory, Project Memory, Learning Memory, and Knowledge Graph.
- 🛠️ **Local Execution Environment**: Agents can autonomously write files, execute shell commands, and navigate browser instances using Puppeteer.
- 📱 **Telegram-Native Interface**: Manage complex code generation and system queries directly from your phone.
- 🚀 **CLI-First**: Powerful terminal application for power users.
- ✍️ **Dynamic Personas**: JSONL-based `writing-assistant` module to swap agent personalities and strict instruction sets on the fly.

---

## 🏗️ Model Architecture

VENOM coordinates specific models for dedicated tasks to maximize efficiency and reasoning capability:

| Agent | Provider | Model | Responsibilities |
|-------|----------|-------|------------------|
| **MainAgent** | Groq | Llama 3.3 8B Instruct | Normal conversation, routing, tool invocation |
| **PlanningAgent** | OpenRouter | NVIDIA Nemotron Ultra | Architecture, task decomposition |
| **CodingAgent** | NVIDIA NIM | Kimi K2.6 (Moonshot) | Code generation, refactoring, execution |
| **MultiPurposeAgent**| Groq | Llama 70B Versatile | Validation, synthesis, technical review |

### ⚡ Next-Gen Routing & MCP Integration (Upcoming)

To maximize resource efficiency and decoupling, VENOM is evolving its architecture:
- **Zero-Shot Intent Routing:** Bypassing heavy LLM inferences by using lightning-fast local embeddings to classify user intent (`Chat`, `Code`, `System`) in milliseconds before spinning up the orchestration layer.
- **Lazy Context Hydration:** The massive 4-tier memory is only loaded into the prompt context *after* the Router determines it is absolutely necessary.
- **Model Context Protocol (MCP):** Transitioning heavy tools (like Puppeteer and Shell execution) into isolated, lazy-loaded MCP servers. Tool schemas are fetched dynamically on-demand, keeping the Main Agent's context window pristine and token costs minimal.

---

## 🚀 Installation

Ensure you have Node.js 18+ installed.

For most users:

```bash
npm install -g venom
venom
```

The first `venom` run opens a setup wizard and saves your keys to:

```text
~/.venom/settings.json
```

Telegram is optional. You can skip it during setup and enable it later with:

```bash
venom setup --force
```

For local development from this repo:

```bash
npm install
npm install -g .
venom
```

Useful commands:

```bash
venom
venom setup
venom doctor
venom chat
venom start
```

Configure your environment variables:

```bash
cp .env.example .env
```

Add your API Keys to `.env`:
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `NVIDIA_NIM_API_KEY`
- `TELEGRAM_BOT_TOKEN`

---

## 💻 Usage

VENOM provides a robust CLI using the `venom` command.

```bash
# Link the package globally
npm link

# Start the Telegram Gateway
venom start

# Enter the interactive AI terminal
venom chat

# Validate API provider connections
venom doctor

# Clear working memory context
venom memory
```

### Telegram Commands

Interact with your bot on Telegram using these commands:

- `/fable5`: Activates **Full Agent Mode**. Planners, Coders, and Validators are spun up to decompose and execute complex tasks dynamically.
- `/fablefoff`: Activates **Direct Mode**. Only the Main Agent responds, skipping the orchestration layer for maximum speed.
- `think=gs`: Append this to any message to enable execution telemetry, allowing you to see the Router, Planner, and Coordinator states in real-time.

### Writing Assistant & Personas

VENOM includes a structured persona system located in the `writing-assistant/` directory. By loading these `.jsonl` files, agents dynamically adopt specific roles, rules, and tones before generating responses:
- `instructions.jsonl` (General natural writing)
- `coding_assistant.jsonl`
- `customer_support.jsonl`
- `marketing_copywriter.jsonl`

### Package API

```ts
import { AgentMode, createVenomOrchestrator } from 'venom';

const venom = createVenomOrchestrator({
  workspaceRoot: process.cwd(),
  executionPolicy: {
    allowFileWrites: true,
    allowShellCommands: true,
    allowBrowserNavigation: true,
    maxToolCallsPerStep: 3
  }
});

const response = await venom.execute('Create a small TypeScript utility', AgentMode.FABLE5);
console.log(response);
```

---

## 🧪 Testing

VENOM features a robust testing suite utilizing the native Node.js test runner and mocked API providers to ensure stability.

```bash
npm run test
```

---

## 🔒 Privacy & Data

VENOM is designed to run entirely locally. **Your data is your own.**
All SQLite memory databases (`*.db`) are strictly configured in `.gitignore` and are never pushed or stored remotely.

---
*Built entirely in TypeScript. No third-party frameworks. Pure VENOM.*
"# VENOM" 
