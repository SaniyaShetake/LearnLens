import React, { useState, useEffect, useRef } from "react";
import * as venn from "@upsetjs/venn.js";
import * as d3 from "d3";
import useFeedback from "provider/feedback";
import "assets/styles/venn.scss";
import Loader from "components/Loader";
import { Form } from "react-bootstrap";

// https://medium.com/@cmmyers/how-i-made-an-interactive-venn-diagram-with-d3-fa723c55a148

export class VennDiagram extends React.Component {
  subscribed = true;
  chart = null;
  div = null;
  tooltip = null;

  constructor(props) {
    super(props);
    this.chartRef = React.createRef();
    this.chart = venn.VennDiagram();
    this.chart.useViewBox();
    this.chart.duration(400);
  }

  drawDiagram(reset = false) {
    const { name = "", sets = [] } = this.props;

    if (reset && this.div && this.div.remove) {
      this.div.remove();
    }

    this.div = d3.select(this.chartRef.current);
    this.div.datum(sets).call(this.chart);

    d3.select("body").selectAll(`.venn-tooltip.${name}`).remove();

    this.tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "venn-tooltip " + name)
      .style("display", "none");

    this.div.selectAll("g.venn-area").each(function (datum) {
      const selection = d3.select(this);

      if (datum.invisible) {
        selection.remove();
      }
    });

    const vennAreas = this.div.selectAll("g.venn-area");
    vennAreas.each(function (datum) {
      const selection = d3.select(this);

      const pathSelect = selection.select("path");

      pathSelect.style("fill", datum.color).style("fill-opacity", datum.active ? 0.85 : 0.1);
      pathSelect
        .on("mouseover", function () {
          d3.select(this)
            .style("fill-opacity", datum.active ? 1 : 0.4)
            .style("stroke-width", 2)
            .style("stroke", "#000");
          d3.select(this.parentElement).select("text").style("opacity", 1);
        })
        .on("mouseout", function () {
          d3.select(this)
            .style("fill-opacity", datum.active ? 0.85 : 0.1)
            .style("stroke-width", 0)
            .style("stroke", "none");
          d3.select(this.parentElement)
            .select("text")
            .style("opacity", datum.active ? 1 : 0.1);
        });

      const textSelect = selection.select("text");

      textSelect
        .style("fill", "#000")
        .style("font-size", "3rem")
        .style("opacity", datum.active ? 1 : 0.1);
      textSelect.text((data) => {
        return data.size > 0 ? data.size : "";
      });

      textSelect
        .on("mouseover", function () {
          d3.select(this).style("font-size", "3.5rem").style("opacity", 1);
        })
        .on("mouseout", function () {
          d3.select(this)
            .style("font-size", "3rem")
            .style("opacity", datum.active ? 1 : 0.1);
        });
    });

    const _this = this;
    this.div
      .selectAll("g")
      .on("mouseover", function (_, d) {
        _this.tooltip.transition().duration(400).style("opacity", 1).style("display", "inline");
        _this.tooltip.text(`${Array.from(d.sets).join(", ")} - ${d.size} students`);
      })
      .on("mousemove", function (event) {
        _this.tooltip.style("left", event.pageX + "px").style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", function () {
        _this.tooltip.transition().duration(0).style("opacity", 0);
      });
  }

  componentDidMount() {
    this.drawDiagram();
  }

  componentDidUpdate() {
    this.drawDiagram(true);
  }

  componentWillUnmount() {
    this.subscribed = false;
  }

  render() {
    return <div className="venn-container" ref={this.chartRef} />;
  }
}

export function VennDiagrama({ name = "", sets = [], caption = "" }) {
  const chartRef = useRef();
  const mounted = useRef(false);
  const { activated, range } = useFeedback();
  const chart = venn.VennDiagram();

  chart.useViewBox();
  chart.duration(0);
  // chart.distinct(true);

  const drawDiagram = React.useCallback(
    (reset = false) => {
      let div;

      if (reset && div && div.remove) {
        div.remove();
      }

      div = d3.select(chartRef.current);
      div.datum(sets).call(chart);

      d3.select("body").selectAll(`.venn-tooltip.${name}`).remove();

      const tooltip = d3
        .select("body")
        .append("div")
        .attr("class", "venn-tooltip " + name)
        .style("display", "none");

      div.selectAll("g.venn-area").each(function (datum) {
        const selection = d3.select(this);

        if (datum.invisible) {
          selection.remove();
        }
      });

      const vennAreas = div.selectAll("g.venn-area");
      vennAreas.each(function (datum) {
        const selection = d3.select(this);

        const pathSelect = selection.select("path");
        const textSelect = selection.select("text");

        pathSelect.style("fill", datum.color).style("fill-opacity", datum.active ? 0.85 : 0.1);

        pathSelect
          .on("mouseover", function () {
            d3.select(this)
              .style("fill-opacity", datum.active ? 1 : 0.4)
              .style("stroke-width", 2)
              .style("stroke", "#000");
            d3.select(this.parentElement).select("text").style("opacity", 1).raise();
          })
          .on("mouseout", function () {
            d3.select(this)
              .style("fill-opacity", datum.active ? 0.85 : 0.1)
              .style("stroke-width", 0)
              .style("stroke", "none");
            d3.select(this.parentElement)
              .select("text")
              .style("opacity", datum.active ? 1 : 0.1)
              .order();
          });

        textSelect
          .style("fill", "#000")
          .style("font-size", "2rem")
          .style("opacity", datum.active ? 1 : 0.1)
          .text((data) => {
            return data.size > 0 ? data.size : "";
          });

        textSelect
          .on("mouseover", function () {
            d3.select(this).style("font-size", "2.5rem").style("opacity", 1);
          })
          .on("mouseout", function () {
            d3.select(this)
              .style("font-size", "2rem")
              .style("opacity", datum.active ? 1 : 0.1);
          });
      });

      div
        .selectAll("g")
        .on("mouseover", function (_, d) {
          tooltip.transition().duration(400).style("opacity", 1).style("display", "inline");
          tooltip.text(`${Array.from(d.sets).join(", ")} - ${d.size} students`);
        })
        .on("mousemove", function (event) {
          tooltip.style("left", event.pageX + "px").style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", function () {
          tooltip.transition().duration(0).style("opacity", 0);
        });
    },
    [chart, name, sets]
  );

  useEffect(() => {
    drawDiagram(mounted.current);
  }, [activated, range, drawDiagram]);

  useEffect(() => {
    mounted.current = true;

    return () => (mounted.current = false);
  }, []);

  return (
    <>
      <div className="venn-container" ref={chartRef}>
        {caption && <div className="venn-caption">{caption}</div>}
      </div>
    </>
  );
}

export default function Venn() {
  const { data, refreshing, activated } = useFeedback();

  const active = activated.reduce((pv, cv) => {
    return { ...pv, [cv]: true };
  }, {});

  const difficultActive = active.net_difficult || active.difficult;
  const easyActive = active.net_difficult || active.easy;
  const boringActive = active.net_engaging || active.boring;
  const engagingActive = active.net_engaging || active.engaging;

  const colors = {
    difficult: "#ff7785",
    difficult_easy: "#ff9a6d",
    difficult_boring: "#cf82c2",
    difficult_engaging: "#b49896",
    intersect: "#c84747",
    easy: "#ffbc55",
    easy_boring: "#cfa4aa",
    easy_engaging: "#b4bb7e",
    boring: "#9F8CFF",
    boring_engaging: "#84a2d3",
    engaging: "#69b9a6",
  };

  const [toggleType, setToggleType] = useState(false);

  const handleToggleType = () => {
    setToggleType((s) => !s);
  };

  const handleToggleTypeSelect = (val) => () => {
    setToggleType(val);
  };

  if (!data) return null;

  if (data.venn) {
    const venn1 = [
      { sets: ["Difficult"], size: data.venn.difficult || 0, color: colors.difficult, active: difficultActive },
      { sets: ["Easy"], size: data.venn.easy || 0, invisible: true, active: easyActive },
      { sets: ["Boring"], size: data.venn.boring || 0, color: colors.boring, active: boringActive },
      { sets: ["Engaging"], size: data.venn.engaging || 0, color: colors.engaging, active: engagingActive },
      { sets: ["Difficult", "Boring"], size: data.venn.difficult_boring || 0, color: colors.difficult_boring, active: difficultActive && boringActive },
      { sets: ["Engaging", "Difficult"], size: data.venn.difficult_engaging || 0, color: colors.difficult_engaging, active: difficultActive && engagingActive },
      { sets: ["Engaging", "Boring"], size: 0, invisible: true, active: 0 },
    ];

    const venn2 = [
      { sets: ["Difficult"], size: data.venn.difficult || 0, invisible: true, active: difficultActive },
      { sets: ["Easy"], size: data.venn.easy || 0, color: colors.easy, active: easyActive },
      { sets: ["Boring"], size: data.venn.boring || 0, color: colors.boring, active: boringActive },
      { sets: ["Engaging"], size: data.venn.engaging || 0, color: colors.engaging, active: engagingActive },
      { sets: ["Engaging", "Easy"], size: data.venn.engaging_easy || 0, color: colors.easy_engaging, active: easyActive && engagingActive },
      { sets: ["Boring", "Easy"], size: data.venn.boring_easy || 0, color: colors.easy_boring, active: easyActive && boringActive },
      { sets: ["Engaging", "Boring"], size: 0, invisible: true, active: 0 },
    ];

    const venn3 = [
      { sets: ["Difficult"], size: data.venn.difficult || 0, color: colors.difficult, active: difficultActive },
      { sets: ["Easy"], size: data.venn.easy || 0, color: colors.easy, active: easyActive },
      { sets: ["Boring"], size: data.venn.boring || 0, invisible: true, active: boringActive },
      { sets: ["Engaging"], size: data.venn.engaging || 0, invisible: true, active: engagingActive },
      { sets: ["Difficult", "Easy"], size: data.venn.difficult_easy || 0, color: colors.difficult_easy, active: difficultActive && easyActive },
    ];

    const venn4 = [
      { sets: ["Difficult"], size: data.venn.difficult || 0, invisible: true, active: difficultActive },
      { sets: ["Easy"], size: data.venn.easy || 0, invisible: true, active: easyActive },
      { sets: ["Boring"], size: data.venn.boring || 0, color: colors.boring, active: boringActive },
      { sets: ["Engaging"], size: data.venn.engaging || 0, color: colors.engaging, active: engagingActive },
      { sets: ["Engaging", "Boring"], size: data.venn.boring_engaging || 0, color: colors.boring_engaging, active: boringActive && engagingActive },
    ];

    return refreshing ? (
      <Loader asDiv />
    ) : (
      <>
        <div className="child-caption">DEBE Interactions</div>
        <div className="toggle-percentage">
          <div className="mr-2" onClick={handleToggleTypeSelect(false)} style={{ cursor: "pointer" }}>
            View 1
          </div>
          <Form.Check checked={toggleType} onChange={handleToggleType} type="switch" id="custom-switch" />
          <div onClick={handleToggleTypeSelect(true)} style={{ cursor: "pointer" }}>
            View 2
          </div>
        </div>
        <div className="td-venn-left">
          {toggleType ? <VennDiagrama caption="Engaging - Difficult - Boring" name="set1" sets={venn1} key={activated.join(",") + 1} /> : <VennDiagrama caption="Difficult - Easy" name="set3" sets={venn3} key={activated.join(",") + 3} />}
        </div>
        <div className="td-venn-right">
          {toggleType ? <VennDiagrama caption="Engaging - Easy - Boring" name="set2" sets={venn2} key={activated.join(",") + 2} /> : <VennDiagrama caption="Boring - Engaging" name="set4" sets={venn4} key={activated.join(",") + 4} />}
        </div>
      </>
    );
  }

  return <div className="d-flex justify-content-center align-items-center w-100">No data...</div>;
}
