import React from "react";
import Layout from "components/Layout";
import { Link } from "react-router-dom";

import NotFoundSVG from "../assets/images/error404.svg";
import JackhammerSVG from "../assets/images/jackhammer.svg";
import "../assets/styles/not-found.scss";

export function NotFound({ underConstruction = false }) {
  return <>

    <div className="not-found-container container">
      <div className="row align-items-center">
        <div className="col-sm-10 col-md-7 col-lg-5 nf-logo">
          <img src={underConstruction ? JackhammerSVG : NotFoundSVG} alt={underConstruction ? "under-construction" : "not-found"} />
        </div>
        <div className="col-sm-10 col-md-5 col-lg-7 text-center text-md-left">
          <div className="nf-text">{underConstruction ? "Page you're looking for is under development." : "Could not find the page you're looking for."}</div>
          <div className="nf-back">
            <Link to="/" className="btn btn-outline-dark">
              <i className="fas fa-long-arrow-alt-left" /> Back Home
            </Link>
          </div>
        </div>
      </div>
    </div>
    <div className="icon-by">
      <div>
        Icons by{" "}
        <a href="https://www.flaticon.com/authors/monkik" title="monkik" target="_blank" rel="noopener noreferrer">
          monkik
        </a>
        {", "}
        <a href="https://www.freepik.com" title="Freepik" target="_blank" rel="noopener noreferrer">
          Freepik
        </a>{" "}
        from{" "}
        <a href="https://www.flaticon.com/" title="Flaticon" target="_blank" rel="noopener noreferrer">
          www.flaticon.com
        </a>
      </div>
    </div>
  </>
}

function NotFoundPage({ underConstruction = false }) {
  return (
    <Layout>
      <NotFound />
    </Layout>
  );
}

export default NotFoundPage;
