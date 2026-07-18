# Smelt — a `.card` file format for human-AI collaboration

> *This is an early, imperfect work by someone figuring things out as they go.*

---

## I'm a beginner

My name is Dalu Wang. I'm a third-year international trade student at Shanghai University of International Business and Economics. I can't write code. What you see here was built with an AI coding assistant (DeepSeek V4 Pro — not the most powerful model out there) over the course of one week.

I'm not a developer. I don't work at a tech company. I just spent a lot of time working with AI on a research paper, and at the end of it, I realized: **I had nothing to show for the process.** Chat logs. Scattered files. The thinking, the dead ends, the breakthroughs — all gone.

This is my attempt to answer one question: **what should human-AI collaboration output look like?**

---

## What is a `.card` file?

A `.card` file is an **open, portable container for human-AI collaboration output**. Think of it like `.docx` for Word documents, or `.ipynb` for Jupyter notebooks — but for the thing you and an AI create together.

It's a standard ZIP archive (rename to `.zip` and open it with anything) containing:

- **`manifest.json`** — metadata, file inventory with per-file SHA-256 hashes
- **`artifacts/`** — the actual files (data, reports, scripts, images)
- **`process.jsonl`** — every prompt, every tool call, the AI's full thinking trace
- **`edits.json`** — modification history: who changed what, when, and why
- **`signature.json`** — ECDSA P-256 cryptographic provenance chain

**This is an open format, not a platform.** Any application can read and write `.card` files. The format is documented and license-free (MPL 2.0). No vendor lock-in. No account required.

If you've ever used Jupyter notebooks, image Docker containers, or ZIP archives — `.card` follows the same philosophy. Simple structure. Transparent. Inspectable.

---

## Smelt: a reference implementation

Smelt is a **browser-based workspace** for working with `.card` files. It proves the format works.

**Quick start:**

```bash
cd app
npm install
npm run dev        # → http://localhost:5173
npx tsc --noEmit   # zero TypeScript errors, 42 source files
```

**What you can do:**

- **Drag files in** — CSV, Excel, Markdown, images, Python scripts, JSON — they become cards on an infinite canvas
- **Open a workbench** — double-click any card to start an AI conversation. Cards you add to the context zone are automatically injected into every prompt
- **Multi-model support** — 9 AI providers (OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Kimi, Qwen, Zhipu, Groq, custom), 3 native API protocols
- **Built-in tools for AI** — `card_read`, `card_create`, `card_update`, `card_tag`, `card_search`, `card_list`, plus `script_run` for executing tool cards in an isolated Web Worker sandbox
- **Three collaboration modes** — **pipeline** (serial steps: analyze → write → verify), **team** (parallel personas: skeptic + analyst + conservative), **orchestrator** (AI-directed task delegation)
- **Export as `.card`** — select cards, right-click, add metadata, optionally encrypt (AES-256-GCM) and sign (ECDSA P-256), download
- **Import `.card`** files — 4-step verification: unpack → security scan → signature validation → selective import
- **Provenance tracking** — every re-export appends a signature to the chain. Full modification history visible on import
- **Decentralized trust** — contact trust based on repeated encounters (not a central certificate authority). Each signer's key fingerprint is tracked locally
- **Bilingual** — full Chinese and English UI

## What's missing (honest list)

- No standalone `.card` packager yet — you need the space to export
- The workbench UI hasn't been tested on mobile
- No collaborative real-time editing
- Only JavaScript/Python-like scripts can run in the sandbox (no compiled languages)
- Card preview snapshots are PNG renders — not native file viewers for Excel or PDF
- I'm sure there are bugs I haven't found

## Architecture

```
foundation/   → shared types, internationalization
platform/     → storage (OPFS), settings (AES-encrypted API keys)
features/     → AI adapters, identity & signing, import, export, sandbox, snapshot generator, tool registry, collaboration modes, card templates
ui/           → canvas, cards, dock, packs, workbench, panels, dialogs, shared components
```

Four-layer unidirectional dependency. Only `platform/storage.ts` touches the filesystem (Origin Private File System). Everything runs in the browser — no backend server.

## Why this exists

There are at least 8 similar projects (CLAN, Capsules, AGX, PromptPack, etc.) — all built by developers, for developers. None of them ask: "What would this look like for a student who just needs to analyze a spreadsheet and share the result?"

I am that student. I didn't write a single line of this code — but I defined every interaction, every animation frame, every design decision. The AI executed. The human defined. The output is open.

## Search-friendly keywords

`.card` file format · human-AI collaboration format · AI workbench · portable AI output · open file standard · agent session format · AI provenance · browser-based workspace · TypeScript · OPFS · ZIP-based container · ECDSA signing · AES-GCM encryption · multi-model AI · AI pipeline · AI team mode · tool calling · Web Worker sandbox · card-based UI · infinite canvas

## License

MPL 2.0 — the format specification is open; implementations in any programming language are welcome.

---

*Built by [@Che-A-Lu](https://github.com/Che-A-Lu) (Dalu Wang), Shanghai, July 2026*
*Read this in Chinese: [README_ZH.md](README_ZH.md)*
