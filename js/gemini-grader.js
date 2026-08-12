/**
 * Grade open-question answers with Gemini Flash.
 * Returns per-question scores + feedback; teacher can override later.
 */
const GeminiGrader = {
  isConfigured() {
    const c = window.GEMINI_CONFIG;
    return !!(c && c.enabled && c.apiKey && c.apiKey !== "YOUR_GEMINI_API_KEY");
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

    const L = lang || (window.Lang && Lang.current) || "kk";
    const items = openTask.questions.map((q, i) => {
      const text = (q.text && (q.text[L] || q.text.kk || q.text.en)) || q.id;
      const model = (q.modelAnswer && (q.modelAnswer[L] || q.modelAnswer.kk || q.modelAnswer.en)) || "";
      const rubric = (q.rubric && (q.rubric[L] || q.rubric.kk || q.rubric.en)) || "";
      const student = (answers[q.id] || "").trim();
      return {
        id: q.id,
        index: i + 1,
        points: q.points || 1,
        question: text,
        modelAnswer: model,
        rubric,
        studentAnswer: student || "(empty)",
      };
    });

    const system = `You are a strict but fair geography olympiad grader for NIS students in Kazakhstan.
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

    const userPayload = JSON.stringify({ tasks: items }, null, 0);

    const cfg = window.GEMINI_CONFIG;
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
              parts: [{ text: system + "\n\nSTUDENT WORK:\n" + userPayload }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Gemini error", res.status, errText);
        return { ok: false, error: "gemini_http_" + res.status, perQuestion: {}, totalScore: null };
      }

      const data = await res.json();
      const raw =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
      const parsed = this._parseJson(raw);
      if (!parsed || !Array.isArray(parsed.questions)) {
        console.error("Gemini parse fail", raw);
        return { ok: false, error: "gemini_parse", perQuestion: {}, totalScore: null, raw };
      }

      const perQuestion = {};
      let total = 0;
      let maxTotal = 0;
      openTask.questions.forEach((q) => {
        maxTotal += q.points || 1;
        const hit = parsed.questions.find((x) => x.id === q.id);
        const max = q.points || 1;
        let score = hit ? Number(hit.score) : 0;
        if (Number.isNaN(score)) score = 0;
        score = Math.max(0, Math.min(max, score));
        // round to 0.5
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
        model,
      };
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
