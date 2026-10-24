import Layout from "components/Layout";
import React from "react";

function Intro() {
  return (
    <Layout pageName="Intro">
      <div className="container">
        <div className="row">
          <div className="col-12 py-4">
            <div className="card">
              <div className="card-body">
                <div id="aggregate">
                  <h4>
                    <a href="#aggregate">Aggregate lecture feedback</a>
                  </h4>
                  <ul>
                    <li>The line chart shows the variation of student feedback with respect to time and helps you identify areas of interest (e.g., the peak of difficulty or peak of engagement).</li>
                    <li>The interactive line chart allows you to select variable(s) of your choice to plot on the chart (e.g., Difficult vs. Easy, Difficult vs. Boring, etc.).</li>
                    <li>With the help of the sliders given above the line chart, a specific part of the lecture can be selected for detailed analysis of feedback (e.g., the part where the peak has appeared).</li>
                  </ul>
                </div>
                <div id="sync">
                  <h4>
                    <a href="#sync">Lecture video synced with the feedback.</a>
                  </h4>
                  <ul>
                    <li>The video will help you revisit specific part(s) of the lecture based on the feedback.</li>
                    <li>The video will play based on the slider positions (e.g., if slider positions are 3 and 5 min, then video between 2 and 5 min will play).</li>
                  </ul>
                </div>
                <div id="filter">
                  <h4>
                    <a href="#filter">Threshold</a>
                  </h4>
                  <p>Using this feature, a threshold (or cut-off value) can be set to separate the areas of interest in the line chart.</p>
                  <ul>
                    <li>Example: If the threshold is set to 50, then the horizontal line on the line chart will be at 50%, which will help locate the part(s) of the lecture where more than 50% of students have reported some particular feedback.</li>
                    <li>Using this, you can identify the peaks (sections of the lecture) for further analysis.</li>
                  </ul>
                </div>

                <div id="venn-diagram">
                  <h4>
                    <a href="#venn-diagram">Radial column chart</a>
                  </h4>
                  <p>This section gives the percentage distribution of the students as well as clicks for feedbacks.</p>
                  <ul>
                    <li>In the default setting, you will see the percentage distribution of students for the feedbacks.</li>
                    <li>Using the toggle option, you can switch to the click distribution</li>
                  </ul>
                  <h4>
                    <a href="#venn-diagram">Venn diagram</a>
                  </h4>
                  <p>This section gives details about the student feedback behavior.</p>
                  <ul>
                    <li>In the default setting, you will see Engaging-Difficult-Boring and Engaging-Easy-Boring Venn diagrams.</li>
                    <li>Using the toggle option, you can switch to the Difficult-Easy and Boring-Engaging Venn diagrams.</li>
                  </ul>
                  <ul>
                    <li>Example 1: Overlap in the Easy and Difficult circles (right-box) tells you how many students clicked Difficult as well as Easy for the selected part of the lecture or in the entire lecture.</li>
                    <li>Example 2: Overlap between Difficult and Boring circles (left-box) tells you how many students found the selected part of the lecture Difficult as well as Boring.</li>
                  </ul>
                </div>
                <div id="debe-reasons">
                  <h4>
                    <a href="#debe-reasons">DEBE Reasons</a>
                  </h4>
                  <ul>
                    <li>Example: The heat map of ‘Difficult’ shows the percentage distribution of students’ reasons for difficulty in the lecture or in the specific part of the lecture (if a specific part of the lecture is selected).</li>
                    <li>Along with the heat map of DEBE Reasons, there is a sub-section titled Other Reasons. These are the reasons provided by students apart from the options given on the feedback interface.</li>
                  </ul>
                </div>
                <div id="question-generator">
                  <h4>
                    <a href="#question-generator">Question Generator</a>
                  </h4>
                  <p>In this section, you can record the important questions or findings based on your analysis of feedback.</p>
                  <ul>
                    <li>You have to think about the following questions: What did not work in the lecture according to students, and what, according to me, should be done to address it?</li>
                    <li>
                      Example <em>Question generator</em>
                      <ul>
                        <li>
                          <em>Questions or findings based on analysis</em>: The design of the slide is problematic. The graph has too much content (plots and equations) on it.
                        </li>
                        <li>
                          <em>What can be done?</em>: Sequence the graph from simple to complex in steps and revisit this part in the next class. Revise the design of the slides for the next course.
                        </li>
                      </ul>
                    </li>
                    <li>
                      Example <em>Action tracker</em>
                      <ul>
                        <li>
                          <em>What action have I taken?</em>: Discussed this part again in the next class with revised slides.
                        </li>
                        <li>
                          <em>Any future action items?</em>: Look for alternative simple figures/graphs and revise the slide design further.
                        </li>
                      </ul>
                    </li>
                  </ul>
                  <p>You can click on the Add question button to add your questions or findings. You can edit or delete the questions or findings you have already added.</p>
                </div>
                <div id="action-tracker">
                  <h4>
                    <a href="#action-tracker">Action Tracker</a>
                  </h4>
                  <p>In this section, you can record the action(s) taken based on the questions or findings recorded in Question Generator or the feedback analysis.</p>
                  <ul>
                    <li>Example: The following action is recorded based on the finding that students found some topic(s) difficult due to lack of examples - "I gave more examples related to the topic in the next class."</li>
                    <li>The future action items based on the analysis can also be added in the Action Tracker for future reference - For example, "revising the slide design for next course offering."</li>
                  </ul>
                </div>
                <div id="save-bookmark">
                  <h4>
                    <a href="#save-bookmark">Save Bookmark</a>
                  </h4>
                  <ul>
                    <li>
                      Example: You have analyzed a Difficulty peak from x-y min, which appeared in a specific part of the lecture, and you want to save that analysis.
                      <ul>
                        <li>Select the difficult option, enter the name of the topic, and click on Bookmark. </li>
                      </ul>
                    </li>
                    <li>Note: You can select up to four feedback variables while bookmarking</li>
                  </ul>
                </div>
                <div id="bookmark-list">
                  <h4>
                    <a href="#bookmark-list">Bookmark List</a>
                  </h4>
                  <p>Using this, you can navigate to the different analyses you have done for the lecture.</p>
                  <ul>
                    <li>The bookmarks appear on the right side of the save your analysis section.</li>
                    <li>When clicked on a specific bookmark, you can revisit the analysis (DEBE Click Distribution, Heat map, The actions you have taken, etc.) of the part for which the bookmark is added.</li>
                  </ul>
                </div>
                <div style={{ height: "100vh" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Intro;
