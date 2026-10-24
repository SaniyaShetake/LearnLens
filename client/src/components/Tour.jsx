import React, { useState } from "react";
import ReacTour from "reactour";
import { useAuth } from "provider/auth";
import { useQuery } from "utils/query";
import { useHistory } from "react-router-dom";

const DashboardTourSteps = [
  {
    selector: ".td-overview",
    content: (
      <>
        <div>
          <strong>See the aggregate lecture feedback and the lecture video</strong>
          <ul>
            <li className="mt-2">Use the interactive line chart to analyze the student feedback with respect to time and plot variables of your choice for specific feedback analysis</li>
            <li className="mt-2">Identify areas of interest in the lecture (e.g. peak of difficulty or peak of engagement)</li>
            <li className="mt-2">Use the sliders above line chart to select a particular part of the lecture for detailed analysis</li>
          </ul>
        </div>
      </>
    ),
    navDotAriaLabel: "See the aggregate lecture feedback and the lecture video"
  },
  {
    selector: ".td-clickdist-content",
    content: (
      <>
        <div>
          <strong>Get a detailed understanding of the nature of student feedback</strong>
        </div>
        <ul>
          <li className="mt-2">
            Radial column chart in <em>DEBE Distribution</em> section gives percentage distribution of the students and clicks data
          </li>
          <li className="mt-2">
            Venn diagram in the <em>DEBE Interactions</em> section shows the student feedback behavior (e.g., how many students clicked Difficult as well as Boring) in the entire lecture or the specific part of the lecture
          </li>
        </ul>
        <div className="text-right">
          <a href="/intro#venn-diagram" target="_blank" rel="noopener noreferrer">
            More info
          </a>
        </div>
      </>
    )
  },
  {
    selector: ".td-participation",
    content: (
      <>
        <div>
          <strong> Get a quick idea about the level of student participation in the feedback giving activity</strong>
        </div>

        <ul>
          <li className="mt-2">
            <em>Total responses</em> indicate the number of students who have provided feedback in the lecture out of the total number of students using the feedback system.
          </li>
          <li className="mt-2">
            <em>Responses between x - y min</em> indicate the number of students who have provided feedback in a specific part of the lecture (x - y min) out of the total number of students who have provided feedback in the entire lecture.
          </li>
        </ul>
      </>
    ),
    navDotAriaLabel: "Participation"
  },
  {
    selector: ".td-detailed-content",
    content: (
      <>
        <div>
          <strong>Go into the details of reasons for the particular feedback(s)</strong>
        </div>

        <div className="mt-3">
          This section gives the distribution of students' reasons for specific feedback for the entire or selected part of the lecture, along with other reasons reported by the students apart from the options given on the feedback interface.
        </div>
        <div className="mt-3 text-right">
          <a href="/intro#debe-reasons" target="_blank" rel="noopener noreferrer">
            More info
          </a>
        </div>
      </>
    ),
    navDotAriaLabel: "Detailed Feedback"
  },

  {
    selector: ".td-bottom",
    content: (
      <>
        <div>
          <strong>Log your questions or findings and the actions</strong>
        </div>
        <ul className="mt-3">
          <li>
            Using <em>Question Generator</em>, you can record the important questions based on your feedback analysis or annotate your findings.
          </li>
          <li>
            Using <em>Action Tracker</em>, you can record the actions taken by you or future actions based on the questions or findings recorded in <em>Question Generator</em>.
          </li>
        </ul>
        <div className="mt-3 text-right">
          <a href="/intro#question-generator" target="_blank" rel="noopener noreferrer">
            More info
          </a>
        </div>
      </>
    ),
    navDotAriaLabel: "Question Generator"
  },
  {
    selector: ".td-save-content",
    content: (
      <>
        <div>
          <strong>Save your analysis</strong>
        </div>
        <div>This section helps you to bookmark or record the specific analysis you have done and quickly revisit the analyzed feedback in the future.</div>
        <div className="mt-3 text-right">
          <a href="/intro#save-bookmark" target="_blank" rel="noopener referrer">
            More info
          </a>
        </div>
      </>
    ),
    navDotAriaLabel: "Save analysis"
  },
  {
    selector: ".nav-tour-btn",
    content: <strong>You're finished with the tour! You can restart the tour by clicking the "Take tour" button.</strong>,
    navDotAriaLabel: "Take tour again"
  }
];

function Tour(props) {
  const { isTourOpen, handleCloseTour } = useAuth();
  const [currentTourStep, setCurrentTourStep] = useState(0);

  const { backto } = useQuery();
  const history = useHistory();

  return (
    <>
      <ReacTour
        className="debe-helper"
        disableInteraction
        maskSpace={4}
        startAt={currentTourStep}
        getCurrentStep={currentStep => setCurrentTourStep(currentStep)}
        steps={DashboardTourSteps}
        isOpen={isTourOpen}
        onRequestClose={() => {
          setCurrentTourStep(0);
          handleCloseTour();
          if (backto) {
            history.replace("/l/" + backto + "/dashboard");
          }
        }}
      />
    </>
  );
}

export default Tour;
