import React from "react";

import { useAuth } from "provider/auth";

import PadlockSVG from "assets/images/padlock.svg";

function UpgradeBlock({ children }) {
  const { setShowUpgradeModal } = useAuth();

  const handleClick = (e) => {
    setShowUpgradeModal(true);
  };

  return (
    <>
      {children}
      <div onClick={handleClick} className="td-upgrade">
        <div className="td-upgrade-bg" />
        <div className="td-upgrade-fg">
          <img className="td-upgrade-lock" src={PadlockSVG} alt="td-upgrade-lock" />
          <p className="td-upgrade-text">Click to unlock</p>
        </div>
      </div>
    </>
  );
}

export default UpgradeBlock;
