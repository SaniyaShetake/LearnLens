import React, { useEffect, useState } from "react";
import Player from "../Player";
import useFeedback from "provider/feedback";
import Button from "components/Button";
import { Range, getTrackBackground } from "react-range";
import OverviewChart from "./Charts/Overview";
import { useAuth } from "provider/auth";

const COLORS = ["#7c77a5", "#cfcfcf", "#7c77a5"];

const handleSliderTrack =
  (MIN, MAX, values = []) =>
  function SliderTrack({ props, children }) {
    const background = getTrackBackground({ values: values, colors: COLORS, min: MIN, max: MAX });
    return (
      <div onMouseDown={props.onMouseDown} onTouchStart={props.onTouchStart} className="nd-slider-track-container" style={props.style}>
        <div className="nd-slider-track" ref={props.ref} style={{ background }}>
          {children}
        </div>
      </div>
    );
  };

const handleSliderThumb =
  (values = []) =>
  function SliderThumb({ props, index }) {
    return (
      <div {...props} className="nd-slider-thumb" style={props.style}>
        {values[index]}
      </div>
    );
  };

function Overview() {
  const { activated } = useFeedback();
  return (
    <div className="nd-overview">
      <OverviewVideo />
      <div className="nd-overview-slider">
        <OverviewRange />
      </div>
      <div className="nd-overview-chart">{<OverviewChart active={activated.reduce((pv, cv) => ({ ...pv, [cv]: true }), {})} />}</div>
      <OverviewButtons />
    </div>
  );
}

export function OverviewVideo({ dummyPlayer }) {
  const { lesson } = useFeedback();
  return <Player cantPlay={dummyPlayer} lesson={lesson} />;
}

export function OverviewRange() {
  const { range, setRange, lesson, setHasChanges, activated, setAct } = useFeedback();
  const { user, setShowUpgradeModal } = useAuth();

  const STEP = 1;
  const MIN = 0;
  const MAX = lesson.minutes;

  const [values, setValues] = useState(range);
  const handleSliderChange = (v) => {
    if (user.feature_level !== "advanced") {
      setShowUpgradeModal(true);
      return;
    }
    if (v[0] < v[1]) setValues(v);
  };

  const handleSliderFinalChange = (v) => {
    setAct(activated);
    setRange(values);
    setHasChanges(true);
  };

  useEffect(() => {
    setValues(range);
  }, [range]);

  return (
    <Range
      onFinalChange={handleSliderFinalChange}
      allowOverlap={false}
      draggableTrack={false}
      values={values}
      step={STEP}
      min={MIN}
      max={MAX}
      onChange={handleSliderChange}
      renderTrack={handleSliderTrack(MIN, MAX, values)}
      renderThumb={handleSliderThumb(values)}
    />
  );
}

export function OverviewButtons() {
  const { activated, setActivated, setHasChanges } = useFeedback();
  const { user, setShowUpgradeModal } = useAuth();

  const toggleActivated = (key) => (e) => {
    e.preventDefault();
    if (user.feature_level !== "advanced") {
      setShowUpgradeModal(true);
      return;
    }
    setActivated((a) => {
      const index = a.indexOf(key);

      if (index > -1) {
        const result = Array.from(a);
        result.splice(index, 1);

        return result;
      }

      if (a.length < 2) {
        return [...a, key];
      }

      return [key];
    });
    setHasChanges(true);
  };

  return (
    <div className="nd-overview-selection">
      <div className="nd-row">
        <Button active={activated.includes("net_difficult")} onClick={toggleActivated("net_difficult")} variant="net-difficult small" title="Net Difficulty" />
        <Button active={activated.includes("net_engaging")} onClick={toggleActivated("net_engaging")} variant="net-engaging small" title="Net Engagement" />
      </div>
      <div className="nd-row mt-3">
        <Button active={activated.includes("difficult")} onClick={toggleActivated("difficult")} variant="difficult small" title="Difficult" />
        <Button active={activated.includes("easy")} onClick={toggleActivated("easy")} variant="easy small" title="Easy" />
        <Button active={activated.includes("boring")} onClick={toggleActivated("boring")} variant="boring small" title="Boring" />
        <Button active={activated.includes("engaging")} onClick={toggleActivated("engaging")} variant="engaging small" title="Engaging" />
      </div>
    </div>
  );
}

export default Overview;
