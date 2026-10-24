import Footer from "components/Footer";
import React, { useState, useEffect } from "react";
import { Button } from "react-bootstrap";
import { Link, useHistory } from "react-router-dom";
import "../assets/styles/landing.scss";
import OnlineLearningPNG from "assets/images/student.png";
import ClassroomPNG from "assets/images/classroom.png";
import HeroPNG from "assets/images/hero.png";
import Header from "components/Header";
import { useAuth } from "provider/auth";
import WatchVideo from "components/watch-video";

const options = {
  class: [
    { id: 1, name: "Start lecture recording in the classroom" },
    { id: 2, name: "Collect student feedback" },
    { id: 3, name: "Analyze feedback on interactive teacher dashboard" },
  ],
  online: [
    { id: 1, name: "Upload a video lecture" },
    { id: 2, name: "Collect student feedback" },
    { id: 3, name: "Analyze feedback on interactive teacher dashboard" },
  ],
};

function LandingPage() {
  const [headerClass, setHeaderClass] = useState("");
  const { user } = useAuth();
  const history = useHistory();

  const listenScrollNav = () => {
    if (window.scrollY >= 100) setHeaderClass("header-scrolled");
    else setHeaderClass("");
  };

  const handleGetStarted = (e) => {
    if (user) {
      e.preventDefault();
      history.push("/dashboard");
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", listenScrollNav);

    return () => {
      window.removeEventListener("scroll", listenScrollNav);
    };
  }, []);

  return (
    <>
      <Header className={"landing-header d-flex justify-content-center fixed-top " + headerClass} navClasses="container-fluid" pageName="" />
      <section id="hero" className="hero position-relative">
        <div className="container">
          <div className="row">
            <div className="col-lg-5 col-xl-5 d-flex flex-column justify-content-center">
              <h1 className="mb-xl-4">Feedback to help teachers improve teaching practices</h1>
              <h2>Collection and analysis of student feedback made easy</h2>

              {/* <div className="container-fluid container-xl px-0">
                <div className="row justify-content-center">
                  <div className="col-xl-6">
                    <div className="card">
                      <div className="card-body">
                        <div className="head">
                          <span>Classroom Feedback</span>
                        </div>
                        <ul>
                          <li>Start lecture recording in the classroom</li>
                          <li>Collect student feedback</li>
                          <li>Analyze feedback on interactive teacher dashboard</li>
                        </ul>
                        <div className="text-center">
                          <Button size="sm">Watch video</Button>
                        </div>
                        <div className="text-center mt-3">
                          <Button className="rounded-pill">Get started</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-xl-6">
                    <div className="card">
                      <div className="card-body">
                        <div className="head">
                          <span>Classroom Feedback</span>
                        </div>
                        <ul>
                          <li>Start lecture recording in the classroom</li>
                          <li>Collect student feedback</li>
                          <li>Analyze feedback on interactive teacher dashboard</li>
                        </ul>
                        <div className="text-center">
                          <Button size="sm">Watch video</Button>
                        </div>
                        <div className="text-center mt-3">
                          <Button className="rounded-pill">Get started</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div> */}

              <div className="text-center text-lg-left">
                <a onClick={handleGetStarted} href="#get-started" className="btn-get-started d-inline-flex align-items-center justify-content-center align-self-center">
                  <span>Get Started </span>
                  <i className="fas fa-arrow-right" />
                </a>
              </div>
            </div>
            <div className="d-none d-lg-block col-lg-1 d-xl-none"></div>
            <div className="col-lg-6 col-xl-7 hero-img">
              <img src={HeroPNG} className="img-fluid" alt="tcherly-hero" />
            </div>
          </div>
        </div>
        {/* <div className="read-more">
          <a href="#read-more">Read more</a>
        </div> */}
      </section>
      <section id="get-started" className="portals py-5" style={{ background: "#fff" }}>
        <div className="container py-4 border-bottom">
          <div className="row justify-content-between align-items-center">
            <div className="col-lg-6 col-xl-6">
              <img src={OnlineLearningPNG} className="img-fluid" alt="" />
            </div>
            <div className="col-lg-6 mt-5 mt-lg-0 d-flex">
              <div className="container-fluid">
                <div className="row justify-content-center py-3">
                  <div className="col-lg-8">
                    <h3 className="text-center">
                      <span>Online Feedback</span>
                    </h3>

                    <div className="features mt-5 mb-4">
                      <div className="features mt-5 mb-4">
                        {options.online.map((c) => {
                          return (
                            <div key={c.id} className="feature-box d-flex align-items-center">
                              <i className="fas fa-circle" style={{ fontSize: ".5rem", color: "#9333ea", marginRight: 8 }} />
                              <h3>{c.name}</h3>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="text-center">
                      <WatchVideo />
                      <Button className="ml-3" as={Link} to="/register?mode=online">
                        <span>Get started </span>
                        <i className="fas fa-arrow-right" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="container py-4">
          <div className="row justify-content-between align-items-center">
            <div className="col-lg-6 mt-5 mt-lg-0 d-flex order-1 order-lg-0">
              <div className="container-fluid">
                <div className="row py-3 justify-content-center">
                  <div className="col-lg-8">
                    <h3 className="text-center">
                      <span>Classroom Feedback</span>
                    </h3>

                    <div className="features mt-5 mb-4">
                      {options.class.map((c) => {
                        return (
                          <div key={c.id} className="feature-box d-flex align-items-center">
                            <i className="fas fa-circle" style={{ fontSize: ".5rem" }} />
                            <h3>{c.name}</h3>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-center">
                      <Button>
                        <span>Coming soon</span>
                      </Button>
                      {/* <div className="mt-2">
                        <Button as={Link} to="/register?mode=offline">
                          <span>Get started </span>
                          <i className="fas fa-arrow-right" />
                        </Button>
                      </div> */}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-6 col-xl-6 order-0 order-lg-1">
              <img src={ClassroomPNG} className="img-fluid" alt="" />
            </div>
          </div>
        </div>
      </section>
      {/* <section style={{ minHeight: 450 }} id="features" className="features">
        <div className="container-fluid p-5">
           <div className="row justify-content-center">
            <div className="col-lg-6 col-xl-4">
              <img src={OnlineLearningPNG} className="img-fluid" alt="" />
            </div>

            <div className="col-lg-6 col-xl-5 mt-5 mt-lg-0 d-flex">
              <div className="container-fluid">
                <div className="row py-3">
                  <div className="col-lg-6">
                    <div className="card">
                      <div className="card-body text-center">
                        <h4>Basic</h4>
                        <p>
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque consequat, nunc at ultricies faucibus, arcu augue laoreet orci, vulputate maximus arcu leo vel quam. Praesent non aliquet ligula. Donec aliquam lacus eu tellus
                          sodales elementum. Etiam at ante vitae odio tincidunt suscipit sed dapibus ipsum. Fusce ultrices sapien non nibh convallis, vitae dictum turpis efficitur. Cras porttitor vehicula lectus sit amet sodales. Donec sit amet augue eget
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-body text-center">
                        <h4>Advanced</h4>
                        <p>
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque consequat, nunc at ultricies faucibus, arcu augue laoreet orci, vulputate maximus arcu leo vel quam. Praesent non aliquet ligula. Donec aliquam lacus eu tellus
                          sodales elementum. Etiam at ante vitae odio tincidunt suscipit sed dapibus ipsum. Fusce ultrices sapien non nibh convallis, vitae dictum turpis efficitur. Cras porttitor vehicula lectus sit amet sodales. Donec sit amet augue eget
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div> 
        </div>
      </section> */}
      <Footer />
    </>
  );
}

export default LandingPage;
