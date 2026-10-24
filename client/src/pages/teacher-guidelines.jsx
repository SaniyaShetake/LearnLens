import { useRef, useState, useEffect } from "react";
import Footer from "components/Footer";
import Header from "components/Header";

import "assets/styles/guidelines.scss";

// import Reveal from "reveal.js";
import { RevealJS, Slide } from "@gregcello/revealjs-react";
import "reveal.js/dist/reveal.css";
import "reveal.js/dist/theme/white.css";

import Slide1JPG from "assets/images/guidelines/slide-1.png";
import Slide2PNG from "assets/images/guidelines/slide-2.png";
import Slide3PNG from "assets/images/guidelines/slide-3.png";
import Slide4JPG from "assets/images/guidelines/slide-4.jpg";
import Loader from "components/Loader";

function TeacherGuidelinesPage() {
  const subscribed = useRef(true);
  const timer = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subscribed.current = true;

    timer.current = setTimeout(() => {
      if (subscribed.current) {
        setLoading(false);
      }
    }, 750);

    return () => {
      subscribed.current = false;

      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  return (
    <>
      <Header pageName="Guidelines" />
      <section className="guidelines" style={{ position: "relative" }}>
        {loading ? (
          <Loader label="Loading Presentation" />
        ) : (
          <RevealJS embedded {...{ slideNumber: "c/t", autoSlide: 10000, controlsLayout: "edges", help: true, history: false, controlsTutorial: true, center: false }}>
            <Slide>
              <p style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Evaluate efficacy of lecture content with high precision and granularity.</p>
              <img src={Slide1JPG} alt="tcherly-guideline-1" />
            </Slide>
            <Slide>
              <p style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Explore cognitive-affective dynamics using line chart.</p>
              <img src={Slide2PNG} alt="tcherly-guideline-2" />
            </Slide>
            <Slide>
              <p style={{ fontSize: "1.5rem", marginBottom: ".25rem", fontWeight: "bold" }}>More complex analysis of lecture segments</p>
              <p style={{ fontSize: "1.25rem", marginBottom: "0" }}>Line chart showing the aggregate of students clicking each state and venn diagram indicating whether there was overlap in student populations clicking the four states.</p>
              <img src={Slide3PNG} alt="tcherly-guideline-3" />
            </Slide>
            <Slide>
              <p style={{ fontSize: "1.5rem", marginBottom: ".25rem", fontWeight: "bold" }}>Bookmark important section(s)</p>
              <p style={{ fontSize: "1.25rem", marginBottom: "0rem" }}>
                Add findings and questions based on analysis to support further actions and decisions.
                <br />
                For example, if you are planning a flipped classroom such insights after students watch the video lecture at home could help in designing interactive classroom sessions.
              </p>
              <div style={{ display: "flex", justifyContent: "center", alignContent: "center" }}>
                <img className="slide-4-img" src={Slide4JPG} alt="tcherly-guideline-4" />
              </div>
            </Slide>
          </RevealJS>
        )}
      </section>
      <Footer />
    </>
  );
}

export default TeacherGuidelinesPage;
