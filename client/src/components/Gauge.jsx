import React from "react";
import PropTypes from "prop-types";

Gauge.propTypes = {
  value: PropTypes.number,
  total: PropTypes.number,
};

function Gauge({ value = 0, total = 100 }) {
  const percentage = value / total;
  const width = 200;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 27">
      <rect width={width} height="24" rx="6" fill="#e7e6ef" />
      {isNaN(percentage) ? (
        <>
          <text x="50%" y="50%" dominantBaseline="middle" fill="#1f1f1f" fontSize="10px" textAnchor="middle">
            <tspan className="tspan-gauge">0</tspan>
          </text>
        </>
      ) : (
        <>
          <rect width={width * percentage} height="24" rx="6" fill="#b9b4d4" />
          <text x="50%" y="50%" dominantBaseline="middle" fill="#1f1f1f" fontSize="10px" textAnchor="middle">
            <tspan className="tspan-gauge">
              {value} / {total}
            </tspan>
          </text>
        </>
      )}
    </svg>
  );
}

export default Gauge;
