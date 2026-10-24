import React, { useState } from "react";
import { Link } from "react-router-dom";
import Header from "components/Header";
import "../assets/styles/ai-tutor.scss";

const starters = [
  "Explain this question in simple words",
  "Give me a hint without revealing the answer",
  "Explain why my answer is incorrect",
];

export default function AiTutorPage() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! I’m your LearnLens study assistant. Share a quiz question and I’ll help you understand the concept step by step." },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text = draft) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setMessages((old) => [...old, { role: "user", text: prompt }]);
    setDraft("");
    setBusy(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: prompt }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "The AI service is not configured yet.");
      setMessages((old) => [...old, { role: "assistant", text: data.reply || data.answer || "I couldn't prepare a reply. Please try again." }]);
    } catch (error) {
      setMessages((old) => [...old, { role: "assistant", text: `I can't reach the AI tutor service yet. ${error.message || "Please check the server configuration."} Your chat interface is ready; the backend AI endpoint and API key need to be configured to generate answers.` }]);
    } finally { setBusy(false); }
  }

  return <div className="learnlens-ai-page">
    <Header pageName="AI Doubt Solver" />
    <main className="ai-tutor-wrap">
      <div className="ai-tutor-heading">
        <div className="ai-orb"><i className="fas fa-robot" /></div>
        <div><p className="ai-eyebrow">LEARNLENS · GROUP G46</p><h1>Ask. Understand. <span>Learn.</span></h1><p>Get help with quiz questions, concepts, and confusing answers.</p></div>
      </div>
      <section className="ai-chat-card" aria-label="AI study chat">
        <div className="ai-chat-top"><div><strong>Learning assistant</strong><small>Ask about any lesson or quiz question</small></div><span className="ai-status"><i /> Study mode</span></div>
        <div className="ai-messages" aria-live="polite">
          {messages.map((m, i) => <div key={i} className={`ai-message ${m.role}`}><span className="ai-avatar">{m.role === "assistant" ? <i className="fas fa-sparkles" /> : <i className="fas fa-user" />}</span><div className="ai-bubble">{m.text}</div></div>)}
          {busy && <div className="ai-typing">Thinking through your question…</div>}
        </div>
        <div className="ai-starters">{starters.map((s) => <button key={s} type="button" onClick={() => send(s)} disabled={busy}>{s}</button>)}</div>
        <form className="ai-compose" onSubmit={(e) => { e.preventDefault(); send(); }}><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your question here…" rows={2} aria-label="Your question" /><button type="submit" disabled={!draft.trim() || busy} aria-label="Send question"><i className="fas fa-paper-plane" /> Send</button></form>
        <p className="ai-disclaimer">Use hints to build understanding. Always verify important answers with your course material.</p>
      </section>
      <Link className="ai-back-link" to="/dashboard"><i className="fas fa-arrow-left" /> Back to dashboard</Link>
    </main>
  </div>;
}
