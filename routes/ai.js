const router = require("express").Router();

// Gemini-backed learning helper. Keep GOOGLE_API_KEY on the server; never expose it to the browser.
router.post("/chat", async (req, res) => {
  const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ success: false, message: "Please enter a question." });
  if (message.length > 4000) return res.status(413).json({ success: false, message: "Please keep your question under 4,000 characters." });

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.includes("replace_with")) {
    return res.status(503).json({ success: false, message: "AI tutor is not configured yet. Add a valid GOOGLE_API_KEY to the server .env file, then restart the backend." });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: "You are LearnLens AI Study Assistant for college students. Explain concepts in simple, clear English. For quiz questions, guide the student step by step, offer hints before giving the final answer, explain why answers are correct or incorrect, and never claim to know course material that was not provided. Keep responses concise and encouraging." }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload && payload.error && payload.error.message;
      return res.status(502).json({ success: false, message: detail || "The AI provider could not answer. Check your Google AI key and quota." });
    }
    const reply = (payload.candidates || []).flatMap((c) => (c.content && c.content.parts) || []).map((p) => p.text || "").join("\n").trim();
    if (!reply) return res.status(502).json({ success: false, message: "The AI service returned an empty answer. Please try again." });
    return res.json({ success: true, reply });
  } catch (error) {
    console.error("AI tutor request failed:", error.message);
    return res.status(502).json({ success: false, message: "Could not connect to the AI service. Please try again later." });
  }
});

module.exports = router;
