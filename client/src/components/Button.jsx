import React from "react";
import PropTypes from "prop-types";

Button.propTypes = {
  variant: PropTypes.string,
  onClick: PropTypes.func,
  title: PropTypes.string,
  active: PropTypes.bool
};

function Button({ variant, active = false, onClick, title }) {
  const className = "nd-btn " + (variant || "");
  return (
    <div onClick={onClick} className={className}>
      <div className={"check" + (active ? " active" : "")} />
      <div className="title">
        <div className="text">{title}</div>
      </div>
    </div>
  );
}

export default Button;
