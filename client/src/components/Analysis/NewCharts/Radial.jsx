import React, { useState, useEffect } from "react";
import HeatmapSvg from "components/HeatmapSvg";
import useFeedback from "provider/feedback";
import { Form } from "react-bootstrap";

Radial.propTypes = {};

function Radial() {
  const { data, threshold, lesson, activated } = useFeedback();

  const [validResponses, setValidResponses] = React.useState(0);

  useEffect(() => {
    const participation_all = data.participation_all;

    if (participation_all && lesson.watched) {
      const validResponsesSet = new Set();

      if (participation_all) {
        participation_all.easy.forEach(validResponsesSet.add, validResponsesSet);
        participation_all.difficult.forEach(validResponsesSet.add, validResponsesSet);
        participation_all.engaging.forEach(validResponsesSet.add, validResponsesSet);
        participation_all.boring.forEach(validResponsesSet.add, validResponsesSet);
      }

      setValidResponses(validResponsesSet.size);
    }
  }, [data.participation_all, lesson.watched]);

  const [toggleRadial, setToggleRadial] = useState(false);

  const handleToggleRadial = () => {
    setToggleRadial((s) => !s);
  };

  const handleToggleRadialSelect = (val) => () => {
    setToggleRadial(val);
  };

  const active = activated.reduce((pv, cv) => {
    return { ...pv, [cv]: true };
  }, {});

  if (data && data.unique)
    return (
      <div className="td-radial-heatmap">
        <div className="nd-radial-slider" key="radial-x">
          <div className="toggle-percentage">
            <div className="mr-2" onClick={handleToggleRadialSelect(false)} style={{ cursor: "pointer" }}>
              Students
            </div>
            <Form.Check checked={toggleRadial} onChange={handleToggleRadial} type="switch" id="custom-switch-2" />
            <div onClick={handleToggleRadialSelect(true)} style={{ cursor: "pointer" }}>
              Clicks
            </div>
          </div>
          {/* <Range allowOverlap={false} draggableTrack={false} values={[threshold]} step={STEP} min={MIN} max={MAX} onChange={handleSliderChange} renderTrack={handleSliderTrack(MIN, MAX, [threshold])} renderThumb={handleSliderThumb([threshold])} /> */}
        </div>
        <div className="child-caption">DEBE Distribution</div>
        {toggleRadial ? (
          <HeatmapSvg active={active} easyAll={data.radial.easy} boringAll={data.radial.boring} engagingAll={data.radial.engaging} difficultAll={data.radial.difficult} threshold={threshold} />
        ) : (
          <HeatmapSvg students active={active} easyAll={data.unique.easy} boringAll={data.unique.boring} engagingAll={data.unique.engaging} difficultAll={data.unique.difficult} total={validResponses} threshold={threshold} />
        )}
      </div>
    );
  return null;
}

export default Radial;
