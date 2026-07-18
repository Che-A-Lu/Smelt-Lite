# Smelt

> A .card format and reference implementation for human-AI collaboration output. Not a platform — a language.

## What problem does this solve?

You spent an afternoon working with AI: prompts, tool calls, thinking traces, generated files. What do you have to show for it? A chat log in a conversation window. Some scattered files. The *process* — every discarded direction, every breakthrough, every design decision — is gone.

Code has GitHub. Writing has blogs. Designs have Figma. But human-AI collaboration has no standard container, no way to value, circulate, or inherit what was created.

Smelt answers this question: **what should human-AI output look like?**

## .card: a new kind of file

A `.card` file is a ZIP archive containing:

- `manifest.json` — metadata, file hashes, author signature
- `artifacts/` — the actual files (data, reports, scripts)
- `process.jsonl` — every prompt, tool call, and AI response
- `edits.json` — modification history (who changed what and why)
- `signature.json` — cryptographic provenance chain (ECDSA P-256)

Rename it to `.zip` and you can see everything inside. The format is open — any language can read and write it. No platform lock-in.

## Smelt: reference implementation

A thin browser-based space that interprets `.card` files. It doesn't build features — it renders cards and passes events.

### Quick start

```bash
cd app
npm install
npm run dev        # → http://localhost:5173
npx tsc --noEmit   # zero errors
```

### What it does

- **Drag files in** — Excel, Markdown, CSV, images, scripts — everything becomes a card
- **Open a workbench** — double-click a card, start chatting with AI. Context cards are auto-injected
- **Multi-model** — 9 providers, 3 native protocols (OpenAI, Anthropic Messages, Gemini)
- **Built-in tools** — `card_read`, `card_create`, `card_update`, `card_tag`, `card_search`, `card_list`
- **Script sandbox** — tool cards run in Web Workers. No DOM, no network, no filesystem access
- **Three collaboration modes** — pipeline (serial steps), team (parallel personas), orchestrator (AI-directed delegation)
- **Export** — right-click cards → package as `.card` → edit metadata, scan privacy, encrypt (AES-256-GCM), sign (ECDSA P-256), download
- **Import** — four-step verification: unpack → security check → signature validation → select contents
- **Provenance chain** — every re-export appends a signature. Full modification history visible on import
- **Trust network** — decentralized contact trust based on repeated encounters, not central authority
- **Bilingual** — Chinese and English throughout

### Architecture

```
foundation/   → types, i18n
platform/     → storage (OPFS), settings (AES-encrypted API keys)
features/     → ai, identity, import, export, sandbox, snapshot, tool-registry, mode, templates
ui/           → canvas, card, dock, pack, workbench, panels, dialogs, components
```

Four-layer unidirectional dependency. Only `platform/storage.ts` touches the filesystem.

## Why this matters

I'm not a CS PhD. I built this with a university laptop and an AI model that isn't even the best one available. I didn't write a single line of code — but I defined every interaction, every design decision, every frame of animation.

The .card format and Smelt prove one thing: **in human-AI collaboration, the definer doesn't need to be the executor.** What matters is being able to say: this is what it should feel like. This is what should happen when you drag a card onto a dock. This is how trust between strangers should work.

The code was written by AI. The thinking was human. The output is open.

## License

MPL 2.0 — the spec is open; implementations in any language are welcome.

---

Built by [@Che-A-Lu](https://github.com/Che-A-Lu) (Dalu Wang), Shanghai, July 2026.
