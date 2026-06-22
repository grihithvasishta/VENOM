<p align="center">
  <a href="/grihithvasishta/VENOM/blob/main/assets/logo.svg">
    <img src="https://github.com/grihithvasishta/VENOM/raw/main/assets/logo.svg" alt="VENOM Logo" />
  </a>
</p>

# VENOM AI Operating System

**A Telegram-native, multi-agent AI operating system distributed as a TypeScript npm package.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518.0.0-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](https://github.com/grihithvasishta/VENOM/blob/main/LICENSE)

---

## Overview

VENOM is a proprietary orchestration platform built from the ground up rather than on top of an existing agent framework. There's no LangChain or AutoGen underneath it. Instead, VENOM runs its own coordination engine directly on your machine and exposes it through a Telegram client and a CLI.

The pitch is simple: most agent frameworks make you fight their abstractions to get predictable behavior. VENOM skips the abstraction layer and gives you direct control over routing, memory, and execution.

### Key Features

- **Multi-agent orchestration** — dedicated Router, Planner, Coordinator, Scheduler, and Validator engines, each responsible for one part of the pipeline instead of one model doing everything.
- **Four-tier memory system** — backed by `better-sqlite3`, split into Working Memory, Project Memory, Learning Memory, and a Knowledge Graph, so short-term context and long-term project history don't get mixed together.
- **Local execution environment** — agents can write files, run shell commands, and drive a real browser through Puppeteer, all on your machine.
- **Telegram-native interface** — trigger code generation and system queries from your phone, not just a terminal.
- **CLI-first** — a full terminal application for anyone who'd rather not leave the command line.
- **Dynamic writing personas** — JSONL-based persona files in `writing-assistant/` let agents swap tone and instruction sets without touching code.

---

## Model Architecture

VENOM routes specific tasks to specific models rather than sending everything through one generalist model. This keeps cost down and lets each agent specialize.

| Agent | Provider | Model | Responsibilities |
|---|---|---|---|
| **MainAgent** | Groq | Llama 3.3 8B Instruct | Conversation, routing, tool invocation |
| **PlanningAgent** | OpenRouter | NVIDIA Nemotron Ultra | Architecture, task decomposition |
| **CodingAgent** | NVIDIA NIM | Kimi K2.6 (Moonshot) | Code generation, refactoring, execution |
| **MultiPurposeAgent** | Groq | Llama 70B Versatile | Validation, synthesis, technical review |

### Next-Gen Routing & MCP Integration (Upcoming)

A few changes are in progress to cut latency and token cost further:

- **Zero-shot intent routing** — local embeddings classify intent (`Chat`, `Code`, `System`) in milliseconds, before the orchestration layer spins up at all, instead of relying on a full LLM call to decide what kind of request just came in.
- **Lazy context hydration** — the four-tier memory system loads into the prompt only after the Router decides it's actually needed, rather than on every request by default.
- **Model Context Protocol (MCP)** — heavy tools like Puppeteer and shell execution move into isolated, lazy-loaded MCP servers, with tool schemas fetched on demand so the Main Agent's context window stays small and cheap to run.

---

## Installation

Requires Node.js 18 or later.

**Most users:**
```bash
npm install -g venom
venom
```

The first `venom` run opens a setup wizard and saves your keys to `~/.venom/settings.json`. Telegram is optional, you can skip it during setup and enable it later:

```bash
venom setup --force
```

**Local development from this repo:**
```bash
npm install
npm install -g .
venom
```

**Useful commands:**
```bash
venom          # launch interactive mode
venom setup    # run the setup wizard again
venom doctor   # check API provider connections
venom chat     # enter the interactive AI terminal
venom start    # start the Telegram gateway
```

**Environment variables:**
```bash
cp .env.example .env
```

Then fill in:

- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `NVIDIA_NIM_API_KEY`
- `TELEGRAM_BOT_TOKEN`

---

## Usage

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

- `/fable5` — Full Agent Mode. Spins up Planner, Coder, and Validator agents to decompose and execute complex tasks.
- `/fableoff` — Direct Mode. Only the Main Agent responds, skipping orchestration for speed.
- `think=gs` — append to any message to enable execution telemetry, showing Router, Planner, and Coordinator state in real time.

### Writing Assistant & Personas

The `writing-assistant/` directory holds a persona system. Loading one of these JSONL files lets an agent adopt a specific role, tone, and rule set before generating a response:

- `instructions.jsonl` — general, natural-sounding writing
- `coding_assistant.jsonl`
- `customer_support.jsonl`
- `marketing_copywriter.jsonl`

### Package API

```typescript
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

## Testing

VENOM uses the native Node.js test runner with mocked API providers, so the suite runs without hitting real endpoints or burning API credits.

```bash
npm run test
```

---

## Privacy & Data

VENOM runs entirely locally. All SQLite memory databases (`*.db`) are excluded via `.gitignore` and never pushed or stored remotely. Your conversation history and project memory stay on your machine.

---

## Contributing

This is currently a solo project in active development. Issues and feature suggestions are welcome; expect the architecture (particularly the MCP migration) to shift as it stabilizes.

---

<p align="center"><em>Built entirely in TypeScript. No third-party agent frameworks.</em></p>