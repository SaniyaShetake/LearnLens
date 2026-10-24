import React from "react";
import QuizAnalysisPanel from "components/Analysis/QuizAnalysisPanel";
import useFeedback from "provider/feedback";
import "../../assets/styles/quiz-first-dashboard.scss";

/** Focused LearnLens teacher dashboard: prioritize evidence from check-in quizzes. */
function AdvancedDashboard() {
  const { lesson } = useFeedback();
  return (
    <main className="ll-quiz-dashboard">
      <section className="ll-dashboard-intro">
        <div className="ll-intro-copy">
          <span className="ll-eyebrow"><span className="ll-live-dot" /> LEARNLENS · LEARNING ANALYTICS</span>
          <h1>Learning outcomes</h1>
          <p>See who attempted each check-in question, how many answered correctly, and which concepts may need another explanation.</p>
          {lesson?.name && <div className="ll-lesson-chip"><i className="fas fa-play-circle" /> {lesson.name}</div>}
        </div>
        <div className="ll-intro-art" aria-hidden="true">
          <div className="ll-art-orbit ll-orbit-one" />
          <div className="ll-art-orbit ll-orbit-two" />
          <div className="ll-art-center"><i className="fas fa-chart-column" /></div>
          <span className="ll-art-dot ll-dot-a" /><span className="ll-art-dot ll-dot-b" /><span className="ll-art-dot ll-dot-c" />
        </div>
      </section>
      <section className="ll-analysis-heading">
        <div>
          <span className="ll-section-kicker">ASSESSMENT INSIGHTS</span>
          <h2>Quiz performance</h2>
          <p>Question-level results are calculated from student submissions. Use the time links to revisit the relevant lesson moment.</p>
        </div>
        <div className="ll-heading-note"><i className="fas fa-lightbulb" /><span>Use low-scoring questions to decide what to review next.</span></div>
      </section>
      <div className="ll-quiz-panel-wrap"><QuizAnalysisPanel /></div>
      <section className="ll-next-steps">
        <div className="ll-next-icon"><i className="fas fa-compass" /></div>
        <div><h3>Turn results into action</h3><p>Questions marked <strong>Reteach</strong> may need a fresh explanation. <strong>Discuss</strong> questions are good candidates for a worked example or a class conversation.</p></div>
      </section>
    </main>
  );
}

export default AdvancedDashboard;
