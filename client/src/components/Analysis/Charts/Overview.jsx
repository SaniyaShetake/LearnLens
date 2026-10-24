import React, { useEffect, useState, useRef } from "react";
import { ComposedChart, Scatter, Line, ReferenceArea, Label, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import useFeedback from "provider/feedback";
import { useAuth } from "provider/auth";

const colors = {
  difficult: "#FF7785",
  easy: "#FFBC55",
  // net_difficult: "#FF9A6D",
  net_difficult: "#FF7785",
  boring: "#9F8CFF",
  engaging: "#69B9A6",
  // net_engaging: "#84A3D3",
  net_engaging: "#69B9A6",
  intersect: "#C84747",
};

const CustomTooltip = ({ active, payload, activeFields = {}, details = false, yMax = 10 }) => {
  if (active && payload && payload[0]) {
    const data = payload[0].payload;
    const { net_engaging, net_difficult } = details
      ? {
        net_engaging: true,
        net_difficult: true,
        difficult: true,
        easy: true,
        boring: true,
        engaging: true,
      }
      : activeFields;

    const getPercentage = (value) => {
      return value;
    };

    if (data.minute < 1) return null;

    return (
      <div className="overview-graph-tooltip">
        <div className="minute">
          <span className="name">Minute: </span>
          <span className="value">
            {data.minute - 1} - {data.minute}
          </span>
        </div>

        <div className="sb">
          {net_difficult && (
            <div className="data" style={{ fontWeight: activeFields.net_difficult ? 600 : undefined }}>
              <span className="color" style={{ background: colors.net_difficult }}></span>
              <span className="name">Net difficultly: </span>
              <span style={{ fontWeight: activeFields.net_difficult ? 600 : undefined }} className="value">
                {getPercentage(details ? data.scatter_net_difficult : data.net_difficult)}
              </span>
            </div>
          )}
          {net_engaging && (
            <div className="data" style={{ fontWeight: activeFields.net_engaging ? 600 : undefined }}>
              <span className="color" style={{ background: colors.net_engaging }}></span>
              <span className="name">Net engagement: </span>
              <span style={{ fontWeight: activeFields.net_engaging ? 600 : undefined }} className="value">
                {getPercentage(details ? data.scatter_net_engaging : data.net_engagement)}
              </span>
            </div>
          )}
          {/* {difficult && (
            <div className="data" style={{ fontWeight: activeFields.difficult ? 600 : undefined }}>
              <span className="color" style={{ background: colors.difficult }}></span>
              <span className="name">Difficult: </span>
              <span style={{ fontWeight: activeFields.difficult ? 600 : undefined }} className="value">
                {getPercentage(details ? data.scatter_difficult : data.difficult)}
              </span>
            </div>
          )}
          {easy && (
            <div className="data" style={{ fontWeight: activeFields.easy ? 600 : undefined }}>
              <span className="color" style={{ background: colors.easy }}></span>
              <span className="name">Easy: </span>
              <span style={{ fontWeight: activeFields.easy ? 600 : undefined }} className="value">
                {getPercentage(details ? data.scatter_easy : data.easy)}
              </span>
            </div>
          )}
          {boring && (
            <div className="data" style={{ fontWeight: activeFields.boring ? 600 : undefined }}>
              <span className="color" style={{ background: colors.boring }}></span>
              <span className="name">Boring: </span>
              <span style={{ fontWeight: activeFields.boring ? 600 : undefined }} className="value">
                {getPercentage(details ? data.scatter_boring : data.boring)}
              </span>
            </div>
          )}
          {engaging && (
            <div className="data" style={{ fontWeight: activeFields.engaging ? 600 : undefined }}>
              <span className="color" style={{ background: colors.engaging }}></span>
              <span className="name">Engaging: </span>
              <span style={{ fontWeight: activeFields.engaging ? 600 : undefined }} className="value">
                {getPercentage(details ? data.scatter_engaging : data.engaging)}
              </span>
            </div>
          )} */}
        </div>

        <p style={{ marginTop: ".8rem" }}>
          <span>
            Click to select <br />
            this minute
          </span>
        </p>
      </div>
    );
  }
  return null;
};

const FadingContainer = ({ show = false }) => <div className={"nd-fading-container " + (show ? " show" : "")} />;

const CustomizedDot = (props) => {
  const { cx, cy, fill, show } = props;

  if (show)
    return (
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" x={cx - 5 * 1.2} y={cy - 5 * 1.2} width={10 * 1.2} height={10 * 1.2} fill={fill}>
        <circle cx="50" cy="50" r="30" strokeWidth={15} stroke="#fff" opacity={0.9} />
      </svg>
    );
  return null;
};

const OverviewChart = ({ active = {} }) => {
  const { data, range, setRange, lesson, setHasChanges, activated, setAct } = useFeedback();
  const { user, setShowUpgradeModal } = useAuth();

  const [fading, setFading] = useState(false);
  const [axesRange, setAxesRange] = useState({ x: ["auto", "auto"], y: ["auto", "auto"] });
  // Per-student detail dots; the chart click now selects a minute instead of toggling these.
  const [showDetails] = useState(false);

  // Clicking a point selects that one minute: point "m" is the minute (m-1)–m (see CustomTooltip),
  // so the range becomes [m-1, m]. Same effect as dragging the range slider there.
  const handleSelectMinute = (e) => {
    if (!e || e.activeLabel === undefined || e.activeLabel === null) return;
    if (user.feature_level !== "advanced") {
      setShowUpgradeModal(true);
      return;
    }
    const lastMinute = lesson && lesson.minutes ? lesson.minutes : Infinity;
    const end = Math.min(Math.max(1, Math.round(Number(e.activeLabel))), lastMinute);
    if (!Number.isFinite(end)) return;
    if (range[0] === end - 1 && range[1] === end) return;
    setAct(activated);
    setRange([end - 1, end]);
    setHasChanges(true);
  };
  const sub = useRef(true);
  const timer = useRef(null);

  const handleFading = () => {
    setFading(true);

    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    timer.current = setTimeout(() => setFading(false), 1200);
  };

  useEffect(() => {
    if (data && data.minute && data.class_feedback) {
      const formatScatterData = () => {
        if (Array.isArray(data.class_feedback)) {
          /** @type { Array<any> } */
          const classFeedback = data.class_feedback;
          return classFeedback.map((cfb) => {
            return {
              minute: cfb.minute,
              scatter_net_difficult: Math.round((cfb.difficult - cfb.easy)),
              scatter_net_engaging: Math.round((cfb.engaging - cfb.boring) ),
              scatter_easy: cfb.easy,
              scatter_difficult: cfb.difficult,
              scatter_engaging: cfb.engaging,
              scatter_boring: cfb.boring,
            };
          });
        }
        return [];
      };

      const formatData = () => {
        if (data.minute) {
          const scatterData = formatScatterData();

          return data.minute.map((dm, key) => ({
            ...dm,
            ...(scatterData[key] || {}),
          }));
        }
        return [];
      };

      const dm = formatData();
      const values = [];

      let idx = 0;
      while (idx < dm.length) {
        const d = dm[idx];
        values.push(d.net_engagement, d.net_difficult, d.difficult, d.easy, d.boring, d.engaging, d.scatter_net_engagement, d.scatter_net_difficult, d.scatter_difficult, d.scatter_easy, d.scatter_boring, d.scatter_engaging);
        idx += 1;
      }

      const vSort = values.sort((a, b) => b - a);
      const greatestEl = vSort[0] || 10;

      const rangeYEl = Math.ceil(greatestEl / 10) * 10;

      setAxesRange({ x: [dm[0] && dm[0].minute - 1, dm[dm.length - 1] && dm[dm.length - 1].minute], y: [-rangeYEl, rangeYEl] });
      handleFading();
    }
  }, [data]);

  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      sub.current = false;
    };
  }, []);

  const yMax = axesRange.y[1];

  const getTickFormatter = (val) => {
    return val;
  };

  const formatScatterData = () => {
    if (Array.isArray(data.class_feedback)) {
      /** @type { Array<any> } */
      const classFeedback = data.class_feedback;
      return [
        { minute: 0, scatter_net_difficult: 0, scatter_net_engagement: 0, scatter_easy: 0, scatter_difficult: 0, scatter_engaging: 0, scatter_boring: 0 },
        ...classFeedback.map((cfb) => {
          return {
            minute: cfb.minute,
            scatter_net_difficult: Math.round((cfb.difficult - cfb.easy)),
            scatter_net_engaging: Math.round((cfb.engaging - cfb.boring)),
            scatter_easy: cfb.easy,
            scatter_difficult: cfb.difficult,
            scatter_engaging: cfb.engaging,
            scatter_boring: cfb.boring,
          };
        }),
      ];
    }
    return [];
  };

  const formatData = () => {
    if (data.minute) {
      const scatterData = formatScatterData();

      return [{ minute: 0, easy: 0, difficult: 0, engaging: 0, boring: 0, net_difficult: 0, net_engagement: 0 }, ...data.minute].map((dm, key) => ({
        ...dm,
        ...(scatterData[key] || {}),
      }));
    }
    return [];
  };

  return (
    <div className="overview-graph">
      {/* {JSON.stringify({ r: formatScatterData() })} */}
      {/* <div className="filter-threshold">
        <Range
          className="linechart-threshold"
          allowOverlap={false}
          draggableTrack={false}
          values={[threshold]}
          step={STEP}
          min={MIN}
          max={MAX}
          onChange={handleSliderChange}
          renderTrack={handleSliderTrack(MIN, MAX, [threshold])}
          renderThumb={handleSliderThumb([threshold])}
        />
        <OverlayTrigger placement="right" trigger={["hover", "focus"]} overlay={<BSTooltip>Threshold</BSTooltip>}>
          <i className="ml-2 fas fa-info info-icon" />
        </OverlayTrigger>
      </div> */}
      <FadingContainer show={fading} />
      <ResponsiveContainer>
        <ComposedChart data={formatData()} onClick={handleSelectMinute} style={{ cursor: "pointer" }}>
          <CartesianGrid strokeDasharray="1 3" />

          <XAxis tickCount={10} dataKey="minute" domain={axesRange.x} type="number" allowDecimals={false} fontSize="calc(0.45vh + 0.45 * var(--tc-vw))">
            <Label value="Time in minutes" offset={-4} position="insideBottom" fontSize="calc(0.45vh + 0.45 * var(--tc-vw))" />
          </XAxis>

          <YAxis tickFormatter={getTickFormatter} width={43} domain={axesRange.y} type="number" allowDecimals={false} fontSize="calc(0.45vh + 0.45 * var(--tc-vw))">
            <Label value="Number of students" position="insideLeft" height={40} angle={-90} fontSize="calc(0.45vh + 0.45 * var(--tc-vw))" hanging="left" />
          </YAxis>

          <Tooltip activeFields={active} content={<CustomTooltip />} details={showDetails} yMax={yMax} />

          <ReferenceLine x={range[0]} stroke="#7c77a5" strokeWidth={2} />
          <ReferenceLine x={range[1]} stroke="#7c77a5" strokeWidth={2} />

          <ReferenceArea yAxis={0} x1={0} x2={range[0]} strokeOpacity={0} fill="#7c77a5" fillOpacity={0.2} />
          <ReferenceArea yAxis={0} x1={range[1]} strokeOpacity={0} fill="#7c77a5" fillOpacity={0.2} />

          <Line opacity={showDetails ? 0.4 : 1} type="monotone" strokeWidth={active.net_difficult ? 3 : 0} activeDot={false} dot={false} animationDuration={300} dataKey="net_difficult" fill={colors.net_difficult} stroke={colors.net_difficult} />

          <Line opacity={showDetails ? 0.4 : 1} type="monotone" strokeWidth={active.net_engaging ? 3 : 0} activeDot={false} dot={false} animationDuration={300} dataKey="net_engagement" fill={colors.net_engaging} stroke={colors.net_engaging} />

          <Line opacity={showDetails ? 0.4 : 1} type="monotone" strokeWidth={active.difficult ? 3 : 0} activeDot={false} dot={false} animationDuration={300} dataKey="difficult" fill={colors.difficult} stroke={colors.difficult} />

          <Line opacity={showDetails ? 0.4 : 1} type="monotone" strokeWidth={active.easy ? 3 : 0} activeDot={false} dot={false} animationDuration={300} dataKey="easy" fill={colors.easy} stroke={colors.easy} />

          <Line opacity={showDetails ? 0.4 : 1} type="monotone" strokeWidth={active.boring ? 3 : 0} activeDot={false} dot={false} animationDuration={300} dataKey="boring" fill={colors.boring} stroke={colors.boring} />

          <Line opacity={showDetails ? 0.4 : 1} type="monotone" strokeWidth={active.engaging ? 3 : 0} activeDot={false} dot={false} animationDuration={300} dataKey="engaging" fill={colors.engaging} stroke={colors.engaging} />

          {[
            // "difficult", "easy", "engaging", "boring",
            "net_difficult", "net_engaging"].map((dataKey) => (
            <Scatter
              hide={!active[dataKey]}
              key={`scatter_${dataKey}_key`}
              dataKey={`scatter_${dataKey}`}
              name={`scatter_${dataKey}`}
              // data={formatScatterData()}
              shape={<CustomizedDot cx={20} cy={20} fill={colors[dataKey]} show={showDetails} />}
              fill={colors[dataKey]}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
export default OverviewChart;
