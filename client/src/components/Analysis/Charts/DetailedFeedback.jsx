import React, { useState, useEffect } from "react";
import { OverlayTrigger, Popover } from "react-bootstrap";
import "../../../assets/styles/detailed-feedback.scss";
import useFeedback from "provider/feedback";
import { useOptions } from "../../../utils/useOptions";

const colors = {
  difficult: "#ff7785",
  intersect: "#c84747",
  easy: "#ffbc55",
  boring: "#9F8CFF",
  engaging: "#69b9a6",
};

function useOptionsSubTypes() {
  const { options } = useOptions();

  const [result, setResult] = useState({});

  useEffect(() => {
    if (options) {
      const r = { none: "None" };

      Object.keys(options).forEach((k) => {
        if (Array.isArray(options[k])) {
          options[k].forEach((o) => {
            r[o.id] = o.name;
          });
        }
      });
      setResult(r);
    }
  }, [options]);

  return result;
}

const convertToOtherData = (data = []) => {
  if (data) {
    return data.filter((v) => v !== null).map((v, k) => ({ key: k, name: v }));
  }
  return [];
};

function DetailedFeedbackChart() {
  const { data, activated } = useFeedback();

  const active = activated.reduce((pv, cv) => {
    return { ...pv, [cv]: true };
  }, {});

  const feedbackSubTypes = useOptionsSubTypes();

  const convertDifficultData = (data = []) =>
    data.map((d) => ({
      name: feedbackSubTypes[d.key],
      others: d.others,
      percentage: d.percentage,
      students: d.students || 0,
      minutes: d.minutes || [],
      values: d.values
        ? d.values.map((dVal) => ({
            name: feedbackSubTypes[dVal.key],
            percentage: dVal.percentage,
            students: dVal.students || 0,
            minutes: dVal.minutes || [],
          }))
        : null,
    }));

  const difficultActive = active.net_difficult || active.difficult;
  const easyActive = active.net_difficult || active.easy;
  const boringActive = active.net_engaging || active.boring;
  const engagingActive = active.net_engaging || active.engaging;

  const feedbackTypes = [
    { name: "Difficult", key: "difficult", color: colors.difficult, active: difficultActive },
    { name: "Easy", key: "easy", color: colors.easy, active: easyActive },
    { name: "Boring", key: "boring", color: colors.boring, active: boringActive },
    { name: "Engaging", key: "engaging", color: colors.engaging, active: engagingActive },
  ];

  const divisionsData = {
    easy: convertDifficultData(data.detailed.easy),
    difficult: convertDifficultData(data.detailed.difficult),
    engaging: convertDifficultData(data.detailed.engaging),
    boring: convertDifficultData(data.detailed.boring),
  };

  const otherData = {
    easy: convertToOtherData(data.detailed.others.easy),
    difficult: convertToOtherData(data.detailed.others.difficult),
    engaging: convertToOtherData(data.detailed.others.engaging),
    boring: convertToOtherData(data.detailed.others.boring),
  };

  return (
    <div className="detailed-chart-container">
      <div className="detailed-chart-caption">DEBE Reasons</div>
      <div className="detailed-chart">
        {feedbackTypes.map((fd, key) => {
          return (
            <div key={key} className="detailed-chart-column" style={fd.active ? {} : { opacity: 0.2 }}>
              <div className="detailed-chart-column-inner">
                <div className="detailed-chart-column-header">{fd.name}</div>
                <div className="detailed-chart-column-body" style={{ backgroundColor: fd.color }}>
                  <InnerFeedback divisions={divisionsData[fd.key]} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="other-reasons-container">
        <h6 className="pt-1 mb-0">Other Reasons</h6>
        <div className="other-reasons">
          {feedbackTypes.map((fd, key) => {
            return (
              <div key={key} className="inner-div" style={fd.active ? {} : { opacity: 0.2 }}>
                {otherData[fd.key].map((other, key2) => (
                  <div style={{ backgroundColor: fd.color }} className="reason-name" key={key2} title={feedbackSubTypes[other.key]}>
                    {other.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const studentsLabel = (n) => `${n} student${n === 1 ? "" : "s"}`;
// Minute buckets are 1-based: minute 15 covers 14:00–15:00 of the video.
const minuteLabel = (m) => `${m - 1}–${m} min`;

/** "Complex terms (jargon): 8 students" plus when they said it, per minute. */
function ReasonDetail({ name, students, minutes = [] }) {
  return (
    <div>
      <div>
        {name}: <strong>{studentsLabel(students)}</strong>
      </div>
      {minutes.length > 0 && (
        <div className="text-muted" style={{ fontSize: "0.8em" }}>
          {minutes.map((m) => `${minuteLabel(m.minute)}: ${m.students}`).join(" · ")}
        </div>
      )}
    </div>
  );
}

function InnerFeedback({ divisions = [] }) {
  return (
    <>
      {divisions.map((d, key) => {
        const popover = (
          <Popover>
            <Popover.Content>
              {d.others && d.values ? (
                d.values.map((dVal, dKey) => {
                  return (
                    <React.Fragment key={dKey}>
                      <ReasonDetail name={dVal.name} students={dVal.students} minutes={dVal.minutes} />
                      {dKey < d.values.length - 1 && <hr className="my-1" />}
                    </React.Fragment>
                  );
                })
              ) : (
                <ReasonDetail name={d.name} students={d.students} minutes={d.minutes} />
              )}
            </Popover.Content>
          </Popover>
        );
        return (
          <OverlayTrigger key={key} trigger={["hover", "focus"]} placement="left" overlay={popover}>
            <div title={d.others ? "Miscellaneous" : d.name} key={key} className="inner-feedback" style={{ height: d.percentage + "%", background: "rgba(255,255,255," + 0.2 * key + ")" }}>
              <span
                className="text-truncate"
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "initial",
                  display: "-webkit-box",
                  WebkitLineClamp: Math.round((3 * d.percentage) / 30),
                  WebkitBoxOrient: "vertical",
                }}
              >
                {d.others ? "" : d.name}
              </span>
            </div>
          </OverlayTrigger>
        );
      })}
    </>
  );
}

export default DetailedFeedbackChart;
