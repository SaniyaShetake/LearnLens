import React from "react";

export function TeacherDashboardChild({ className = "", name = "", children }) {
  return (
    <div className="td-child">
      {name && <div className="header">{name}</div>}
      <div className={"content" + (className ? " " + className : "")}>{children}</div>
    </div>
  );
}
