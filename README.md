# Smelt Lite — the starting point

> A static webpage. Drag files in, get cards. Select cards, download a `.card` file. Drag a `.card` back in, see what's inside. Thirty seconds. No install. No signup. No AI model.

---

## Use it now / 立刻用

Already working with AI? Here's the 30-second path from conversation to `.card`:

1. **[Copy a prompt →](prompts/)** Paste it into your AI conversation. The AI outputs structured JSON.
2. **[Open Smelt Lite →](https://che-a-lu.github.io/Smelt-Lite/)** Drag the JSON in. Add your files. Click pack.
3. **Download your `.card`.** Send it to someone. They drag it in and see everything.

No install. No account. No terminal.

---

## What is this?

**Smelt Lite** is the first, smallest piece of Smelt. It does exactly one thing: prove that the `.card` format works.

- Drag any file in → a card preview appears
- Select cards → fill in a name → download `.card`
- Drag a `.card` in → unpack it → see everything inside

That's it. No canvas. No AI. No workbench. ~13 source files, zero TypeScript errors.

## What's a `.card`?

A `.card` file is a standard ZIP archive. Inside: your files, the full collaboration process (every prompt, every tool call, the AI's thinking traces), modification history, and cryptographic signatures. Rename it to `.zip` and open it with anything.

The format is open (MPL 2.0). Any application can read and write it. Nobody owns it.

## Why this exists

After spending hours working with AI on a research paper, I had nothing tangible to show for the process — no record of the thinking, no portable artifact, no way to share the work with someone else and let them continue.

Everyone is building better AI tools. Nobody is building the thing you take with you when you're done.

**Smelt doesn't compete with AI tools. Smelt harvests your conversations — from any AI tool — and turns them into portable `.card` files you own.**

## Built by a definer, not a coder

This project was built by a non-CS college student. Not a single line was hand-written — every file was produced through conversation with AI. But the design decisions, the interaction spec, the format definition, the quality bar — those are human. The builder can explain the design rationale for every line of code, because the thinking is the work.

The previous version of Smelt grew to 47 files before being cut back to what matters. This is the humble restart.

## What this isn't

- Not an AI workbench
- Not a platform
- Not a Chrome extension (yet)
- Not a desktop app (yet)

## Where we're going

Smelt grows step by step, one `smelt-XX` at a time:

- **Smelt-Lite** ← you are here. Static webpage, define and validate `.card`
- **Smelt-Ext** — Chrome extension. One button on ChatGPT/Claude/Kimi, one click to `.card`
- **Smelt-Desk** — Desktop app. `.card` becomes a native file type. Double-click to open.

Each step is independently useful. None waits for the next.

## Try it

**Live site:** [che-a-lu.github.io/Smelt-Lite](https://che-a-lu.github.io/Smelt-Lite/)

**Run locally:**
```bash
npm install
npm run dev        # → http://localhost:5173
npx tsc --noEmit   # zero errors
```

## Author

Built by [@Che-A-Lu](https://github.com/Che-A-Lu), Shanghai, July 2026.

Read this in Chinese: [README_ZH.md](README_ZH.md)
