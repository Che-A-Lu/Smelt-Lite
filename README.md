# Smelt — `.card` file format for human-AI output

> Smelt doesn't compete with ChatGPT. Smelt harvests your conversations — from any AI tool — and turns them into portable `.card` files you own, edit, and share.

---

## What is this?

A **`.card` file** is a standard ZIP archive containing your full AI collaboration: every prompt, every tool call, the AI's thinking traces, all generated files, modification history, and cryptographic signatures. Rename it to `.zip` and open it with anything. The format is open (MPL 2.0) — any application can read and write it.

**This repository** contains two things:

1. The **`.card` format specification** (`FORMAT.md`) — a standalone document anyone can implement
2. The **reference implementation** (`app/`) — a browser-based workspace that proves the format works end to end

This browser version is not the product. It is the first codebase — the prototype that let us design, test, and validate every interaction. The real delivery vehicle will be a Chrome extension that adds a "Save as .card" button directly into ChatGPT, Claude, Kimi, and other AI tools.

---

## Quick start

```bash
cd app
npm install
npm run dev        # → http://localhost:5173
npx tsc --noEmit   # zero errors, 42 source files
```

---

## What the reference implementation does

- **Infinite canvas** — drag files in, get cards. Cards have physics. Dock them to activate
- **Workbench** — double-click a card to chat with AI. Context cards auto-injected. Built-in tools
- **Multi-model** — 9 providers, 3 native protocols (OpenAI, Anthropic Messages, Gemini)
- **Export** — select cards → right-click → package as `.card` (AES-256-GCM encryption, ECDSA P-256 signing, per-file SHA-256 hashes)
- **Import** — drag a `.card` in → 4-step verification → cards appear, provenance chain visible
- **Three collaboration modes** — pipeline (serial steps), team (parallel personas), orchestrator (AI-directed delegation)
- **Bilingual** — Chinese and English

## Architecture

```
foundation/ → types, i18n
platform/   → storage, settings
features/   → AI adapters, identity, import/export, sandbox, snapshots, tools, modes
ui/         → canvas, cards, dock, packs, workbench, panels
```

Four-layer unidirectional dependency. Only `platform/storage.ts` touches the filesystem.

## What this isn't (yet)

- Not a Chrome extension — you can't install it and press "Save as .card" inside ChatGPT
- Not a desktop app — no PWA/Tauri wrapper yet
- No mobile support — browser-only on desktop
- The UX is still rough — you will find bugs

## Where this is going

**Phase 1**: Chrome extension (Smelt-Lite). A floating canvas that opens on any AI chat page. Parse the conversation, visualize as cards, edit, export — without leaving the page.

**Phase 2**: Tauri desktop app. Auto-monitor AI tool sessions in the background. A persistent space that feels like home.

**Phase 3**: A new kind of desktop. Where every AI tool runs on the Smelt canvas, and `.card` isn't something you export — it's the natural shape your work takes.

---

## Why this exists

I'm a college student. I'm not a developer. I built this with an AI coding assistant because I was frustrated by one thing: after spending hours working with AI on a research paper, I had nothing tangible to show for the process — no record of the thinking, no portable artifact, no way to share the work with someone else and let them continue.

Everyone is building better AI tools. Nobody is building the thing you take with you when you're done.

---

Built by [@Che-A-Lu](https://github.com/Che-A-Lu) (Dalu Wang), Shanghai, July 2026.
Read this in Chinese: [README_ZH.md](README_ZH.md)
