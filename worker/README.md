# waf-docs-chat-proxy

Cloudflare Worker that proxies chat questions from the docs site to Gemini,
so the `GEMINI_API_KEY` never has to live in client-side JavaScript (GitHub
Pages has no server, so the key would otherwise be visible to anyone via
view-source / the Network tab).

Deployed at: **https://waf-docs-chat-proxy.cloudflaretestt.workers.dev**

## What it does

`POST /chat` with `{ message, history }` → forwards to Gemini
(`gemini-flash-lite-latest`) with a system instruction grounded in the
site's own content (`src/knowledge.js`) → returns `{ reply }`.

- CORS locked to `https://jakkaret.github.io` (see `ALLOWED_ORIGINS` in `src/index.js`)
- Rate limited to 8 requests/60s per client IP (native Workers Rate Limiting binding — the real abuse control, since CORS alone doesn't stop a direct/non-browser caller)
- Message length capped at 600 chars, output capped at 500 tokens
- Never echoes the Gemini API key or raw upstream error bodies back to the client

## One-time setup — run this yourself

The Gemini key should never pass through chat/AI tooling — set it directly:

```bash
cd worker
npx wrangler secret put GEMINI_API_KEY
# paste your Gemini API key when prompted, press Enter
```

That's the only manual step. The Worker is already deployed; this just
activates it (until the secret is set, `/chat` will 502 with "Gemini API
error").

## Redeploying after code changes

```bash
cd worker
npx wrangler deploy
```

(Already authenticated on this machine via `wrangler login` — Cloudflare account jakkares01@gmail.com.)

## Local dev

```bash
cd worker
cp .dev.vars.example .dev.vars   # then fill in your key
npx wrangler dev
```

## Updating the knowledge base

`src/knowledge.js` is a condensed summary of every page on the docs site,
written by hand — not auto-generated from the HTML. When site content
changes materially (new page, corrected numbers, resolved findings), update
this file to match and redeploy, or the chatbot will answer from stale
facts.

## Cost / quota notes

- Gemini `gemini-flash-lite-latest` is the cheapest current model and matches what the WAF project's own backend uses.
- Rate limiting bounds worst-case cost to 8 req/min per IP regardless of traffic.
- Cloudflare Workers free tier: 100,000 requests/day — far more than this site needs.
