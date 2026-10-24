import React from "react";
import ReactDOM from "react-dom";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./assets/styles/main.scss";
import "./assets/styles/learnlens-redesign.scss";

import App from "./App";
import { ProvideAuth } from "provider/auth";
import { BrowserRouter } from "react-router-dom";

ReactDOM.render(
  <BrowserRouter>
    <ProvideAuth>
      <App />
    </ProvideAuth>
  </BrowserRouter>,
  document.getElementById("tcherly")
);

// Old CRA builds shipped a service worker helper; make sure none is left registered.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((reg) => reg.unregister())).catch(() => {});
}
