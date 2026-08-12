/**
 * Geo-Land — Cloudflare Worker: Gemini open-question grader
 *
 * Secret (Settings → Variables and secrets):
 *   GEMINI_API_KEY  — required (type: Secret)
 *
 * Optional vars:
 *   GEMINI_MODEL
 *   ALLOWED_ORIGINS  — comma-separated
 */

const DEFAULT_ORIGINS = [
  "https://yerkebulat.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
];

function getKey(env) {
  // Support a few name variants people accidentally use
  const raw =
    (env && env.GEMINI_API_KEY) ||
    (env && env.GEMINI_KEY) ||
    (env && env.GOOGLE_API_KEY) ||
    "";
  return String(raw || "").trim();
}

function corsHeaders(origin, env) {
  const allowed = String((env && env.ALLOWED_ORIGINS) || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const list = allowed.length ? allowed : DEFAULT_ORIGINS;
  const ok = origin && list.some((o) => origin === o || origin.startsWith(o));
  const allowOrigin = ok ? origin : list[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
      ...corsHeaders(origin, env || {}),
    },
  });
}

const SYSTEM_PROMPT = `You are a strict but fair geography olympiad grader for NIS students in Kazakhstan.
Grade student answers using: the question text, optional model answers, optional rubrics, and standard geography knowledge when no model answer is given.
Image URLs may be attached to questions — if listed, assume the student could see that image; grade accordingly from their written answer (you cannot view the image pixels).
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
- If modelAnswer is missing or "(none…)", still grade fairly using olympiad standards.
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

async function handleRequest(request, env) {
  const origin = request.headers.get("Origin") || "";
  env = env || {};

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
  }

  if (request.method === "GET") {
    const key = getKey(env);
    let bindingNames = [];
    try {
      bindingNames = Object.keys(env || {});
    } catch {
      bindingNames = [];
    }
    return json(
      {
        service: "geo-land-gemini-grade",
        ok: true,
        hasGeminiKey: Boolean(key),
        bindingNames,
      },
      200,
      origin,
      env
    );
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, origin, env);
  }

  const apiKey = getKey(env);
  if (!apiKey) {
    let bindingNames = [];
    try {
      bindingNames = Object.keys(env || {});
    } catch {
      bindingNames = [];
    }
    return json(
      {
        ok: false,
        error: "missing_server_key",
        hint: "In Cloudflare Worker → Settings → Variables and secrets, add Secret named GEMINI_API_KEY, paste key, Save and deploy. Then hard-refresh.",
        bindingNames,
      },
      500,
      origin,
      env
    );
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
  if (tasks.length > 40) {
    return json({ ok: false, error: "too_many_tasks" }, 400, origin, env);
  }

  // Prefer env override; try several free-tier Flash names (2.0 was shut down mid-2026)
  const preferred = env.GEMINI_MODEL || body.model || "";
  const modelCandidates = [
    preferred,
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-flash-latest",
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  const userPayload = JSON.stringify({ tasks });
  const requestBody = {
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
  };

  try {
    let gemRes = null;
    let usedModel = modelCandidates[0];
    let lastStatus = 0;
    let lastErr = "";

    for (const model of modelCandidates) {
      usedModel = model;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;
      gemRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (gemRes.ok) break;
      lastStatus = gemRes.status;
      lastErr = (await gemRes.text()).slice(0, 300);
      console.error("Gemini model fail", model, lastStatus, lastErr);
      // try next model on 404 (model not found / shut down)
      if (lastStatus !== 404) break;
      gemRes = null;
    }

    if (!gemRes || !gemRes.ok) {
      return json(
        {
          ok: false,
          error: "gemini_http_" + (lastStatus || 502),
          hint:
            lastStatus === 400 || lastStatus === 403
              ? "Check GEMINI_API_KEY is valid in AI Studio."
              : lastStatus === 404
                ? "No working Gemini model name. Set Worker var GEMINI_MODEL to a model from AI Studio."
                : undefined,
          detail: lastErr || undefined,
          triedModels: modelCandidates,
        },
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
    result.model = usedModel;
    return json(result, 200, origin, env);
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: "gemini_network" }, 502, origin, env);
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
};
