import { SYSTEM_INSTRUCTION } from "./knowledge.js";

// Only these origins may call this Worker from a browser. Direct
// (non-browser) callers can still bypass CORS, which is why the rate
// limit binding below is the real abuse control, not this check.
const ALLOWED_ORIGINS = new Set([
  "https://jakkaret.github.io",
]);

const GEMINI_MODEL = "gemini-flash-lite-latest";
const MAX_MESSAGE_CHARS = 600;
const MAX_HISTORY_TURNS = 8; // user+model pairs kept from the client
const MAX_OUTPUT_TOKENS = 500;

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (turn) =>
        turn &&
        (turn.role === "user" || turn.role === "model") &&
        typeof turn.text === "string" &&
        turn.text.length > 0 &&
        turn.text.length <= MAX_MESSAGE_CHARS
    )
    .slice(-MAX_HISTORY_TURNS * 2)
    .map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }));
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/chat" || request.method !== "POST") {
      return json({ error: "not found" }, 404, origin);
    }

    if (!ALLOWED_ORIGINS.has(origin)) {
      return json({ error: "origin not allowed" }, 403, origin);
    }

    // Rate limit per client IP — the real abuse control, since CORS alone
    // does not stop a direct (non-browser) caller.
    const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
    const { success: withinLimit } = await env.CHAT_RATE_LIMITER.limit({ key: clientIp });
    if (!withinLimit) {
      return json(
        { error: "ถามถี่เกินไป รอสักครู่แล้วลองใหม่" },
        429,
        origin
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON body" }, 400, origin);
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return json({ error: "message is required" }, 400, origin);
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return json(
        { error: `ข้อความยาวเกินไป (จำกัด ${MAX_MESSAGE_CHARS} ตัวอักษร)` },
        400,
        origin
      );
    }

    const contents = [
      ...sanitizeHistory(body.history),
      { role: "user", parts: [{ text: message }] },
    ];

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

    let geminiResp;
    try {
      geminiResp = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: { text: SYSTEM_INSTRUCTION } },
          contents,
          tools: [{ googleSearch: {} }],
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            temperature: 0.3,
          },
        }),
      });
    } catch (err) {
      return json({ error: "เรียก Gemini ไม่สำเร็จ (network)" }, 502, origin);
    }

    if (!geminiResp.ok) {
      const status = geminiResp.status;
      // Don't leak upstream error bodies (may contain request echoes) to the client.
      return json(
        { error: `Gemini API error (status ${status})` },
        502,
        origin
      );
    }

    const data = await geminiResp.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      const blockReason = data?.promptFeedback?.blockReason;
      return json(
        {
          error: blockReason
            ? `คำถามถูกบล็อกโดยตัวกรองเนื้อหา (${blockReason})`
            : "ไม่ได้รับคำตอบจาก Gemini",
        },
        502,
        origin
      );
    }

    return json({ reply }, 200, origin);
  },
};
