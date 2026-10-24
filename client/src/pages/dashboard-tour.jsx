import React, { useEffect, useRef } from "react";
import Layout from "components/Layout";
import useFeedback, { FeedbackProvider } from "provider/feedback";
import AdvancedDashboard from "components/Dashboard/Advanced";
import { useAuth } from "provider/auth";
import Tour from "components/Tour";

const dummyData = {
  venn: {
    easy: 24,
    boring: 32,
    difficult: 64,
    engaging: 48,
    difficult_easy: 10,
    difficult_boring: 21,
    difficult_engaging: 13,
    boring_easy: 7,
    boring_engaging: 14,
    engaging_easy: 10,
  },
  unique: {
    users: 80,
    easy: 24,
    boring: 32,
    difficult: 64,
    engaging: 48,
    difficult_easy: 1,
    difficult_boring: 6,
    difficult_engaging: 4,
    boring_easy: 5,
    boring_engaging: 5,
    engaging_easy: 4,
  },
  radial: {
    easy: 35,
    boring: 42,
    difficult: 65,
    engaging: 58,
    difficult_easy: 1,
    difficult_boring: 12,
    difficult_engaging: 7,
    boring_engaging: 14,
    boring_easy: 21,
    engaging_easy: 9,
  },
  detailed: {
    difficult: [
      { key: "ne-exp", percentage: 52 },
      { key: "ne-bg", percentage: 23 },
      { key: "co-difficult", percentage: 20 },
      {
        others: true,
        percentage: 5,
        values: [{ key: "unclear-pres", value: 2, percentage: 5 }],
      },
    ],
    easy: [
      { key: "good-exp", value: 7, percentage: 59 },
      { key: "teacher-easy", value: 6, percentage: 18 },
      { key: "ak-co", value: 4, percentage: 15 },
      {
        others: true,
        percentage: 8,
        values: [{ key: "easy-co", value: 3, percentage: 8 }],
      },
    ],
    boring: [
      { key: "too-difficult", value: 10, percentage: 51 },
      { key: "too-slow-repetitive", value: 7, percentage: 32 },
      { key: "too-easy", value: 7, percentage: 11 },
      {
        others: true,
        percentage: 6,
        values: [{ key: "co-not-meaningful", value: 1, percentage: 6 }],
      },
    ],
    engaging: [
      { key: "good-exp", value: 5, percentage: 43 },
      { key: "interesting-egs", value: 2, percentage: 39 },
      { key: "intellectually-chlg", value: 1, percentage: 10 },
      { others: true, percentage: 8, values: [{ key: "interesting-topic", value: 1, percentage: 8 }] },
    ],
    others: {
      difficult: ["Low resolution visuals", "English language"],
      easy: ["None"],
      boring: ["Language and pronunciation"],
      engaging: ["Story format of instruction"],
    },
  },
  percentage: [
    { minute: 1, difficult: 0, easy: 0, boring: 0, engaging: 0 },
    { minute: 2, difficult: 0, easy: 0, boring: 0, engaging: 0 },
    { minute: 3, difficult: 0, easy: 0, boring: 5, engaging: 0 },
    { minute: 4, difficult: 0, easy: 10, boring: 5, engaging: 0 },
    { minute: 5, difficult: 0, easy: 10, boring: 10, engaging: 0 },
    { minute: 6, difficult: 0, easy: 5, boring: 20, engaging: 10 },
    { minute: 7, difficult: 0, easy: 10, boring: 15, engaging: 10 },
    { minute: 8, difficult: 0, easy: 15, boring: 10, engaging: 0 },
    { minute: 9, difficult: 0, easy: 15, boring: 10, engaging: 0 },
    { minute: 10, difficult: 10, easy: 10, boring: 15, engaging: 0 },
    { minute: 11, difficult: 15, easy: 10, boring: 10, engaging: 0 },
    { minute: 12, difficult: 15, easy: 10, boring: 20, engaging: 0 },
    { minute: 13, difficult: 10, easy: 5, boring: 25, engaging: 0 },
    { minute: 14, difficult: 10, easy: 0, boring: 30, engaging: 0 },
    { minute: 15, difficult: 10, easy: 0, boring: 25, engaging: 10 },
    { minute: 16, difficult: 5, easy: 10, boring: 5, engaging: 15 },
    { minute: 17, difficult: 20, easy: 15, boring: 10, engaging: 15 },
    { minute: 18, difficult: 25, easy: 10, boring: 10, engaging: 10 },
    { minute: 19, difficult: 30, easy: 5, boring: 5, engaging: 0 },
    { minute: 20, difficult: 45, easy: 0, boring: 5, engaging: 5 },
    { minute: 21, difficult: 35, easy: 0, boring: 10, engaging: 10 },
    { minute: 22, difficult: 10, easy: 0, boring: 15, engaging: 20 },
    { minute: 23, difficult: 25, easy: 0, boring: 25, engaging: 15 },
    { minute: 24, difficult: 30, easy: 5, boring: 30, engaging: 15 },
    { minute: 25, difficult: 5, easy: 15, boring: 20, engaging: 30 },
    { minute: 26, difficult: 10, easy: 10, boring: 5, engaging: 20 },
    { minute: 27, difficult: 20, easy: 5, boring: 5, engaging: 10 },
    { minute: 28, difficult: 20, easy: 5, boring: 5, engaging: 10 },
    { minute: 29, difficult: 20, easy: 5, boring: 5, engaging: 20 },
    { minute: 30, difficult: 10, easy: 10, boring: 15, engaging: 15 },
    { minute: 31, difficult: 0, easy: 15, boring: 15, engaging: 0 },
    { minute: 32, difficult: 5, easy: 15, boring: 10, engaging: 20 },
    { minute: 33, difficult: 5, easy: 5, boring: 10, engaging: 20 },
    { minute: 34, difficult: 15, easy: 0, boring: 5, engaging: 0 },
    { minute: 35, difficult: 15, easy: 5, boring: 10, engaging: 0 },
    { minute: 36, difficult: 0, easy: 10, boring: 15, engaging: 10 },
    { minute: 37, difficult: 15, easy: 10, boring: 20, engaging: 25 },
    { minute: 38, difficult: 25, easy: 5, boring: 25, engaging: 20 },
    { minute: 39, difficult: 10, easy: 0, boring: 10, engaging: 10 },
    { minute: 40, difficult: 20, easy: 0, boring: 5, engaging: 25 },
    { minute: 41, difficult: 40, easy: 0, boring: 15, engaging: 25 },
    { minute: 42, difficult: 25, easy: 10, boring: 20, engaging: 5 },
    { minute: 43, difficult: 20, easy: 25, boring: 45, engaging: 20 },
    { minute: 44, difficult: 20, easy: 20, boring: 45, engaging: 20 },
    { minute: 45, difficult: 5, easy: 10, boring: 15, engaging: 0 },
    { minute: 46, difficult: 10, easy: 10, boring: 15, engaging: 10 },
    { minute: 47, difficult: 20, easy: 10, boring: 20, engaging: 20 },
  ],
  minute: [
    { minute: 1, difficult: 0, easy: 0, boring: 0, engaging: 0, net_difficult: 0, net_engagement: 0 },
    { minute: 2, difficult: 0, easy: 0, boring: 0, engaging: 0, net_difficult: 0, net_engagement: 0 },
    { minute: 3, difficult: 0, easy: 0, boring: 0, engaging: 4, net_difficult: 0, net_engagement: 4 },
    { minute: 4, difficult: 0, easy: 8, boring: 0, engaging: 4, net_difficult: -8, net_engagement: 4 },
    { minute: 5, difficult: 0, easy: 8, boring: 0, engaging: 8, net_difficult: -8, net_engagement: 8 },
    { minute: 6, difficult: 0, easy: 4, boring: 8, engaging: 16, net_difficult: -4, net_engagement: 8 },
    { minute: 7, difficult: 0, easy: 8, boring: 8, engaging: 12, net_difficult: -8, net_engagement: 4 },
    { minute: 8, difficult: 0, easy: 12, boring: 0, engaging: 8, net_difficult: -12, net_engagement: 8 },
    { minute: 9, difficult: 0, easy: 12, boring: 0, engaging: 8, net_difficult: -12, net_engagement: 8 },
    { minute: 10, difficult: 8, easy: 8, boring: 0, engaging: 12, net_difficult: 0, net_engagement: 12 },
    { minute: 11, difficult: 12, easy: 8, boring: 0, engaging: 8, net_difficult: 4, net_engagement: 8 },
    { minute: 12, difficult: 12, easy: 8, boring: 0, engaging: 16, net_difficult: 4, net_engagement: 16 },
    { minute: 13, difficult: 8, easy: 4, boring: 0, engaging: 20, net_difficult: 4, net_engagement: 32 },
    { minute: 14, difficult: 8, easy: 0, boring: 0, engaging: 24, net_difficult: 8, net_engagement: 40 },
    { minute: 15, difficult: 8, easy: 0, boring: 8, engaging: 20, net_difficult: 8, net_engagement: 12 },
    { minute: 16, difficult: 4, easy: 8, boring: 12, engaging: 4, net_difficult: -4, net_engagement: -8 },
    { minute: 17, difficult: 16, easy: 12, boring: 12, engaging: 8, net_difficult: 4, net_engagement: -4 },
    { minute: 18, difficult: 20, easy: 8, boring: 8, engaging: 8, net_difficult: 12, net_engagement: 0 },
    { minute: 19, difficult: 24, easy: 4, boring: 0, engaging: 4, net_difficult: 30, net_engagement: 4 },
    { minute: 20, difficult: 36, easy: 0, boring: 4, engaging: 4, net_difficult: 56, net_engagement: 0 },
    { minute: 21, difficult: 28, easy: 0, boring: 8, engaging: 8, net_difficult: 28, net_engagement: 0 },
    { minute: 22, difficult: 8, easy: 0, boring: 16, engaging: 12, net_difficult: 8, net_engagement: -4 },
    { minute: 23, difficult: 20, easy: 0, boring: 12, engaging: 20, net_difficult: 20, net_engagement: 8 },
    { minute: 24, difficult: 24, easy: 4, boring: 12, engaging: 24, net_difficult: 20, net_engagement: 12 },
    { minute: 25, difficult: 4, easy: 12, boring: 24, engaging: 16, net_difficult: -8, net_engagement: -8 },
    { minute: 26, difficult: 8, easy: 8, boring: 16, engaging: 4, net_difficult: 0, net_engagement: -12 },
    { minute: 27, difficult: 16, easy: 4, boring: 8, engaging: 4, net_difficult: 12, net_engagement: -4 },
    { minute: 28, difficult: 16, easy: 4, boring: 8, engaging: 4, net_difficult: 12, net_engagement: -4 },
    { minute: 29, difficult: 16, easy: 4, boring: 16, engaging: 4, net_difficult: 12, net_engagement: -12 },
    { minute: 30, difficult: 8, easy: 8, boring: 12, engaging: 12, net_difficult: 0, net_engagement: 0 },
    { minute: 31, difficult: 0, easy: 12, boring: 0, engaging: 12, net_difficult: -12, net_engagement: 12 },
    { minute: 32, difficult: 4, easy: 12, boring: 16, engaging: 8, net_difficult: -8, net_engagement: -8 },
    { minute: 33, difficult: 4, easy: 4, boring: 16, engaging: 8, net_difficult: 0, net_engagement: -8 },
    { minute: 34, difficult: 12, easy: 0, boring: 0, engaging: 4, net_difficult: 12, net_engagement: 4 },
    { minute: 35, difficult: 12, easy: 4, boring: 0, engaging: 8, net_difficult: 8, net_engagement: 8 },
    { minute: 36, difficult: 0, easy: 8, boring: 8, engaging: 12, net_difficult: -8, net_engagement: 4 },
    { minute: 37, difficult: 12, easy: 8, boring: 20, engaging: 16, net_difficult: 4, net_engagement: -4 },
    { minute: 38, difficult: 20, easy: 4, boring: 16, engaging: 20, net_difficult: 16, net_engagement: 4 },
    { minute: 39, difficult: 8, easy: 0, boring: 8, engaging: 8, net_difficult: 8, net_engagement: 0 },
    { minute: 40, difficult: 16, easy: 0, boring: 20, engaging: 4, net_difficult: 16, net_engagement: -16 },
    { minute: 41, difficult: 32, easy: 0, boring: 20, engaging: 12, net_difficult: 48, net_engagement: -8 },
    { minute: 42, difficult: 20, easy: 8, boring: 4, engaging: 16, net_difficult: 12, net_engagement: 12 },
    { minute: 43, difficult: 16, easy: 20, boring: 16, engaging: 36, net_difficult: -4, net_engagement: 20 },
    { minute: 44, difficult: 16, easy: 16, boring: 16, engaging: 36, net_difficult: 0, net_engagement: 20 },
    { minute: 45, difficult: 4, easy: 8, boring: 0, engaging: 12, net_difficult: -4, net_engagement: 12 },
    { minute: 46, difficult: 8, easy: 8, boring: 8, engaging: 12, net_difficult: 0, net_engagement: 4 },
    { minute: 47, difficult: 16, easy: 8, boring: 16, engaging: 16, net_difficult: 8, net_engagement: 0 },
  ],
  students_count: [...Array(80)].map((i) => Math.random().toString(36)),
};

const dummyLesson = {
  watched: Array(100),
  bookmarks: [
    {
      feedback_type: ["engaging"],
      linechart_feedback: ["engaging"],
      _id: "602b478a0cb83b0f10b1b21b",
      topic: "Bookmark 1",
      time_from: 12,
      time_to: 15,
      threshold: 45,
      questions: [],
      actions: [],
      __v: 1,
    },
    {
      feedback_type: ["difficult"],
      linechart_feedback: ["net_engaging", "net_difficult"],
      _id: "602fd91c249faa4b8cb39023",
      topic: "Bookmark 2",
      time_from: 18,
      time_to: 22,
      threshold: 70,
      questions: [],
      actions: [],
      __v: 1,
    },
    {
      feedback_type: ["difficult"],
      linechart_feedback: ["net_engaging", "net_difficult"],
      _id: "5f6caae02a52601e586aa6de",
      topic: "Bookmark 3",
      time_from: 39,
      time_to: 42,
      threshold: 70,
      questions: [],
      actions: [],
      __v: 1,
    },
  ],
  name: "Dummy lesson",
  youtube_link: "https://www.youtube.com/watch?v=LIqq7X87RAQ",
  desc: "Dummy lesson description",
  seconds: 2833,
  minutes: 47,
  course: "5f6caae02a52601e586aa6de",
  user: "5f4d0cd554d7d541bc13eea5",
  createdAt: "2020-11-19T10:05:35.395Z",
  updatedAt: "2021-02-19T15:30:47.626Z",
  __v: 43,
  current_bookmark: {
    feedback_type: ["difficult"],
    linechart_feedback: ["net_engaging", "net_difficult"],
    _id: "5f6caae02a52601e586aa6de",
    topic: "Bookmark 3",
    time_from: 39,
    time_to: 42,
    threshold: 70,
    questions: [
      {
        name: "The students found the issue with the slide design (Yeah! the slide has too much content on it – complicated graph and equations), Due to which they faced difficulty",
        action: "This part should be revisited in the next class with some additional and simple slides. Revise the design of the slide and content structure for next course.",
      },
    ],
    actions: [
      {
        action: "Discussed again in the next class with revised slides",
        future_action: "Look for simple figures/graph and revise the slide design",
      },
    ],
    __v: 1,
  },
  questions: [],
};

function DashboardTourInner() {
  const subscribed = useRef(true);

  const { user } = useAuth();
  const { lesson, setLesson, setData, setRange } = useFeedback();

  useEffect(() => {
    subscribed.current = true;

    const prepareDummyData = () => {
      setLesson(() => {
        setRange(() => {
          return [39, 42];
        });
        setData(() => {
          return dummyData;
        });
        return dummyLesson;
      });
    };

    prepareDummyData();

    return () => (subscribed.current = false);
  }, [setLesson, setData, setRange]);

  if (user && lesson) return <AdvancedDashboard dummyPlayer />;
  return null;
}

export default function DashboardTour() {
  return (
    <FeedbackProvider>
      <Layout
        headerProps={{ hasTour: true, lessonName: "Fluid Mechanics #10" }}
        minifiedNav
        pageName={
          <>
            <span>Teacher Dashboard </span>
          </>
        }
      >
        <Tour />
        <DashboardTourInner />
      </Layout>
    </FeedbackProvider>
  );
}
