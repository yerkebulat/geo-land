/**
 * Geo-Land — Cloudflare Worker: Gemini open-question grader
 *
 * Secrets (wrangler secret put / Dashboard → Settings → Variables):
 *   GEMINI_API_KEY   — required
 *
 * Optional vars:
 *   GEMINI_MODEL     — default gemini-2.0-flash
 *   ALLOWED_ORIGINS  — comma-separated, default includes github.io + localhost
 */

const DEFAULT_ORIGINS = [
  "https://yerkebulat.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
];

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const list = allowed.length ? allowed : DEFAULT_ORIGINS;
  const ok = origin && list.some((o) => origin === o || origin.startsWith(o));
  const allowOrigin = ok ? origin : list[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, status, origin, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin, env),
    },
  });
}

const SYSTEM_PROMPT = `You are a strict but fair geography olympiad grader for NIS students in Kazakhstan.
Grade student answers against model answers and rubrics.
Respond ONLY with valid JSON (no markdown fences) of this shape:
{
  "questions": [
    {
      "id": "o1",
      "score": 0,
      "max": 3,
      "feedback": "short feedback in the same language as the student answer (prefer Kazakh if mixed)"
    }
  ],
  "totalScore": 0,
  "totalMax": 30,
  "summary": "one short overall sentence"
}
Rules:
- score must be a number between 0 and max (half points allowed: 0.5, 1.5, …).
- Empty answers score 0.
- Partial credit when partially correct.
- Do not invent facts beyond the model answer/rubric.
- Be consistent and concise in feedback (max 2 sentences each).`;

function parseModelJson(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeGrades(parsed, tasks) {
  const perQuestion = {};
  let total = 0;
  let maxTotal = 0;
  for (const q of tasks) {
    const max = Number(q.points) || 1;
    maxTotal += max;
    const hit = (parsed.questions || []).find((x) => x.id === q.id);
    let score = hit ? Number(hit.score) : 0;
    if (Number.isNaN(score)) score = 0;
    score = Math.max(0, Math.min(max, score));
    score = Math.round(score * 2) / 2;
    total += score;
    perQuestion[q.id] = {
      score,
      max,
      feedback: (hit && hit.feedback) || "",
      ai: true,
    };
  }
  return {
    ok: true,
    perQuestion,
    totalScore: Math.round(total * 2) / 2,
    maxScore: maxTotal,
    summary: parsed.summary || "",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (request.method === "GET") {
      return json(
        { service: "geo-land-gemini-grade", ok: true },
        200,
        origin,
        env
      );
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405, origin, env);
    }

    if (!env.GEMINI_API_KEY) {
      return json({ ok: false, error: "missing_server_key" }, 500, origin, env);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400, origin, env);
    }

    const tasks = body.tasks;
    if (!Array.isArray(tasks) || !tasks.length) {
      return json({ ok: false, error: "missing_tasks" }, 400, origin, env);
    }

    // soft size guard
    if (tasks.length > 40) {
      return json({ ok: false, error: "too_many_tasks" }, 400, origin, env);
    }

    const model = env.GEMINI_MODEL || body.model || "gemini-2.0-flash";
    const userPayload = JSON.stringify({ tasks });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

    try {
      const gemRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: SYSTEM_PROMPT + "\n\nSTUDENT WORK:\n" + userPayload }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!gemRes.ok) {
        const errText = await gemRes.text();
        console.error("Gemini error", gemRes.status, errText.slice(0, 500));
        return json(
          { ok: false, error: "gemini_http_" + gemRes.status },
          502,
          origin,
          env
        );
      }

      const data = await gemRes.json();
      const raw =
        (data.candidates &&
          data.candidates[0] &&
          data.candidates[0].content &&
          data.candidates[0].content.parts &&
          data.candidates[0].content.parts.map((p) => p.text).join("")) ||
        "";

      const parsed = parseModelJson(raw);
      if (!parsed || !Array.isArray(parsed.questions)) {
        return json({ ok: false, error: "gemini_parse" }, 502, origin, env);
      }

      const result = normalizeGrades(parsed, tasks);
      result.model = model;
      return json(result, 200, origin, env);
    } catch (e) {
      console.error(e);
      return json({ ok: false, error: "gemini_network" }, 502, origin, env);
    }
  },
};
