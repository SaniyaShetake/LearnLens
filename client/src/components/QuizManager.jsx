import React, { useState, useEffect, useCallback, useRef } from "react";
import { Modal, Button, Alert, Spinner, Badge } from "react-bootstrap";
import ReactPlayer from "react-player/lazy";
import { useAuth } from "provider/auth";
import { lessonVideoUrl } from "utils/video";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtTime(secs) {
  const s = Math.floor(Number(secs) || 0);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function parseTimestamp(val) {
  const str = String(val).trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const parts = str.split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  }
  return NaN;
}

const TYPES = [
  { value: "mcq",        label: "Single Answer",   desc: "One correct option",        icon: "fas fa-dot-circle" },
  { value: "msq",        label: "Multi Select",     desc: "Multiple correct options",  icon: "fas fa-check-square" },
  { value: "true_false", label: "True / False",     desc: "True or False answer",      icon: "fas fa-toggle-on" },
];

const blankForm = () => ({
  question: "",
  type: "mcq",
  timestamp: 0,
  options: [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ],
  tfCorrect: "true",
});

// ── TypeSelector ──────────────────────────────────────────────────────────────

function TypeSelector({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {TYPES.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: 8,
              border: active ? "2px solid #007bff" : "2px solid #dee2e6",
              background: active ? "#e8f0fe" : "#fff",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 0.15s",
            }}
          >
            <i className={t.icon} style={{ fontSize: "1.1rem", color: active ? "#007bff" : "#adb5bd", display: "block", marginBottom: 4 }} />
            <div style={{ fontSize: "0.78rem", fontWeight: active ? 700 : 500, color: active ? "#007bff" : "#495057", lineHeight: 1.2 }}>{t.label}</div>
            <div style={{ fontSize: "0.7rem", color: "#adb5bd", lineHeight: 1.2, marginTop: 2 }}>{t.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

// ── OptionRow ─────────────────────────────────────────────────────────────────

function OptionRow({ opt, index, type, onToggle, onTextChange, onRemove, canRemove }) {
  const isCorrect = opt.isCorrect;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 8,
        border: isCorrect ? "1.5px solid #28a745" : "1.5px solid #dee2e6",
        background: isCorrect ? "#f0fff4" : "#fff",
        marginBottom: 6,
        transition: "all 0.12s",
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(index)}
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: type === "mcq" ? "50%" : 4,
          border: isCorrect ? "2px solid #28a745" : "2px solid #ced4da",
          background: isCorrect ? "#28a745" : "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title={isCorrect ? "Mark as incorrect" : "Mark as correct"}
      >
        {isCorrect && <i className="fas fa-check" style={{ fontSize: "0.6rem", color: "#fff" }} />}
      </button>
      <input
        value={opt.text}
        onChange={(e) => onTextChange(index, e.target.value)}
        placeholder={`Option ${index + 1}`}
        style={{
          flex: 1,
          border: "none",
          background: "transparent",
          fontSize: "0.88rem",
          outline: "none",
          color: "#212529",
        }}
      />
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          style={{ border: "none", background: "none", color: "#adb5bd", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: 0 }}
          title="Remove option"
        >×</button>
      )}
    </div>
  );
}

// ── QuestionForm ──────────────────────────────────────────────────────────────

function QuestionForm({ initial, playerRef, onSave, onCancel, saving, saveError }) {
  const [form, setForm] = useState(initial || blankForm());

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const handleTypeChange = (newType) => {
    setForm((f) => {
      let opts = f.options;
      if (newType === "true_false") opts = [{ text: "True", isCorrect: true }, { text: "False", isCorrect: false }];
      else if (f.type === "true_false") opts = [{ text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }];
      return { ...f, type: newType, options: opts };
    });
  };

  const toggleCorrect = (i) =>
    setForm((f) => ({
      ...f,
      options: f.type === "mcq"
        ? f.options.map((o, idx) => ({ ...o, isCorrect: idx === i }))
        : f.options.map((o, idx) => idx === i ? { ...o, isCorrect: !o.isCorrect } : o),
    }));

  const setOptionText = (i, val) =>
    setForm((f) => ({ ...f, options: f.options.map((o, idx) => idx === i ? { ...o, text: val } : o) }));

  const addOption = () =>
    setForm((f) => ({ ...f, options: [...f.options, { text: "", isCorrect: false }] }));

  const removeOption = (i) =>
    setForm((f) => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }));

  const captureTime = () => {
    if (playerRef && playerRef.current) {
      const t = Math.floor(playerRef.current.getCurrentTime() || 0);
      set("timestamp", t);
    }
  };

  const handleSubmit = () => {
    if (!form.question.trim()) return alert("Please enter a question.");
    if (form.timestamp < 0 || isNaN(Number(form.timestamp))) return alert("Please set a valid timestamp.");

    let finalOptions = form.options;
    if (form.type === "true_false") {
      const trueCorrect = form.tfCorrect === "true";
      finalOptions = [
        { text: "True",  isCorrect: trueCorrect },
        { text: "False", isCorrect: !trueCorrect },
      ];
    } else {
      const filled = finalOptions.filter((o) => o.text.trim());
      if (filled.length < 2) return alert("Add at least 2 options.");
      if (!filled.some((o) => o.isCorrect)) return alert("Mark at least one correct answer (green circle/square).");
      finalOptions = filled;
    }

    onSave({ question: form.question.trim(), type: form.type, timestamp: Number(form.timestamp), options: finalOptions });
  };

  const isTF = form.type === "true_false";

  return (
    <div>
      {/* Type selector */}
      <div style={{ marginBottom: 4, fontSize: "0.8rem", fontWeight: 600, color: "#6c757d", textTransform: "uppercase", letterSpacing: 0.5 }}>Question Type</div>
      <TypeSelector value={form.type} onChange={handleTypeChange} />

      {/* Timestamp */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6c757d", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Timestamp</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              background: "#1a1a2e",
              color: "#00d4ff",
              fontFamily: "monospace",
              fontSize: "1.5rem",
              fontWeight: 700,
              padding: "8px 16px",
              borderRadius: 8,
              letterSpacing: 2,
              minWidth: 80,
              textAlign: "center",
            }}
          >
            {fmtTime(form.timestamp)}
          </div>
          <div style={{ flex: 1 }}>
            <button
              type="button"
              onClick={captureTime}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 8,
                border: "2px solid #007bff",
                background: "#007bff",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <i className="fas fa-map-marker-alt" /> Set at Current Video Time
            </button>
            <div style={{ fontSize: "0.75rem", color: "#6c757d", marginTop: 4, textAlign: "center" }}>
              Play video to a point, then click above — or type below
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: "0.8rem", color: "#6c757d", whiteSpace: "nowrap" }}>Manual:</span>
          <input
            value={form.timestamp === 0 ? "" : fmtTime(form.timestamp)}
            onChange={(e) => { const t = parseTimestamp(e.target.value); if (!isNaN(t)) set("timestamp", t); else set("timestamp", e.target.value); }}
            placeholder="e.g. 1:30 or 90"
            style={{ flex: 1, padding: "5px 10px", borderRadius: 6, border: "1px solid #ced4da", fontFamily: "monospace", fontSize: "0.88rem" }}
          />
        </div>
      </div>

      {/* Question text */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6c757d", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Question</div>
        <textarea
          value={form.question}
          onChange={(e) => set("question", e.target.value)}
          placeholder="Type your question here…"
          rows={3}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1.5px solid #ced4da",
            fontSize: "0.9rem",
            resize: "vertical",
            outline: "none",
            fontFamily: "inherit",
          }}
          onFocus={(e) => { e.target.style.borderColor = "#007bff"; }}
          onBlur={(e) => { e.target.style.borderColor = "#ced4da"; }}
        />
      </div>

      {/* Options / True-False */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#6c757d", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          {isTF ? "Correct Answer" : `Answer Options ${form.type === "mcq" ? "(click circle to mark correct)" : "(click square to mark all correct)"}`}
        </div>

        {isTF ? (
          <div style={{ display: "flex", gap: 10 }}>
            {["true", "false"].map((v) => {
              const active = form.tfCorrect === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => set("tfCorrect", v)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: 8,
                    border: active ? "2px solid #28a745" : "2px solid #dee2e6",
                    background: active ? "#d4edda" : "#fff",
                    fontWeight: active ? 700 : 500,
                    fontSize: "0.95rem",
                    color: active ? "#155724" : "#495057",
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  {active && <i className="fas fa-check mr-1" />}
                  {v === "true" ? "True ✓" : "False ✗"}
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            {form.options.map((opt, i) => (
              <OptionRow
                key={i}
                opt={opt}
                index={i}
                type={form.type}
                onToggle={toggleCorrect}
                onTextChange={setOptionText}
                onRemove={removeOption}
                canRemove={form.options.length > 2}
              />
            ))}
            {form.options.length < 6 && (
              <button
                type="button"
                onClick={addOption}
                style={{
                  width: "100%",
                  padding: "7px",
                  borderRadius: 8,
                  border: "1.5px dashed #ced4da",
                  background: "transparent",
                  color: "#6c757d",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  marginTop: 2,
                }}
              >
                <i className="fas fa-plus mr-1" /> Add Option
              </button>
            )}
          </div>
        )}
      </div>

      {saveError && (
        <Alert variant="danger" className="mb-3 py-2" style={{ fontSize: "0.85rem" }}>{saveError}</Alert>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={handleSubmit} disabled={saving} style={{ flex: 1 }}>
          {saving ? <Spinner animation="border" size="sm" /> : <><i className="fas fa-save mr-1" /> Save Question</>}
        </Button>
        <Button variant="outline-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── QuestionCard (list item) ──────────────────────────────────────────────────

function QuestionCard({ q, index, onEdit, onDelete }) {
  const typeInfo = TYPES.find((t) => t.value === q.type);
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 14px",
        background: "#fff",
        border: "1px solid #e9ecef",
        borderRadius: 10,
        marginBottom: 8,
        alignItems: "flex-start",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Timestamp badge */}
      <div
        style={{
          flexShrink: 0,
          background: "#1a1a2e",
          color: "#00d4ff",
          fontFamily: "monospace",
          fontSize: "0.82rem",
          fontWeight: 700,
          padding: "4px 10px",
          borderRadius: 6,
          letterSpacing: 1,
          whiteSpace: "nowrap",
          marginTop: 2,
        }}
      >
        {fmtTime(q.timestamp)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 10,
              background: "#e8f0fe",
              color: "#1a73e8",
              whiteSpace: "nowrap",
            }}
          >
            <i className={`${typeInfo && typeInfo.icon} mr-1`} />{typeInfo && typeInfo.label}
          </span>
        </div>
        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#212529", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {index + 1}. {q.question}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {q.options.map((o) => (
            <span
              key={o._id}
              style={{
                fontSize: "0.75rem",
                padding: "2px 8px",
                borderRadius: 10,
                background: o.isCorrect ? "#d4edda" : "#f8f9fa",
                color: o.isCorrect ? "#155724" : "#6c757d",
                border: o.isCorrect ? "1px solid #c3e6cb" : "1px solid #dee2e6",
              }}
            >
              {o.isCorrect && "✓ "}{o.text}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        <button
          onClick={() => onEdit(q)}
          style={{ border: "1px solid #dee2e6", background: "#fff", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "#007bff", fontSize: "0.8rem" }}
          title="Edit"
        >
          <i className="far fa-edit" />
        </button>
        <button
          onClick={() => onDelete(q._id)}
          style={{ border: "1px solid #dee2e6", background: "#fff", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "#dc3545", fontSize: "0.8rem" }}
          title="Delete"
        >
          <i className="far fa-trash-alt" />
        </button>
      </div>
    </div>
  );
}

// ── QuizManager (main modal) ──────────────────────────────────────────────────

export default function QuizManager({ lesson, show, onHide }) {
  const { request } = useAuth();
  const playerRef = useRef(null);

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [mode, setMode] = useState("list"); // "list" | "add" | "edit"
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);

  const load = useCallback(() => {
    if (!lesson) return;
    setLoading(true);
    setLoadError(null);
    request("GET", `/lessons/${lesson._id}/quiz`)
      .then(({ data }) => { if (data && data.success) setQuestions(data.questions || []); })
      .catch(() => setLoadError("Could not load quiz questions."))
      .finally(() => setLoading(false));
  }, [lesson, request]);

  useEffect(() => {
    if (show) { load(); setMode("list"); setEditTarget(null); setSaveError(null); setPlayerReady(false); }
  }, [show, load]);

  const handleSave = async (formData) => {
    setSaving(true);
    setSaveError(null);
    try {
      const isEdit = mode === "edit";
      const url    = isEdit ? `/lessons/${lesson._id}/quiz/${editTarget._id}` : `/lessons/${lesson._id}/quiz`;
      const method = isEdit ? "PUT" : "POST";
      const { data } = await request(method, url, formData);
      if (data && data.success) { setMode("list"); setEditTarget(null); load(); }
      else setSaveError((data && data.message) || "Couldn't save question.");
    } catch (err) {
      const msg = err && err.response && err.response.data && err.response.data.message;
      setSaveError(msg || "Couldn't save question.");
    } finally { setSaving(false); }
  };

  const handleDelete = async (qid) => {
    if (!window.confirm("Delete this question?")) return;
    try { await request("DELETE", `/lessons/${lesson._id}/quiz/${qid}`); load(); } catch {}
  };

  const editInitial = (q) => {
    const isTF = q.type === "true_false";
    return {
      question:  q.question,
      type:      q.type,
      timestamp: q.timestamp,
      options:   isTF ? q.options : q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
      tfCorrect: isTF && q.options[0] && q.options[0].isCorrect ? "true" : "false",
    };
  };

  const playerOptions = {
    youtube: { playerVars: { modestbranding: 1, fs: 0, iv_load_policy: 3 } },
  };

  const isFormMode = mode === "add" || mode === "edit";

  return (
    <Modal show={show} onHide={onHide} size="xl" dialogClassName="quiz-manager-modal">
      <Modal.Header closeButton style={{ background: "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
        <div>
          <Modal.Title style={{ fontSize: "1rem", fontWeight: 700 }}>
            <i className="fas fa-question-circle mr-2 text-primary" />
            Quiz Manager
          </Modal.Title>
          <div style={{ fontSize: "0.82rem", color: "#6c757d", marginTop: 2 }}>
            {lesson && lesson.name}
          </div>
        </div>
      </Modal.Header>

      <Modal.Body style={{ padding: 0 }}>
        <div style={{ display: "flex", minHeight: 520 }}>

          {/* ── Left: Video Player ─────────────────────────── */}
          <div style={{ width: 380, flexShrink: 0, background: "#1a1a2e", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
                <i className="fas fa-video mr-1" /> Video Preview
              </div>
            </div>
            <div style={{ flex: 1, position: "relative", background: "#000" }}>
              {lesson && lesson.youtube_link ? (
                <ReactPlayer
                  ref={playerRef}
                  url={lessonVideoUrl(lesson)}
                  width="100%"
                  height="214px"
                  controls
                  config={playerOptions}
                  onReady={() => setPlayerReady(true)}
                />
              ) : (
                <div style={{ height: 214, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.85rem" }}>
                  No video
                </div>
              )}
            </div>

            {/* Question timeline */}
            <div style={{ flex: 1, padding: "12px 16px", overflowY: "auto" }}>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>
                Questions Timeline ({questions.length})
              </div>
              {questions.length === 0 ? (
                <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)", textAlign: "center", paddingTop: 12 }}>No questions yet</div>
              ) : (
                questions.map((q, i) => {
                  const typeInfo = TYPES.find((t) => t.value === q.type);
                  return (
                    <div
                      key={q._id}
                      style={{ display: "flex", gap: 8, marginBottom: 8, cursor: "pointer" }}
                      onClick={() => { setEditTarget(q); setMode("edit"); setSaveError(null); }}
                      title="Click to edit"
                    >
                      <div style={{ flexShrink: 0, fontFamily: "monospace", fontSize: "0.75rem", color: "#00d4ff", fontWeight: 700, paddingTop: 2 }}>
                        {fmtTime(q.timestamp)}
                      </div>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{ fontSize: "0.7rem", color: "#adb5bd" }}><i className={`${typeInfo && typeInfo.icon} mr-1`} />{typeInfo && typeInfo.label}</div>
                        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {q.question}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              {!isFormMode && (
                <button
                  onClick={() => { setMode("add"); setEditTarget(null); setSaveError(null); }}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: 8,
                    border: "2px solid #007bff",
                    background: "#007bff",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                  }}
                >
                  <i className="fas fa-plus mr-1" /> Add New Question
                </button>
              )}
            </div>
          </div>

          {/* ── Right: Form / List ─────────────────────────── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {isFormMode ? (
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h6 style={{ margin: 0, fontWeight: 700, color: "#212529" }}>
                    {mode === "add" ? "Add New Question" : "Edit Question"}
                  </h6>
                  <span style={{ fontSize: "0.78rem", color: "#6c757d" }}>
                    <i className="fas fa-info-circle mr-1" />
                    Play video to desired point, then click "Set at Current Video Time"
                  </span>
                </div>
                <QuestionForm
                  key={editTarget ? editTarget._id : "new"}
                  initial={editTarget ? editInitial(editTarget) : undefined}
                  playerRef={playerRef}
                  onSave={handleSave}
                  onCancel={() => { setMode("list"); setEditTarget(null); setSaveError(null); }}
                  saving={saving}
                  saveError={saveError}
                />
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h6 style={{ margin: 0, fontWeight: 700, color: "#212529" }}>
                    All Questions <span style={{ fontWeight: 400, color: "#6c757d" }}>({questions.length})</span>
                  </h6>
                  {questions.length > 0 && (
                    <span style={{ fontSize: "0.78rem", color: "#6c757d" }}>Sorted by video timestamp</span>
                  )}
                </div>

                {loadError && <Alert variant="danger">{loadError}</Alert>}

                {loading ? (
                  <div className="text-center py-5"><Spinner animation="border" /></div>
                ) : questions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <i className="fas fa-question-circle" style={{ fontSize: "3rem", color: "#dee2e6", display: "block", marginBottom: 12 }} />
                    <div style={{ fontWeight: 600, color: "#495057", marginBottom: 6 }}>No quiz questions yet</div>
                    <div style={{ fontSize: "0.85rem", color: "#6c757d", marginBottom: 20 }}>
                      Add questions that will pop up while students watch the video.
                    </div>
                    <Button onClick={() => { setMode("add"); setSaveError(null); }}>
                      <i className="fas fa-plus mr-1" /> Add First Question
                    </Button>
                  </div>
                ) : (
                  questions.map((q, i) => (
                    <QuestionCard
                      key={q._id}
                      q={q}
                      index={i}
                      onEdit={(q) => { setEditTarget(q); setMode("edit"); setSaveError(null); }}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}
