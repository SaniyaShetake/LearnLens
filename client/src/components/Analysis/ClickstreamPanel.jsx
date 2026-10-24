import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine, ResponsiveContainer } from "recharts";
import { useAuth } from "provider/auth";
import useFeedback from "provider/feedback";
import { PanelHeader, Stat, PanelSkeleton, PanelState, fmtMin, pct, useSelection, useFocusRange, errorText } from "./panelKit";

// The dashboard's own purples: slider #9333ea, slider track #7c77a5, header #3b0764, borders #e9d5ff
const C = {
  back: "#9333ea",
  skip: "#7c77a5",
  pause: "#3b0764",
  reachedFill: "#e9d5ff",
  reachedLine: "#9333ea",
  grid: "#e4e0f0",
  axis: "#6c757d",
  band: "#e9d5ff",
};

const MIN_STUDENTS_FOR_MOMENT = 3;

/** Merges adjacent minutes with the same signal into moments like "Jumped back to 7:00–9:00". */
function findMoments(rows, opened) {
  const kinds = [
    { key: "back", label: "Jumped back to", icon: "fa-undo-alt", hint: "Often a sign the part was hard or worth a second look" },
    { key: "skip", label: "Skipped ahead at", icon: "fa-forward", hint: "Students moved past this part" },
    { key: "pause", label: "Paused at", icon: "fa-pause", hint: "Students stopped here, to think, take notes or step away" },
  ];
  const moments = [];
  for (const kind of kinds) {
    const values = rows.map((r) => r[kind.key]);
    const max = Math.max(0, ...values);
    const threshold = Math.max(MIN_STUDENTS_FOR_MOMENT, Math.ceil(max * 0.6));
    let i = 0;
    while (i < rows.length) {
      if (values[i] >= threshold) {
        let j = i;
        while (j + 1 < rows.length && values[j + 1] >= threshold) j++;
        const peak = Math.max(...values.slice(i, j + 1));
        moments.push({ ...kind, from: rows[i].minute, to: rows[j].minute + 1, peak, share: pct(peak, opened) });
        i = j + 1;
      } else i++;
    }
  }
  return moments.sort((a, b) => b.peak - a.peak).slice(0, 4);
}

function ChartTip({ active, payload, opened }) {
  if (!active || !payload || !payload.length) return null;
  const r = payload[0].payload;
  return (
    <div className="tc-tip">
      <div className="tc-tip-title num">{fmtMin(r.minute)}–{fmtMin(r.minute + 1)}</div>
      <div className="tc-tip-row"><span className="sw" style={{ background: C.back, width: 8, height: 8, borderRadius: 2 }} />Jumped back here<b className="num">{r.back}</b></div>
      <div className="tc-tip-row"><span className="sw" style={{ background: "#fff", border: `1.5px solid ${C.skip}`, width: 8, height: 8, borderRadius: 2 }} />Skipped ahead to here<b className="num">{r.skip}</b></div>
      <div className="tc-tip-row"><span className="sw" style={{ background: C.pause, width: 8, height: 8, borderRadius: "50%" }} />Paused here<b className="num">{r.pause}</b></div>
      <div className="tc-tip-row"><span className="sw" style={{ background: C.reachedFill, border: `1.5px solid ${C.reachedLine}`, width: 8, height: 8, borderRadius: 2 }} />Still watching<b className="num">{r.reached} of {opened}</b></div>
      <div className="tc-tip-hint"><i className="fas fa-mouse-pointer" /> Click to watch this minute</div>
    </div>
  );
}

export default function ClickstreamPanel() {
  const { lesson } = useFeedback();
  const { request } = useAuth();
  const sel = useSelection();
  const focusRange = useFocusRange();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const subs = useRef(true);
  const lessonKey = lesson ? lesson.id || lesson._id : null;

  useEffect(() => () => { subs.current = false; }, []);

  // Fetched once per lesson; the range only changes highlights (no refetch on range changes).
  const load = useCallback(() => {
    if (!lessonKey) return;
    setRefreshing(true);
    request("GET", `/lessons/${lessonKey}/clickstream`)
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
    if (!data) return null;
    const st = data.students;
    const opened = st ? st.opened : data.summary.unique_students;
    const rows = (data.students_by_minute || (data.by_minute || []).map((m) => ({ minute: m.minute, back: m.backward_seek, skip: m.forward_seek, pause: m.pause, reached: 0 })))
      // The last bucket is often a partial minute past the end of the video
      .filter((r) => !lesson || !lesson.minutes || r.minute < lesson.minutes)
      .map((r) => ({ ...r, skipNeg: -r.skip, reachedPct: pct(r.reached, opened) }));
    const inSel = rows.filter((r) => r.minute >= sel.from && r.minute < sel.to);
    const peakIn = (key) => inSel.reduce((best, r) => (r[key] > (best ? best[key] : 0) ? r : best), null);
    return {
      studentsBased: !!st,
      opened,
      rows,
      st,
      moments: findMoments(rows, opened),
      peakBack: peakIn("back"),
      peakSkip: peakIn("skip"),
      peakPause: peakIn("pause"),
      maxMagnitude: Math.max(1, ...rows.map((r) => Math.max(r.back, r.skip))),
      maxPause: Math.max(1, ...rows.map((r) => r.pause)),
    };
  }, [data, lesson, sel.from, sel.to]);

  const header = (
    <PanelHeader
      title="Clickstream"
      info="Where students jumped back, skipped ahead or paused, counted in students (not clicks). Seeks are shown where students landed. Click any minute to watch it."
    >
      {refreshing && <span className="tc-spinner" aria-label="Refreshing" />}
    </PanelHeader>
  );

  const shell = (children) => (
    <section className="tc-panel" aria-label="Clickstream" aria-busy={refreshing}>
      {header}
      {children}
    </section>
  );

  if (status === "loading") return shell(<PanelSkeleton rows={3} />);

  if (status === "error" || !model)
    return shell(
      <PanelState
        error
        icon="fa-exclamation-triangle"
        title="Couldn't load viewing data"
        text={errorText(error)}
        action={<button type="button" className="tc-btn" onClick={load}><i className="fas fa-redo-alt" /> Try again</button>}
      />
    );

  if (!model.opened)
    return shell(<PanelState icon="fa-play-circle" title="No one has watched this lesson yet" text="Share the student link to see where students jump back, skip or pause." />);

  const { st, opened } = model;
  const selTo = Math.min(sel.to, model.rows.length) - 1;
  const lim = Math.ceil(model.maxMagnitude / 10) * 10;
  const inSel = (m) => sel.partial && m >= sel.from && m < sel.to;
  const cols = { gridTemplateColumns: `repeat(${model.rows.length}, 1fr)` };

  return shell(
    <>
      {error && (
        <div className="tc-banner" role="alert">
          <i className="fas fa-exclamation-circle" /> Couldn't refresh; showing the last data.
          <button type="button" className="tc-btn" onClick={load}>Retry</button>
        </div>
      )}
      <div className="tc-stats">
        {st && st.reached_end !== null && (
          <Stat value={`${pct(st.reached_end, opened)}%`} label="watched to the end" info={`${st.reached_end} of ${opened} students (estimated from the furthest point each reached).`} />
        )}
        <Stat value={st ? st.jumped_back : "—"} label="jumped back" info="Students who went back to an earlier point at least once; often a sign a part was hard." />
        <Stat value={st ? st.skipped : "—"} label="skipped ahead" info="Students who jumped forward past part of the video." />
        <Stat value={st ? st.paused : "—"} label="paused" info="Students who paused at least once." />
        <span className="tc-stats-of" title="Students who opened the lesson">of {opened}</span>
      </div>

      <div className="tc-lanes" role="group" aria-label={`Viewing behaviour per minute over the ${model.rows.length}-minute video`}>
        {model.studentsBased && (
          <>
            <div className="tc-lane-label">Still watching</div>
            <div className="tc-strip is-reach" style={cols}>
              {model.rows.map((r) => (
                <button
                  type="button"
                  key={r.minute}
                  className={"tc-strip-cell" + (inSel(r.minute) ? " is-sel" : "")}
                  onClick={() => focusRange(r.minute, r.minute + 1)}
                  title={`${fmtMin(r.minute)}: ${r.reached} of ${opened} still watching (${r.reachedPct}%)`}
                  aria-label={`${fmtMin(r.minute)}: ${r.reached} of ${opened} still watching`}
                >
                  <span style={{ height: `${Math.max(2, r.reachedPct)}%` }} />
                </button>
              ))}
            </div>
          </>
        )}

        <div className="tc-lane-label">Paused</div>
        <div className="tc-strip is-pause" style={cols}>
          {model.rows.map((r) => {
            const d = r.pause ? 4 + 9 * (r.pause / model.maxPause) : 0;
            return (
              <button
                type="button"
                key={r.minute}
                className={"tc-strip-cell" + (inSel(r.minute) ? " is-sel" : "")}
                onClick={() => focusRange(r.minute, r.minute + 1)}
                title={`${fmtMin(r.minute)}: ${r.pause} student${r.pause === 1 ? "" : "s"} paused`}
                aria-label={`${fmtMin(r.minute)}: ${r.pause} students paused`}
              >
                {d > 0 && <span style={{ width: d, height: d }} />}
              </button>
            );
          })}
        </div>

        <div className="tc-lane-label is-split">
          <span><i className="sw" style={{ background: C.back }} />Jumped back</span>
          <span><i className="sw" style={{ background: "#fff", border: `1.5px solid ${C.skip}` }} />Skipped to</span>
        </div>
        <div className="tc-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={model.rows}
              margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
              stackOffset="sign"
              onClick={(e) => { if (e && e.activeLabel !== undefined) focusRange(e.activeLabel, e.activeLabel + 1); }}
            >
              <CartesianGrid vertical={false} stroke={C.grid} />
              {sel.partial && <ReferenceArea x1={sel.from} x2={selTo} fill={C.band} fillOpacity={0.55} ifOverflow="extendDomain" />}
              <XAxis dataKey="minute" tickFormatter={fmtMin} tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} height={20} />
              <YAxis orientation="right" domain={[-lim, lim]} ticks={[-lim, 0, lim]} tickFormatter={(v) => Math.abs(v)} tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
              <ReferenceLine y={0} stroke="#acaab8" />
              <Bar dataKey="back" fill={C.back} radius={[3, 3, 0, 0]} maxBarSize={18} stackId="s" />
              <Bar dataKey="skipNeg" fill="#fff" stroke={C.skip} strokeWidth={1.25} radius={[0, 0, 3, 3]} maxBarSize={18} stackId="s" />
              <Tooltip content={<ChartTip opened={opened} />} cursor={{ fill: "rgba(147, 51, 234, 0.07)" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="tc-chips" aria-label="Moments to review">
        <span className="tc-chips-label">Review</span>
        {model.moments.length ? (
          model.moments.map((m) => {
            const inRange = sel.partial && m.from < sel.to && m.to > sel.from;
            return (
              <button
                type="button"
                key={m.key + m.from}
                className={`tc-chip is-${m.key}` + (inRange ? " is-sel" : "")}
                onClick={() => focusRange(m.from, m.to)}
                title={`${m.label} ${fmtMin(m.from)}–${fmtMin(m.to)}: up to ${m.peak} of ${opened} students (${m.share}%) in one minute. ${m.hint}. Click to watch.`}
              >
                <i className={`fas ${m.icon}`} aria-hidden="true" />
                <span className="num">{fmtMin(m.from)}–{fmtMin(m.to)}</span>
                <b className="num">{m.peak}</b>
              </button>
            );
          })
        ) : (
          <span className="tc-chips-none">No moment stands out; viewing was fairly even.</span>
        )}
      </div>
    </>
  );
}
