import React from "react";
import Header from "./Header";
import useFeedback from "provider/feedback";

function Layout({ children, minifiedNav, pageName, showFooter = false, headerProps = {}, forStudent = false, ...props }) {
  const { headerName } = useFeedback();
  return (
    <>
      <Header minifiedNav={minifiedNav} pageName={pageName} lessonName={headerName} {...headerProps} forStudent={forStudent} />
      <main className={minifiedNav ? "main-expanded" : ""} {...props}>
        {children}
      </main>
    </>
  );
}

export default Layout;
