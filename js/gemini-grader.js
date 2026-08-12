/**
 * Grade open-question answers via Cloudflare Worker (preferred) or direct Gemini.
 */
const GeminiGrader = {
  isConfigured() {
    const c = window.GEMINI_CONFIG;
    if (!c || !c.enabled) return false;
    if (c.mode === "worker") {
      return !!(
        c.workerUrl &&
        !c.workerUrl.includes("YOUR_SUBDOMAIN") &&
        c.workerUrl.startsWith("http")
      );
    }
    // direct (local only)
    return !!(c.apiKey && c.apiKey !== "YOUR_GEMINI_API_KEY");
  },

  _buildTasks(openTask, answers, lang) {
    const L = lang || (window.Lang && Lang.current) || "kk";
    return openTask.questions.map((q, i) => {
      let text = q.text;
      if (text && typeof text === "object") text = text[L] || text.kk || text.en || "";
      text = text || q.id;
      let model = q.modelAnswer;
      if (model && typeof model === "object") model = model[L] || model.kk || model.en || "";
      model = model || "";
      let rubric = q.rubric;
      if (rubric && typeof rubric === "object") rubric = rubric[L] || rubric.kk || rubric.en || "";
      rubric =
        rubric ||
        (model
          ? "Use model answer and partial credit."
          : "No model answer provided. Grade as a geography olympiad teacher using the question, standard geography knowledge, and the student answer. Give partial credit for partially correct work.");
      const student = (answers[q.id] || "").trim();
      return {
        id: q.id,
        index: i + 1,
        points: q.points || 1,
        question: text,
        imageUrl: q.imageUrl || "",
        modelAnswer: model || "(none — grade from question + geography knowledge)",
        rubric,
        studentAnswer: student || "(empty)",
      };
    });
  },

  _normalizeFromParsed(parsed, openTask) {
    const perQuestion = {};
    let total = 0;
    let maxTotal = 0;
    openTask.questions.forEach((q) => {
      maxTotal += q.points || 1;
      const hit = (parsed.questions || []).find((x) => x.id === q.id);
      const max = q.points || 1;
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
    });
    return {
      ok: true,
      perQuestion,
      totalScore: Math.round(total * 2) / 2,
      maxScore: maxTotal,
      summary: parsed.summary || "",
    };
  },

  async gradeOpenSet(openTask, answers, lang) {
    if (!this.isConfigured()) {
      return {
        ok: false,
        error: "gemini_not_configured",
        perQuestion: {},
        totalScore: null,
      };
    }

    const tasks = this._buildTasks(openTask, answers, lang);
    const cfg = window.GEMINI_CONFIG;

    if (cfg.mode === "worker") {
      return this._gradeViaWorker(tasks, openTask, cfg);
    }
    return this._gradeDirect(tasks, openTask, cfg);
  },

  async _gradeViaWorker(tasks, openTask, cfg) {
    const base = String(cfg.workerUrl).replace(/\/$/, "");
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks, model: cfg.model || "gemini-2.0-flash" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        console.error("Worker grade error", res.status, data);
        return {
          ok: false,
          error: data.error || "worker_http_" + res.status,
          perQuestion: {},
          totalScore: null,
        };
      }
      // Worker already normalized
      if (data.perQuestion) {
        return {
          ok: true,
          perQuestion: data.perQuestion,
          totalScore: data.totalScore,
          maxScore: data.maxScore != null ? data.maxScore : openTask.totalPoints,
          summary: data.summary || "",
          model: data.model || cfg.model,
        };
      }
      return {
        ok: false,
        error: "worker_bad_shape",
        perQuestion: {},
        totalScore: null,
      };
    } catch (e) {
      console.error(e);
      return { ok: false, error: "worker_network", perQuestion: {}, totalScore: null };
    }
  },

  async _gradeDirect(tasks, openTask, cfg) {
    const system = `You are a strict but fair geography olympiad grader for NIS students in Kazakhstan.
Grade student answers against model answers and rubrics.
Respond ONLY with valid JSON (no markdown fences) of this shape:
{
  "questions": [ { "id": "o1", "score": 0, "max": 3, "feedback": "..." } ],
  "totalScore": 0,
  "totalMax": 30,
  "summary": "one short overall sentence"
}
Rules: score 0..max, half points ok, empty=0, partial credit, concise feedback.`;

    const model = cfg.model || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: system + "\n\nSTUDENT WORK:\n" + JSON.stringify({ tasks }) }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });
      if (!res.ok) {
        return { ok: false, error: "gemini_http_" + res.status, perQuestion: {}, totalScore: null };
      }
      const data = await res.json();
      const raw =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
      const parsed = this._parseJson(raw);
      if (!parsed || !Array.isArray(parsed.questions)) {
        return { ok: false, error: "gemini_parse", perQuestion: {}, totalScore: null };
      }
      const result = this._normalizeFromParsed(parsed, openTask);
      result.model = model;
      return result;
    } catch (e) {
      console.error(e);
      return { ok: false, error: "gemini_network", perQuestion: {}, totalScore: null };
    }
  },

  _parseJson(raw) {
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
  },
};

window.GeminiGrader = GeminiGrader;
