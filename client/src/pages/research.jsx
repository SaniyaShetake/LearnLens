import React from "react";
import DEBEModelImg from "assets/images/debe-model.png";
import Footer from "components/Footer";
import Header from "components/Header";

import "assets/styles/research.scss";

const Anchor = ({ href = "#", children, ...props }) => {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
};

function ResearchPage() {
  return (
    <>
      <Header pageName="" />
      <section className="research">
        <div className="container mt-5">
          <div className="row justify-content-center">
            <div className="col-lg-9 col-xl-8">
              <h4 className="font-weight-bold mb-4 text-justify" style={{ textAlignLast: "left" }}>
                Developing a model to support evidence-based teaching practice through high-resolution student feedback
              </h4>
            </div>
          </div>

          <div className="row justify-content-center introduction">
            <div className="col-lg-9 col-xl-8">
              <div className="card mb-1 mb-lg-2">
                <div className="card-body">
                  <a href="#context" className="research-title pl-3 pr-2" id="context">
                    The Context
                  </a>
                  <p className="mt-2 pl-3 pr-2">
                    Use of lectures is prevalent in face-to-face and online learning. Despite introducing active learning techniques and pedagogical strategies such as inquiry and project-based learning, the undergraduate STEM classrooms are still largely
                    lecture-dependent. Moreover, the use of online video lectures (which imitates the long-standing tradition of lecturing) has become a core component of blended approaches, such as flipped classrooms, for content delivery and learning,
                    especially in the post-pandemic world.
                  </p>
                  <p className="mt-2 pl-3 pr-2">
                    The ability of instructors to recognize and understand students' learning experiences with lectures, meaningful events in the lecture (e.g., challenging or engaging concepts/segments), and efficacy of lecture materials design can inform
                    the design of lectures (both face-to-face and online video lectures) and instructors' actions and decisions to improve instructional practice.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-lg-9 col-xl-8">
              <div className="card mb-1 mb-lg-2">
                <div className="card-body">
                  <a href="#problem" className="research-title pl-3 pr-2" id="problem">
                    The Problem
                  </a>
                  <p className="mt-2 pl-3 pr-2">
                    End-of-semester course feedback, the most commonly used mechanism to document the students’ experiences of the course, collects student feedback with the objective of improving the quality of teaching. However, the central issue related
                    to this mechanism is its summative nature, which lacks the granularity in the evidence to inform improvement in instruction at the lecture level. The other data, such as test and mid-term exam scores, also do not provide appropriate
                    granularity to improve lectures. Hence, the instructors lack the mechanism to enhance their lectures in a formative manner.
                  </p>
                  <p className="mt-2 pl-3 pr-2">
                    In online video lectures, the typical approaches to investigate student experiences with video lectures use post-hoc questionnaires to collect students' subjective responses on their video preferences, affect, mental effort, and
                    perceived learning. It effectively captures overall feelings and feedback; however, they do not provide detailed insights into the lectures’ specific parts and their effect on students' learning experiences.
                  </p>
                  <p className="mt-2 pl-3 pr-2">
                    Video learning analytics use clickstreams such as pause, play, and seek, to identify specific parts students watch, skip, re-watch or skim. However, such approaches face the important limitation of not being able to capture the real
                    intent of students. For example, a) whether pausing and replaying the video many times is due to the content difficulty, b) whether seek-backward action while watching a video lecture is due to the insufficient explanation offered, etc.
                  </p>
                </div>
              </div>

              <div className="card mb-1 mb-lg-2">
                <div className="card-body">
                  <a href="#solution" className="research-title pl-3 pr-2" id="solution">
                    Our Solution
                  </a>
                  <p className="mt-2 pl-3 pr-2">
                    We conceptualized a model known as DEBE Feedback (DEBE is an acronym for Difficult, Easy, Boring, and Engaging) (Figure A) that captures real-time, continuous, and anonymous student self-reports of their cognitive-affective states in a
                    face-to-face classroom lecture or when students watch an online video lecture. When aggregated for the entire class, such data will shed light on any issue with the content, quality, and delivery of the content. This data is made
                    available to instructors through a teacher-facing dashboard.
                  </p>
                  <p className="mt-2 pl-3 pr-2">
                    The teacher dashboard assists the teacher in analyzing student feedback to adapt the instruction based on the feedback, take immediate action (e.g., in the next class), redesign instructional materials in the video, or make changes in
                    the future course offerings.
                  </p>
                  <p className="mt-2 pl-3 pr-2">Our solution is currently geared to online video lectures but would apply equally well to face-to-face classrooms with minor modifications.</p>
                  <figure id="feedback-model" className="mt-4">
                    <img src={DEBEModelImg} alt="debe-model" className="figure-img img-fluid px-4" />
                    <figcaption className="figure-caption   text-center">Figure A. DEBE Feedback Model</figcaption>
                  </figure>
                </div>
              </div>
            </div>
          </div>

          <div className="row justify-content-center">
            <div className="col-lg-9 col-xl-8 publications" id="research-publications">
              <div className="card">
                <div className="card-body">
                  <div className="mb-3">
                    <a href="#research-publications" className="title">
                      <strong>Research publications</strong>
                    </a>
                  </div>

                  <p className="pl-3 pr-2">
                    <code>[7]</code> Chavan, P., & Mitra, R. Tcherly: A Teacher-facing Dashboard for Online Video Lectures. The Journal of Learning Analytics (in press).
                  </p>

                  <p className="pl-3 pr-2">
                    <code>[6]</code> Chavan, P., Mitra, R., & Murallidharan, J. S. (2022, March). Multiscale nature of student and teacher perceptions of a mechanical engineering lecture. European Journal of Engineering Education,{" "}
                    <u>
                      <em>DOI: 10.1080/03043797.2022.2047159</em>
                    </u>{" "}
                    (<Anchor href="https://www.tandfonline.com/doi/abs/10.1080/03043797.2022.2047159?journalCode=ceee20">link</Anchor>).
                  </p>

                  <p className="pl-3 pr-2">
                    <code>[5]</code> Chavan, P. (2020, March). A novel feedback system for refinement and improvement of lecture-based pedagogy. In Companion Proceedings of the 10th International Conference on Learning Analytics & Knowledge. (pp. 194-200).{" "}
                    <u>
                      <em>Doctoral Consortium</em>
                    </u>{" "}
                    (<Anchor href="https://www.solaresearch.org/wp-content/uploads/2020/06/LAK20_Companion_Proceedings.pdf">link</Anchor>)
                  </p>
                  <p className="pl-3 pr-2">
                    <code>[4]</code> Chavan, P., & Mitra, R. (2019, December). Developing a student feedback system using a design-based research approach. In <em>Proceedings of the 10th International Conference on Technology for Education</em>. (
                    <Anchor href="https://ieeexplore.ieee.org/abstract/document/8983714">link</Anchor>)
                  </p>
                  <p className="pl-3 pr-2">
                    <code>[3]</code> Kumar, A., Chavan, P., & Mitra, R. (2019, December). Can EEG signal predict learners’ perceived difficulty? In <em>Proceedings of the 27th International Conference on Computers in Education</em> (pp. 63-68). (
                    <Anchor href="https://www.researchgate.net/publication/344068873_Can_EEG_signal_predict_learners%27_perceived_difficulty">link</Anchor>)
                  </p>
                  <p className="pl-3 pr-2">
                    <code>[2] </code>Mitra, R., & Chavan, P. (2019, March). DEBE feedback for large lecture classroom analytics. In <em>Proceedings of the 9th International Conference on Learning Analytics & Knowledge</em> (pp. 426-430). ACM. (
                    <Anchor href="https://dl.acm.org/doi/10.1145/3303772.3303821">link</Anchor>)
                  </p>
                  <p className="pl-3 pr-2">
                    <code>[1]</code> Chavan, P., Gupta, S., & Mitra, R. (2018, November). A Novel Feedback System for Pedagogy Refinement in Large Lecture Classroom. In <em>Proceedings of the 26th International Conference on Computers in Education</em>. (
                    <Anchor href="http://icce2018.ateneo.edu/wp-content/uploads/2018/12/C4-14.pdf">link</Anchor>)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}

export default ResearchPage;
