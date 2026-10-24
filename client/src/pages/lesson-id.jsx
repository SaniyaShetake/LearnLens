import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import ReactPlayer from "react-player/lazy";
import { useParams, Link } from "react-router-dom";
import { BrowserView, MobileView, withOrientationChange } from "react-device-detect";
import Layout from "components/Layout";
import { CgClose } from "react-icons/cg";
import { FaArrowLeft } from "react-icons/fa";
import { useAuth } from "provider/auth";
import Loader from "components/Loader";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { getErrorMessage } from "handler/api";
import screenfull from "screenfull";

import "../assets/styles/mobile-player.scss";
import { useOptions } from "../utils/useOptions";
import { ProvideStudentAuth, useStudentAuth } from "provider/student-auth";
import StudentAuth from "components/student-auth";
import QuizOverlay from "components/QuizOverlay";
import { lessonVideoUrl } from "utils/video";

const playerOptions = {
  youtube: {
    embedOptions: {
      host: "https://www.youtube-nocookie.com",
    },
    playerVars: {
      modestbranding: 1,
      fs: 0,
      iv_load_policy: 3,
      autohide: 0,
      autoplay: 1,
    },
  },
  // Google Drive lessons (HTML5 video streamed through the server)
  file: {
    attributes: { controlsList: "nodownload", preload: "metadata" },
  },
};

const playerStyles = {};

// Analytics / log calls are fire-and-forget; failures must not surface as unhandled rejections.
const ignoreError = () => {};

function readSavedTimestamp(lessonId) {
  try {
    const value = parseInt(window.localStorage.getItem("lesson-" + lessonId) || "0", 10);
    return Number.isNaN(value) ? 0 : value;
  } catch (e) {
    return 0;
  }
}

function saveTimestamp(lessonId, timestamp) {
  try {
    window.localStorage.setItem("lesson-" + lessonId, timestamp);
  } catch (e) {}
}

function CourseIdLessonId() {
  const subs = useRef(true);

  const { request } = useAuth();
  const { id } = useParams();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    subs.current = true;

    return () => {
      subs.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchData = () => {
      setLoading(true);
      setError(null);

      // Public lesson view: only the lesson itself is used here (no bookmarks needed).
      request("GET", "/lessons/" + id)
        .then(({ data }) => {
          if (!subs.current) return;
          if (data && data.success && data.lesson) setLesson(data.lesson);
          else setError("This lesson could not be found.");
        })
        .catch((err) => {
          console.log(err);
          if (!subs.current) return;
          const status = err && err.response && err.response.status;
          setError(status === 404 ? "This lesson could not be found." : getErrorMessage(err, "Couldn't load this lesson, please try again."));
        })
        .finally(() => {
          if (subs.current) setLoading(false);
        });
    };

    fetchData();
  }, [id, request]);

  if (loading) return <Loader />;

  if (lesson)
    return (
      <ProvideStudentAuth>
        <Layout pageName="Feedback" forStudent>
          <MobileView>
            <MobilePlayerWOC lesson={lesson} />
          </MobileView>

          <BrowserView>
            <Player lesson={lesson} />
          </BrowserView>
        </Layout>
      </ProvideStudentAuth>
    );
  return (
    <Layout pageName="Feedback">
      <div className="container py-5">
        <Alert variant="danger" className="text-center">
          {error || "Couldn't load this lesson."}
        </Alert>
      </div>
    </Layout>
  );
}

function MobilePlayer({ lesson, isLandscape, isPortrait }) {
  const playerRef = useRef();
  const scrollToTop = useRef(null);

  const [beenPlayed, setBeenPlayed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [data, setData] = useState(null);
  const [timestamp, setTimestamp] = useState(null);

  const { options } = useOptions();
  const { isLoggedIn, data: studentData, refresh, request } = useStudentAuth();

  // React.useEffect(() => {
  //   let duration = 0;

  //   if (playerRef.current) {
  //     const _duration = playerRef.current.getCurrentTime();

  //     if (_duration) {
  //       duration = _duration;
  //     }
  //   }

  //   return () => {
  //     if (isLoggedIn) request("POST", `/lessons/${lesson.id}/log`, { action: "lesson_leave", duration: duration, date_client: Date.now() }, { withCredentials: true });
  //   };
  // }, [lesson.id]);

  const videoOnPlay = async () => {
    if (!beenPlayed) {
      if (playerRef.current) {
        const ts = readSavedTimestamp(lesson._id);
        if (ts > 20) {
          setPlaying(true);
          playerRef.current.seekTo(ts, "seconds");
        }
      }
    }

    // const _name = localStorage.getItem("debe-studentname");
    request("POST", `/lessons/${lesson.id}/watched`, {}, { withCredentials: true }).catch(ignoreError);

    let duration = 0;

    if (playerRef.current) {
      const _duration = playerRef.current.getCurrentTime();

      if (_duration) {
        duration = _duration;
      }
    }

    request("POST", `/lessons/${lesson.id}/log`, { action: "play", duration: duration, date_client: Date.now() }, { withCredentials: true }).catch(ignoreError);

    setPlaying(true);
    if (isLandscape && scrollToTop.current) {
      try {
        if (screenfull.isEnabled) {
          screenfull.on("error", () => {});
          await screenfull.request(scrollToTop.current, { navigationUI: "hide" });
        }
      } catch (error) {}
    }
  };

  const videoOnProgress = ({ playedSeconds }) => {
    const currentTimestamp = Math.floor(playedSeconds);

    const difference = currentTimestamp - timestamp;

    if (difference >= 5) {
      request("POST", `/lessons/${lesson.id}/log`, { action: "forward_seek", duration: playedSeconds, date_client: Date.now() }, { withCredentials: true }).catch(ignoreError);
    }

    if (difference <= -5) {
      request("POST", `/lessons/${lesson.id}/log`, { action: "backward_seek", duration: playedSeconds, date_client: Date.now() }, { withCredentials: true }).catch(ignoreError);
    }

    setTimestamp(currentTimestamp);
  };

  const videoOnStart = () => {
    setBeenPlayed(true);
  };

  const videoOnReady = () => {
    request("POST", `/lessons/${lesson.id}/log`, { action: "lesson_joined", date_client: Date.now() }, { withCredentials: true }).catch(ignoreError);
  };

  const videoOnPause = () => {
    setPlaying(false);
    let duration = 0;

    if (playerRef.current) {
      const _duration = playerRef.current.getCurrentTime();

      if (_duration) {
        duration = _duration;
      }
    }

    request("POST", `/lessons/${lesson.id}/log`, { action: "pause", duration: duration, date_client: Date.now() }, { withCredentials: true }).catch(ignoreError);
  };

  const videoOnBuffer = () => {
    setOverlay(false);
  };

  const videoOnBufferEnd = () => {};

  const handleFeedback = (key) => (e) => {
    setData({
      feedback: key,
      timestamp,
    });
  };
  const [otherFeedbackModal, setOtherFeedbackModal] = useState(false);
  const [otherFeedback, setOtherFeedback] = useState("");
  const handleOtherFeedbackChange = (e) => {
    const val = e.target.value;
    setOtherFeedback(val);
  };
  const handleOtherFeedbackShow = (e) => {
    if (scrollToTop.current && screenfull.isFullscreen) {
      screenfull.exit(scrollToTop.current);
    }
    setOtherFeedbackModal(true);
  };
  const handleOtherFeedbackCancel = (e) => {
    setOtherFeedback("");
    setOtherFeedbackModal(false);
  };
  const handleOtherFeedbackSend = (e) => {
    if (studentData)
      request("POST", "/lessons/" + lesson.id, { ...data, feedback_type: "other", other_message: otherFeedback, student_id: studentData._id }, { withCredentials: true })
        .then(({ data }) => {})
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {
          setData(null);
          setOtherFeedback("");
          setOtherFeedbackModal(false);
        });
  };
  const handleCaputureFeedback = (key) => (e) => {
    if (studentData)
      request("POST", "/lessons/" + lesson.id, { ...data, feedback_type: key, student_id: studentData._id }, { withCredentials: true })
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {
          setData(null);
          setPlaying(true);
        });
  };
  const handleOverlayClick = (e) => {
    e.preventDefault();
    setOverlay(false);
  };

  const subscribed = useRef(true);

  useEffect(() => {
    if (beenPlayed && timestamp > 0) {
      saveTimestamp(lesson._id, timestamp);
    }
  }, [timestamp, lesson, beenPlayed]);

  useEffect(() => {
    subscribed.current = true;

    return () => {
      subscribed.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (isLandscape && scrollToTop.current) {
      if (playing) {
        scrollToTop.current.scrollIntoView({ behavior: "auto", block: "start" });
      }
    }
  }, [isLandscape, scrollToTop, playing]);

  // useEffect(() => {
  //   const studentName = localStorage.getItem("debe-studentname");

  //   if (!studentName) {
  //   }
  // }, []);

  useEffect(() => {
    refresh().catch(ignoreError);
  }, [refresh]);

  if (!isLoggedIn)
    return (
      <>
        <StudentAuth />
      </>
    );

  // if (showNameModal)
  //   return (
  //     <div style={{ height: "100%", width: "100%", backgroundColor: "#c8c8c8" }}>
  //       <Modal centered size="sm" show={showNameModal} onHide={() => {}}>
  //         <Modal.Body>
  //           <Form.Group controlId="studentname">
  //             <Form.Label>Please enter your name</Form.Label>
  //             <Form.Control onChange={handleNameChange} value={name} />
  //           </Form.Group>
  //           <div className="mt-3 text-center">
  //             <Button onClick={handleSaveName}>Proceed</Button>
  //           </div>
  //         </Modal.Body>
  //       </Modal>
  //     </div>
  //   );
  if (!lesson) return null;
  if (isPortrait)
    return (
      <>
      <div style={{ padding: "8px 16px", borderBottom: "1px solid #dee2e6", backgroundColor: "#fff" }}>
        <Link to="/student" style={{ color: "#6c757d", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: "0.88rem" }}>
          <FaArrowLeft size={12} /> My Courses
        </Link>
      </div>
      <div className="row">
        <div className="col-md-6 col-lg-8 feedback-player mobile">
          <Modal show={otherFeedbackModal} onHide={handleOtherFeedbackCancel}>
            <Modal.Header closeButton closeLabel="Provide addtional feedback" />
            <Modal.Body>
              <div className="container-fluid">
                <div className="row">
                  <div className="col-lg-12">
                    <Form.Group controlId="lesson-name">
                      <Form.Label>Message</Form.Label>
                      <Form.Control as="textarea" min="3" max={5} onChange={handleOtherFeedbackChange} value={otherFeedback} />
                    </Form.Group>
                  </div>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outlined-danger" onClick={handleOtherFeedbackCancel}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleOtherFeedbackSend}>
                Submit
              </Button>
            </Modal.Footer>
          </Modal>
          {overlay && !playing && (
            <div className="overlay-play" onClick={handleOverlayClick}>
              <div className="close-icon" onClick={handleOverlayClick}>
                <i className="fas fa-times" />
              </div>
            </div>
          )}
          <ReactPlayer
            ref={playerRef}
            onBufferEnd={videoOnBufferEnd}
            onBuffer={videoOnBuffer}
            onPause={videoOnPause}
            onReady={videoOnReady}
            onPlay={videoOnPlay}
            onProgress={videoOnProgress}
            playing={playing}
            height="100%"
            width="100%"
            style={playerStyles}
            controls
            config={playerOptions}
            url={lessonVideoUrl(lesson)}
          />
        </div>
        <div className="col-md-6 col-lg-4 card feedback-recorder mobile">
          {!data ? (
            <div className="card-body feedback-card-container">
              <div className="feedback-text text-center ">I find the lecture</div>
              <div className="feedback-system container-fluid">
                <div className="redline" />
                <div className="row justify-content-center feedback-top">
                  <div className="btn btn-danger btn-lg btn-feedback btn-difficult" onClick={handleFeedback("difficult")}>
                    Difficult
                  </div>
                </div>
                <div className="row justify-content-between feedback-middle">
                  <div className="blueline" />
                  <div className="btn btn-primary btn-lg btn-feedback btn-boring" onClick={handleFeedback("boring")}>
                    Boring
                  </div>
                  <div className="btn btn-primary btn-lg btn-feedback btn-engaging" onClick={handleFeedback("engaging")}>
                    Engaging
                  </div>
                </div>
                <div className="row justify-content-center feedback-bottom">
                  <div className="btn btn-danger btn-lg btn-feedback btn-easy" onClick={handleFeedback("easy")}>
                    Easy
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-body feedback-options">
              <div className="d-flex justify-content-between align-items-center px-2 mb-2 w-100">
                {/* <div className="btn btn-danger btn-lg btn-feedback btn-difficult">Difficult</div> */}
                <div className={`btn btn-danger btn-lg btn-feedback text-capitalize btn-${data.feedback}`}>{data.feedback}</div>
                <CgClose size="28" onClick={handleCaputureFeedback()} />
              </div>
              {data.feedback && (
                <div className="feedback-options-container container-fluid">
                  <div className="row">
                    {options[data.feedback].map((o, k) => (
                      <div className="feedback-card my-2 col-4 col-md-6 col-lg-4" style={{ cursor: "pointer" }} onClick={handleCaputureFeedback(o.id)} key={k}>
                        <div className="card-body text-center">{o.name}</div>
                      </div>
                    ))}
                    <div className="feedback-card my-2 col-4 col-md-6 col-lg-4" style={{ cursor: "pointer" }} onClick={handleOtherFeedbackShow} key="other">
                      <div className="card-body text-center">Other</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </>
    );
  if (isLandscape) {
    return (
      <>
        <div className={"debe-video-landscape" + (beenPlayed && !playing ? " feedback-visible" : "")} ref={scrollToTop}>
          {beenPlayed && playing && (
            <div className="feedback-btn" onClick={() => setPlaying(false)}>
              <div className="inner">Feedback</div>
            </div>
          )}
          <Modal show={otherFeedbackModal} onHide={handleOtherFeedbackCancel}>
            <Modal.Header closeButton closeLabel="Provide addtional feedback" />
            <Modal.Body>
              <div className="container-fluid">
                <div className="row">
                  <div className="col-lg-12">
                    <Form.Group controlId="lesson-name">
                      <Form.Label>Message</Form.Label>
                      <Form.Control as="textarea" min="3" max={5} onChange={handleOtherFeedbackChange} value={otherFeedback} />
                    </Form.Group>
                  </div>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outlined-danger" onClick={handleOtherFeedbackCancel}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleOtherFeedbackSend}>
                Submit
              </Button>
            </Modal.Footer>
          </Modal>
          <ReactPlayer
            className="video-player"
            ref={playerRef}
            onStart={videoOnStart}
            onBufferEnd={videoOnBufferEnd}
            onBuffer={videoOnBuffer}
            onPause={videoOnPause}
            onReady={videoOnReady}
            onPlay={videoOnPlay}
            playing={playing}
            height="100%"
            width="100%"
            onProgress={({ playedSeconds }) => {
              setTimestamp(Math.floor(playedSeconds));
            }}
            style={playerStyles}
            controls
            config={playerOptions}
            url={lessonVideoUrl(lesson)}
          />
          {beenPlayed && !playing && (
            <div className="feedback-menu feedback-recorder">
              {!data ? (
                <div className="card-body feedback-card-container">
                  <div className="d-flex justify-content-end mb-2 w-100">
                    <CgClose size="28" onClick={() => setPlaying(true)} />
                  </div>
                  <div className="feedback-text text-center ">I find the lecture</div>
                  <div className="feedback-system container-fluid">
                    <div className="redline" />
                    <div className="row justify-content-center feedback-top">
                      <div className="btn btn-danger btn-lg btn-feedback btn-difficult" onClick={handleFeedback("difficult")}>
                        Difficult
                      </div>
                    </div>
                    <div className="row justify-content-between feedback-middle">
                      <div className="blueline" />
                      <div className="btn btn-primary btn-lg btn-feedback btn-boring" onClick={handleFeedback("boring")}>
                        Boring
                      </div>
                      <div className="btn btn-primary btn-lg btn-feedback btn-engaging" onClick={handleFeedback("engaging")}>
                        Engaging
                      </div>
                    </div>
                    <div className="row justify-content-center feedback-bottom">
                      <div className="btn btn-danger btn-lg btn-feedback btn-easy" onClick={handleFeedback("easy")}>
                        Easy
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card-body feedback-options">
                  <div className="d-flex justify-content-between align-items-center px-2 mb-2 w-100">
                    <div className={`btn btn-danger btn-lg btn-feedback text-capitalize btn-${data.feedback}`}>{data.feedback}</div>
                    {/* <div className="btn btn-danger btn-lg btn-feedback btn-difficult">Difficult</div> */}
                    <CgClose size="28" onClick={handleCaputureFeedback()} />
                  </div>
                  {data.feedback && (
                    <div className="feedback-options-container container-fluid">
                      <div className="row">
                        {options[data.feedback].map((o, k) => (
                          <div className="feedback-card my-2 col-4 col-md-6 col-lg-4" style={{ cursor: "pointer" }} onClick={handleCaputureFeedback(o.id)} key={k}>
                            <div className="card-body text-center">{o.name}</div>
                          </div>
                        ))}
                        <div className="feedback-card my-2 col-4 col-md-6 col-lg-4" style={{ cursor: "pointer" }} onClick={handleOtherFeedbackShow} key="other">
                          <div className="card-body text-center">Other</div>
                        </div>
                        <div className="feedback-card my-2 col" style={{ cursor: "pointer" }} onClick={handleCaputureFeedback()} key="nofurther">
                          <div style={{ backgroundColor: "#ff000077" }} className="card-body text-center text-white">
                            No further feedback
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </>
    );
  }
  return null;
}

var MobilePlayerWOC = withOrientationChange(MobilePlayer);

// function MobilePlayer({ lesson, isPortrait, isLandscape, videoOnBuffer, videoOnBufferEnd, videoOnPause, videoOnPlay, videoOnReady, playing }) {
//   const mobilePlayerRef = useRef();
//   const [overlay, setOverlay] = useState(false);

//   const handleOverlayClick = e => {
//     e.preventDefault();
//     setOverlay(false);
//   };

//   useEffect(() => {
//     if (isLandscape && mobilePlayerRef && mobilePlayerRef.current) {
//       // alert(JSON.stringify(Object.keys(mobilePlayerRef.current.player)));
//       if (mobilePlayerRef.current.getInternalPlayer()) {
//         const node = mobilePlayerRef.current.getInternalPlayer().f;
//         if (playing) {
//           // screenfull.request(node);
//         } else {
//           if (screenfull.isEnabled) {
//             screenfull.exit();
//           }
//         }
//       }
//     }
//   }, [mobilePlayerRef, isLandscape, playing]);
//   if (!lesson) return null;
//   if (isPortrait)
//     return (
//       <div className="feedback-mobile portrait">
//         <div className="feedback-mobile-player">
//           <ReactPlayer
//             muted
//             onBufferEnd={videoOnBufferEnd}
//             onBuffer={videoOnBuffer}
//             onPause={videoOnPause}
//             onReady={videoOnReady}
//             onPlay={videoOnPlay}
//             playing={playing}
//             height="100%"
//             width="100%"
//             style={playerStyles}
//             controls
//             config={playerOptions}
//             url={"https://www.youtube.com/watch?v=7PXyg2r-k2c"}
//           />
//         </div>
//         <div className="lesson-details">
//           <div className="lesson-name">{lesson.name}</div>
//         </div>
//         <div className="feedback-system">
//           <div className="redline" />
//           <div className="row justify-content-center feedback-top">
//             <div className="btn btn-danger btn-lg btn-feedback">Difficult</div>
//           </div>
//           <div className="row justify-content-between feedback-middle">
//             <div className="blueline" />
//             <div className="btn btn-primary btn-lg btn-feedback">Boring</div>
//             <div className="btn btn-primary btn-lg btn-feedback">Engaging</div>
//           </div>
//           <div className="row justify-content-center feedback-bottom">
//             <div className="btn btn-danger btn-lg btn-feedback">Easy</div>
//           </div>
//         </div>
//       </div>
//     );
//   return (
//     <div className="feedback-mobile landscape">
//       <div className="feedback-mobile-player">
//         <ReactPlayer
//           ref={mobilePlayerRef}
//           muted
//           onBufferEnd={videoOnBufferEnd}
//           onBuffer={videoOnBuffer}
//           onPause={videoOnPause}
//           onReady={videoOnReady}
//           onPlay={videoOnPlay}
//           onProgress={({ playedSeconds }) => {
//             settimestamp(Math.round(playedSeconds));
//           }}
//           onDuration={duration => {
//           }}
//           playing={playing}
//           height="100%"
//           width="100%"
//           style={playerStyles}
//           controls
//           config={mobilePlayerOptions}
//           url={"https://youtu.be/7PXyg2r-k2c"}
//         />
//       </div>
//     </div>
//   );
// }

function Player({ lesson }) {
  const playerRef = useRef();
  const [playing, setPlaying] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [data, setData] = useState(null);
  const [timestamp, setTimestamp] = useState(null);
  const { options } = useOptions();

  const [otherFeedbackModal, setOtherFeedbackModal] = useState(false);
  const [otherFeedback, setOtherFeedback] = useState("");

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [activeQuiz, setActiveQuiz] = useState(null); // { question }
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState(null); // true | false
  const shownQuizIds = useRef(new Set());

  const { isLoggedIn, data: studentData, refresh, request } = useStudentAuth();

  const videoOnPlay = () => {
    setPlaying(true);
    request("POST", `/lessons/${lesson.id}/watched`, {}, { withCredentials: true }).catch(ignoreError);

    let duration = 0;

    if (playerRef.current) {
      const _duration = playerRef.current.getCurrentTime();

      if (_duration) {
        duration = _duration;
      }
    }

    request("POST", `/lessons/${lesson.id}/log`, { action: "play", duration: duration, date_client: Date.now() }, { withCredentials: true }).catch(ignoreError);
  };
  const videoOnReady = () => {
    request("POST", `/lessons/${lesson.id}/log`, { action: "lesson_joined", date_client: Date.now() }, { withCredentials: true }).catch(ignoreError);
  };

  const videoOnPause = () => {
    setPlaying(false);
    let duration = 0;

    if (playerRef.current) {
      const _duration = playerRef.current.getCurrentTime();

      if (_duration) {
        duration = _duration;
      }
    }

    request("POST", `/lessons/${lesson.id}/log`, { action: "pause", duration: duration, date_client: Date.now() }, { withCredentials: true }).catch(ignoreError);
  };

  /** @type { (seconds: number) => void } */
  const videoOnSeek = (seconds) => {};

  const videoOnProgress = ({ playedSeconds }) => {
    const currentTimestamp = Math.floor(playedSeconds);

    const difference = currentTimestamp - timestamp;

    if (difference >= 5) {
      request("POST", `/lessons/${lesson.id}/log`, { action: "forward_seek", duration: playedSeconds, date_client: Date.now() }, { withCredentials: true }).catch(ignoreError);
    }

    if (difference <= -5) {
      request("POST", `/lessons/${lesson.id}/log`, { action: "backward_seek", duration: playedSeconds, date_client: Date.now() }, { withCredentials: true }).catch(ignoreError);
    }

    setTimestamp(currentTimestamp);

    // Trigger quiz question at its timestamp (within a 2-second window)
    const due = quizQuestions.find(
      (q) => !shownQuizIds.current.has(String(q._id)) && Math.abs(currentTimestamp - q.timestamp) <= 2
    );
    if (due) {
      shownQuizIds.current.add(String(due._id));
      setPlaying(false);
      setActiveQuiz({ question: due });
      setQuizResult(null);
    }
  };

  const videoOnBuffer = () => {
    setOverlay(false);
  };

  const videoOnBufferEnd = () => {
    setPlaying(true);
    // setOverlay(true);
  };

  const handleFeedback = (key) => (e) => {
    setData({
      feedback: key,
      timestamp,
    });
  };

  const handleOtherFeedbackChange = (e) => {
    const val = e.target.value;
    setOtherFeedback(val);
  };

  const handleOtherFeedbackShow = (e) => {
    setOtherFeedbackModal(true);
  };

  const handleOtherFeedbackCancel = (e) => {
    setOtherFeedback("");
    setOtherFeedbackModal(false);
  };

  const handleOtherFeedbackSend = (e) => {
    if (studentData)
      request("POST", "/lessons/" + lesson.id, { ...data, feedback_type: "other", other_message: otherFeedback, student_id: studentData._id }, { withCredentials: true })
        .then(({ data }) => {})
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {
          setData(null);
          setOtherFeedback("");
          setOtherFeedbackModal(false);
        });
  };

  const handleCaputureFeedback = (key) => (e) => {
    if (studentData)
      request("POST", "/lessons/" + lesson.id, { ...data, feedback_type: key, student_id: studentData._id }, { withCredentials: true })
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {
          setData(null);
        });
  };
  const handleOverlayClick = (e) => {
    e.preventDefault();
    setOverlay(false);
  };

  const subscribed = useRef(false);

  useEffect(() => {
    // const studentName = localStorage.getItem("debe-studentname");

    // if (!studentName) {
    // }

    subscribed.current = true;

    return () => {
      subscribed.current = false;
    };
  }, []);

  useEffect(() => {
    refresh().catch(ignoreError);
  }, [refresh]);

  // Fetch quiz questions once student is logged in
  useEffect(() => {
    if (!isLoggedIn || !lesson) return;
    request("GET", `/student/quiz/${lesson.id}`, {}, { withCredentials: true })
      .then(({ data }) => { if (data && data.success) setQuizQuestions(data.questions || []); })
      .catch(ignoreError);
  }, [isLoggedIn, lesson, request]);

  const handleQuizSubmit = async (answer) => {
    if (!activeQuiz) return;
    setQuizSubmitting(true);
    try {
      const { data } = await request("POST", `/student/quiz/${activeQuiz.question._id}/answer`, { answer }, { withCredentials: true });
      setQuizResult(!!(data && data.correct));
    } catch { setQuizResult(false); }
    finally { setQuizSubmitting(false); }
  };

  const handleQuizContinue = () => {
    setActiveQuiz(null);
    setQuizResult(null);
    setPlaying(true);
  };

  if (!isLoggedIn)
    return (
      <>
        <StudentAuth />
      </>
    );

  // if (showNameModal)
  //   return (
  //     <div style={{ height: "100%", width: "100%", backgroundColor: "#c8c8c8" }}>
  //       <Modal centered size="sm" show={showNameModal} onHide={() => {}}>
  //         <Modal.Body>
  //           <Form.Group controlId="studentname">
  //             <Form.Label>Please enter your name</Form.Label>
  //             <Form.Control onChange={handleNameChange} value={name} />
  //           </Form.Group>
  //           <div className="mt-3 text-center">
  //             <Button onClick={handleSaveName}>Proceed</Button>
  //           </div>
  //         </Modal.Body>
  //       </Modal>
  //     </div>
  //   );
  if (!lesson) return null;
  return (
    <>
      {isLoggedIn && (
        <div style={{ padding: "8px 20px", borderBottom: "1px solid #dee2e6", backgroundColor: "#fff" }}>
          <Link to="/student" style={{ color: "#6c757d", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: "0.88rem" }}>
            <FaArrowLeft size={12} /> My Courses
          </Link>
        </div>
      )}
    <div className="container-fluid">
      <div className="row">
        <div className="col-md-6 col-lg-9 feedback-player" style={{ position: "relative" }}>
          <Modal show={otherFeedbackModal} onHide={handleOtherFeedbackCancel}>
            <Modal.Header closeButton closeLabel="Provide addtional feedback" />
            <Modal.Body>
              <div className="container-fluid">
                <div className="row">
                  <div className="col-lg-12">
                    <Form.Group controlId="lesson-name">
                      <Form.Label>Message</Form.Label>
                      <Form.Control as="textarea" min="3" max={5} onChange={handleOtherFeedbackChange} value={otherFeedback} />
                    </Form.Group>
                  </div>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outlined-danger" onClick={handleOtherFeedbackCancel}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleOtherFeedbackSend}>
                Submit
              </Button>
            </Modal.Footer>
          </Modal>
          {overlay && !playing && (
            <div className="overlay-play" onClick={handleOverlayClick}>
              <div className="close-icon" onClick={handleOverlayClick}>
                <i className="fas fa-times" />
              </div>
            </div>
          )}
          {activeQuiz && (
            <QuizOverlay
              question={activeQuiz.question}
              onSubmit={handleQuizSubmit}
              submitting={quizSubmitting}
              result={quizResult}
              onContinue={handleQuizContinue}
            />
          )}
          <ReactPlayer
            ref={playerRef}
            onBufferEnd={videoOnBufferEnd}
            onBuffer={videoOnBuffer}
            onPause={videoOnPause}
            onReady={videoOnReady}
            onPlay={videoOnPlay}
            onSeek={videoOnSeek}
            playing={playing}
            height="100%"
            width="100%"
            onProgress={videoOnProgress}
            onDuration={(duration) => {
            }}
            style={playerStyles}
            controls
            config={playerOptions}
            url={lessonVideoUrl(lesson)}
          />
        </div>
        <div className="col card feedback-recorder">
          {!data ? (
            <div className="card-body feedback-card-container">
              <div className="feedback-text text-center ">I find the lecture</div>
              <div className="feedback-system container-fluid">
                <div className="feedback-system-inner">
                  <div className="redline" />
                  <div className="row justify-content-center feedback-top">
                    <div className="btn btn-danger btn-lg btn-feedback btn-difficult" onClick={handleFeedback("difficult")}>
                      Difficult
                    </div>
                  </div>
                  <div className="row justify-content-between feedback-middle">
                    <div className="blueline" />
                    <div className="btn btn-primary btn-lg btn-feedback btn-boring" onClick={handleFeedback("boring")}>
                      Boring
                    </div>
                    <div className="btn btn-primary btn-lg btn-feedback btn-engaging" onClick={handleFeedback("engaging")}>
                      Engaging
                    </div>
                  </div>
                  <div className="row justify-content-center feedback-bottom">
                    <div className="btn btn-danger btn-lg btn-feedback btn-easy" onClick={handleFeedback("easy")}>
                      Easy
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-body feedback-options">
              <div className="d-flex justify-content-between align-items-center px-2 mb-2 w-100">
                <div className={`btn btn-danger btn-lg btn-feedback text-capitalize btn-${data.feedback}`}>{data.feedback}</div>
                <CgClose size="28" onClick={handleCaputureFeedback()} />
              </div>
              {data.feedback && (
                <div className="feedback-options-container container-fluid">
                  <div className="row">
                    {options[data.feedback].map((o, k) => (
                      <div className="feedback-card my-2 col-md-6 col-lg-6" style={{ cursor: "pointer" }} onClick={handleCaputureFeedback(o.id)} key={k}>
                        <div className="card-body text-center">{o.name}</div>
                      </div>
                    ))}
                    {/* TODO: Change background for Other button to something easy */}
                    <div className="feedback-card my-2 col-md-6 col-lg-6" style={{ cursor: "pointer" }} onClick={handleOtherFeedbackShow} key="other">
                      <div className="card-body text-center">Other</div>
                    </div>
                    <div className="feedback-card my-2 col-md-6 col-lg-6" style={{ cursor: "pointer" }} onClick={handleCaputureFeedback()} key="nofurther">
                      <div style={{ backgroundColor: "#ff000077" }} className="card-body text-center text-white">
                        No further feedback
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

export default withOrientationChange(CourseIdLessonId);
