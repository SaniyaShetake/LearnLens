import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useFeedback from "provider/feedback";
import { useAuth } from "provider/auth";
import { PanelHeader, Stat, SideSwitch, PanelSkeleton, PanelState, fmtTime, pct, useSelection, useFocusRange, readStored, writeStored, errorText } from "./panelKit";

const TYPE_LABEL = { mcq: "Single choice", msq: "Multi-select", true_false: "True / False" };
const MIN_ANSWERS = 5;

// First-try bands (SPEC §4.8.1)
const verdictFor = (q) => {
  if (q.answered < MIN_ANSWERS) return { key: "few", label: "Too few answers", icon: "fa-hourglass-half" };
  if (q.firstPct < 40) return { key: "reteach", label: "Reteach", icon: "fa-redo-alt" };
  if (q.firstPct < 70) return { key: "discuss", label: "Discuss", icon: "fa-comments" };
  if (q.firstPct < 80) return { key: "nearly", label: "Nearly there", icon: "fa-adjust" };
  return { key: "gotit", label: "Got it", icon: "fa-check-circle" };
};

const SORT_KEY = "tc.dash.quizSort";

function QuizAnalysisPanel() {
  const { lesson } = useFeedback();
  const { request } = useAuth();
  const sel = useSelection();
  const focusRange = useFocusRange();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState(() => readStored(SORT_KEY, "video"));
  const [flash, setFlash] = useState(null);
  const subs = useRef(true);
  const lessonKey = lesson ? lesson.id || lesson._id : null;

  useEffect(() => () => { subs.current = false; }, []);

  // Fetched once per lesson; the time range is applied client-side (no refetch, no flashing loaders).
  const load = useCallback(() => {
    if (!lessonKey) return;
    setRefreshing(true);
    request("GET", `/lessons/${lessonKey}/quiz-analysis`)
      .then(({ data: r }) => {
        if (!subs.current) return;
        if (r && r.success) {
          setData(r);
          setStatus("ready");
          setError(null);
        } else throw new Error("Unexpected response");
      })
      .catch((err) => {
        if (!subs.current) return;
        setError(err);
        setStatus((s) => (s === "ready" ? "ready" : "error"));
      })
      .finally(() => subs.current && setRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonKey]);

  useEffect(() => { load(); }, [load]);

  const model = useMemo(() => {
    if (!data || !data.questions) return null;
    const firstTry = data.scoring === "first_try";
    const rows = data.questions.map((q, i) => {
      const answered = firstTry ? q.answered : q.total;
      const right = firstTry ? q.first_correct : q.correct;
      const row = {
        ...q,
        n: i + 1,
        answered,
        right,
        wrong: Math.max(0, answered - right),
        firstPct: pct(right, answered),
        bestPct: firstTry ? pct(q.best_correct, answered) : null,
        inRange: sel.partial && q.timestamp >= sel.from * 60 && q.timestamp < sel.to * 60,
      };
      row.verdict = verdictFor(row);
      return row;
    });
    const scored = rows.filter((r) => r.answered >= MIN_ANSWERS);
    const avg = (list) => (list.length ? Math.round(list.reduce((s, r) => s + r.firstPct, 0) / list.length) : null);
    const reteach = rows.filter((r) => r.verdict.key === "reteach");
    const hardest = [...scored].sort((a, b) => a.firstPct - b.firstPct || b.answered - a.answered)[0] || null;
    const inRange = rows.filter((r) => r.inRange);
    return {
      firstTry,
      rows,
      average: avg(scored),
      averageInRange: avg(inRange.filter((r) => r.answered >= MIN_ANSWERS)),
      inRangeCount: inRange.length,
      reteach,
      reteachInRange: reteach.filter((r) => r.inRange).length,
      hardest,
      answeredStudents: data.summary.total_students || 0,
      opened: Math.max(data.summary.opened || 0, data.summary.total_students || 0),
    };
  }, [data, sel.partial, sel.from, sel.to]);

  const sorted = useMemo(() => {
    if (!model) return [];
    if (sort !== "hardest") return model.rows;
    return [...model.rows].sort((a, b) => {
      const fa = a.answered >= MIN_ANSWERS ? a.firstPct : 101;
      const fb = b.answered >= MIN_ANSWERS ? b.firstPct : 101;
      return fa - fb || a.timestamp - b.timestamp;
    });
  }, [model, sort]);

  const changeSort = (s) => {
    setSort(s);
    writeStored(SORT_KEY, s);
  };

  // Cue the video a minute before the question and select the two minutes around it.
  const watch = (q) => {
    const m = Math.floor(q.timestamp / 60);
    focusRange(m - 1, m + 1);
    setFlash(q._id);
    setTimeout(() => subs.current && setFlash(null), 1200);
  };

  const count = model ? model.rows.length : 0;
  const info =
    model && !model.firstTry
      ? "Counts every answer, including retries. Click a time to watch that moment."
      : "Share of students who got each question right on their first try (retries aren't counted). The line on each bar marks 80%. Verdicts: Reteach under 40%, Discuss 40–69%, Nearly there 70–79%, Got it 80%+. Click a time to watch that moment.";
  const header = (
    <PanelHeader title="Quiz Analysis" info={info}>
      {count > 1 && <SideSwitch id="quiz-sort-switch" left="Video order" right="Hardest first" on={sort === "hardest"} onChange={(v) => changeSort(v ? "hardest" : "video")} />}
      {refreshing && <span className="tc-spinner" aria-label="Refreshing" />}
    </PanelHeader>
  );

  const shell = (children) => (
    <section className="tc-panel" aria-label="Quiz Analysis" aria-busy={refreshing}>
      {header}
      {children}
    </section>
  );

  if (status === "loading") return shell(<PanelSkeleton />);

  if (status === "error" || !model)
    return shell(
      <PanelState
        error
        icon="fa-exclamation-triangle"
        title="Couldn't load quiz results"
        text={errorText(error)}
        action={<button type="button" className="tc-btn" onClick={load}><i className="fas fa-redo-alt" /> Try again</button>}
      />
    );

  if (!count)
    return shell(<PanelState icon="fa-question" title="No check-in questions in this video yet" text="Add questions at key moments to see what students understood, right where it happened." />);

  const noAnswers = model.rows.every((r) => r.answered === 0);

  return shell(
    <>
      {error && (
        <div className="tc-banner" role="alert">
          <i className="fas fa-exclamation-circle" /> Couldn't refresh; showing the last results.
          <button type="button" className="tc-btn" onClick={load}>Retry</button>
        </div>
      )}
      <div className="tc-stats">
        <Stat
          value={model.average === null ? "—" : `${model.average}%`}
          label={model.firstTry ? "class average, first try" : "of answers right"}
          info="Average share of students right on their first try, over questions with at least 5 answers."
          selection={sel.partial && model.averageInRange !== null ? `${model.averageInRange}% in ${sel.label}` : null}
        />
        <Stat
          value={`${model.answeredStudents}/${model.opened}`}
          label="answered"
          info="Students who answered at least one question, out of students who opened the lesson."
        />
        <Stat
          tone={model.reteach.length ? "danger" : null}
          value={model.reteach.length || "None"}
          label={
            model.reteach.length ? (
              <>
                to reteach{" "}
                {model.reteach.map((r, i) => (
                  <React.Fragment key={r._id}>
                    {i > 0 && ", "}
                    <button type="button" className="tc-link" onClick={() => watch(r)} title={r.question}>Q{r.n}</button>
                  </React.Fragment>
                ))}
              </>
            ) : (
              "to reteach"
            )
          }
          info="Questions fewer than 40% of students got right on their first try. Click one to watch that moment."
        />
      </div>

      {noAnswers && <div className="tc-note">No answers yet. Results appear as students watch.</div>}

      <div className="tc-panel-body">
        <table className="tc-qtable">
          <caption className="sr-only">Quiz check-in results{model.firstTry ? ", first try" : ""}</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Time</th>
              <th scope="col" style={{ width: "100%" }}>Question</th>
              <th scope="col">{model.firstTry ? "Right on first try" : "Right answers"}</th>
              <th scope="col" className="is-right">%</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((q) => {
              const few = q.answered < MIN_ANSWERS;
              const rightW = q.answered ? (q.right / q.answered) * 100 : 0;
              const retries = q.bestPct !== null && q.answered > 0 && q.bestPct > q.firstPct ? ` · ${q.bestPct}% after retries` : "";
              return (
                <tr key={q._id} className={(q.inRange ? "is-in-range " : "") + (flash === q._id ? "is-flash" : "")}>
                  <td className="tc-qnum num">Q{q.n}</td>
                  <td>
                    <button type="button" className="tc-time num" onClick={() => watch(q)} title={`Watch the minute before ${fmtTime(q.timestamp)}`} aria-label={`Watch around ${fmtTime(q.timestamp)}`}>
                      <i className="fas fa-play" aria-hidden="true" />
                      {fmtTime(q.timestamp)}
                    </button>
                  </td>
                  <td className="tc-qcell">
                    <div className="tc-qtext" title={`${q.question}\n${TYPE_LABEL[q.type] || q.type}`}>{q.question}</div>
                  </td>
                  <td>
                    <div className="tc-qbar-row" title={q.answered ? `${q.right} of ${q.answered} students right${model.firstTry ? " on first try" : ""}${retries}` : "No answers yet"}>
                      <div className="tc-qbar" role="img" aria-label={q.answered ? `${q.right} of ${q.answered} right` : "No answers yet"}>
                        {q.answered ? (
                          <>
                            <div className="tc-qbar-correct" style={{ width: `${rightW}%`, borderRadius: rightW >= 100 ? 4 : undefined }} />
                            {q.wrong > 0 && <div className="tc-qbar-wrong" style={{ width: `${100 - rightW}%`, borderLeft: rightW === 0 ? "1px solid var(--violet-9)" : 0, borderRadius: rightW === 0 ? 4 : undefined }} />}
                          </>
                        ) : (
                          <div className="tc-qbar-empty" />
                        )}
                        <div className="tc-qbar-tick" />
                      </div>
                      <span className="tc-qbar-count num">{q.answered ? `${q.right}/${q.answered}` : "0"}</span>
                    </div>
                  </td>
                  <td className="tc-pct num" style={few ? { color: "var(--gray-10)" } : null} title={q.type === "true_false" ? "True/false: 50% could be guessing" : undefined}>
                    {few ? "—" : `${q.firstPct}%`}
                  </td>
                  <td>
                    <span className={`tc-verdict is-${q.verdict.key}`}>
                      <i className={`fas ${q.verdict.icon}`} aria-hidden="true" />
                      {q.verdict.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default QuizAnalysisPanel;
