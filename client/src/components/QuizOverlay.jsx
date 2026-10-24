import React, { useState } from "react";
import { Button, Spinner } from "react-bootstrap";

const TYPE_LABELS = { mcq: "Single Answer", msq: "Select All That Apply", true_false: "True / False" };

export default function QuizOverlay({ question, onSubmit, submitting, result, onContinue }) {
  const [selected, setSelected] = useState([]); // array of option _id strings

  const toggle = (id) => {
    if (question.type === "mcq" || question.type === "true_false") {
      setSelected([id]);
    } else {
      setSelected((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  };

  const handleSubmit = () => {
    if (selected.length === 0) return;
    const answer = question.type === "msq" ? selected : selected[0];
    onSubmit(answer);
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.82)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "24px 28px",
          maxWidth: 520,
          width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6c757d", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          Quiz · {TYPE_LABELS[question.type]}
        </div>

        <div style={{ fontSize: "1rem", fontWeight: 600, color: "#212529", marginBottom: 16, lineHeight: 1.5 }}>
          {question.question}
        </div>

        {/* Result feedback */}
        {result !== null && result !== undefined ? (
          <div>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                marginBottom: 16,
                background: result ? "#d4edda" : "#f8d7da",
                color: result ? "#155724" : "#721c24",
                fontWeight: 600,
                fontSize: "0.95rem",
                textAlign: "center",
              }}
            >
              {result ? "✓ Correct!" : "✗ Incorrect"}
            </div>
            <div className="text-center">
              <Button onClick={onContinue} variant="primary">Continue Watching</Button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {question.options.map((opt) => {
                const isSelected = selected.includes(String(opt._id));
                return (
                  <button
                    key={opt._id}
                    onClick={() => toggle(String(opt._id))}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: isSelected ? "2px solid #007bff" : "1px solid #dee2e6",
                      background: isSelected ? "#e8f0fe" : "#fff",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      fontWeight: isSelected ? 600 : 400,
                      color: "#212529",
                      transition: "all 0.12s",
                    }}
                  >
                    {opt.text}
                  </button>
                );
              })}
            </div>
            <div className="text-center">
              <Button onClick={handleSubmit} disabled={selected.length === 0 || submitting}>
                {submitting ? <Spinner animation="border" size="sm" /> : "Submit Answer"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
