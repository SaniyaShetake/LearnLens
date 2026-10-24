import React from "react";

function Loader({ asDiv = false, label = "" }) {
  return (
    <div className={asDiv ? "div-loader" : "section-loader"}>
      <div className="loader">
        <div className="loader-border" />
      </div>
      {label && <div className="loader-label">{label}</div>}
    </div>
  );
}

export default Loader;
