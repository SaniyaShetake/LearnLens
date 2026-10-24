import React, { useCallback } from "react";
import { Form } from "react-bootstrap";
import useFeedback from "provider/feedback";
import { useAuth } from "provider/auth";
import "assets/styles/insight-panels.scss";

export const fmtTime = (seconds) => {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
export const fmtMin = (minute) => `${minute}:00`;
export const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

export const readStored = (key, fallback) => {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
};
export const writeStored = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    /* storage unavailable */
  }
};

/** The selected range in minutes, whether it narrows the lesson, and a label like "7:00–10:00". */
export function useSelection() {
  const { range, lesson } = useFeedback();
  const total = (lesson && lesson.minutes) || 0;
  const [a = 0, b = total] = range || [];
  const partial = total > 0 && (a > 0 || b < total);
  return { from: a, to: b, total, partial, label: `${fmtMin(a)}–${fmtMin(b)}` };
}

/** Sets the dashboard range (which also cues the video to its start), like the range slider does. */
export function useFocusRange() {
  const { lesson, setRange, setHasChanges, activated, setAct } = useFeedback();
  const { user, setShowUpgradeModal } = useAuth();
  return useCallback(
    (from, to) => {
      if (!lesson) return;
      if (user && user.feature_level !== "advanced") {
        setShowUpgradeModal(true);
        return;
      }
      const max = lesson.minutes || 0;
      let a = Math.max(0, Math.min(max - 1, Math.floor(from)));
      let b = Math.min(max, Math.max(a + 1, Math.ceil(to)));
      setAct(activated);
      setRange([a, b]);
      setHasChanges(true);
    },
    [lesson, user, setShowUpgradeModal, setRange, setHasChanges, activated, setAct]
  );
}

/** One-line card header in the dashboard's caption style: title, an info tip with the explanation, right-side controls. */
export function PanelHeader({ title, info, children }) {
  return (
    <div className="tc-panel-head">
      <h3 className="tc-panel-title">{title}</h3>
      {info && <i className="fas fa-info-circle tc-panel-info" title={info} aria-label={info} tabIndex={0} />}
      <div className="tc-panel-tools">{children}</div>
    </div>
  );
}

/** Inline headline number: "57% class avg · 15% in selection". */
export function Stat({ value, label, info, selection, tone }) {
  return (
    <div className={"tc-stat" + (tone ? ` is-${tone}` : "")} title={info}>
      <span className="tc-stat-value num">{value}</span>
      <span className="tc-stat-label">{label}</span>
      {selection && <span className="tc-stat-sel num">{selection}</span>}
    </div>
  );
}

export function PanelSkeleton({ rows = 4 }) {
  return (
    <div className="tc-skel-wrap" aria-busy="true" aria-label="Loading">
      <div className="tc-skel" style={{ height: 14, width: "60%", marginBottom: 12 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="tc-skel" style={{ height: 22, marginBottom: 8, opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  );
}

export function PanelState({ icon, title, text, error, action }) {
  return (
    <div className={"tc-state" + (error ? " is-error" : "")} role={error ? "alert" : undefined}>
      <div className="tc-state-icon">
        <i className={`fas ${icon}`} aria-hidden="true" />
      </div>
      <div className="tc-state-title">{title}</div>
      {text && <div className="tc-state-text">{text}</div>}
      {action}
    </div>
  );
}

/** On/off switch with a label on each side, like the dashboard's "View 1 / View 2" and "Students / Clicks" toggles. */
export function SideSwitch({ id, left, right, on, onChange }) {
  return (
    <div className="tc-switch">
      <button type="button" className={"tc-switch-label" + (!on ? " is-active" : "")} onClick={() => onChange(false)}>{left}</button>
      <Form.Check type="switch" id={id} checked={on} onChange={() => onChange(!on)} aria-label={`${left} or ${right}`} />
      <button type="button" className={"tc-switch-label" + (on ? " is-active" : "")} onClick={() => onChange(true)}>{right}</button>
    </div>
  );
}

export const errorText = (err) => {
  const status = err && err.response && err.response.status;
  return status ? `The server answered ${status}.` : "Check your connection and try again.";
};
