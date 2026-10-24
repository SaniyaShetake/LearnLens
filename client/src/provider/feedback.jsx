import React, { createContext, useContext, useEffect, useRef, useState } from "react";

export const FeedbackContext = createContext({
  data: [],
  setData: () => {},
  lesson: null,
  setLesson: () => {},
  range: null,
  setRange: () => {},
  refreshing: false,
  setRefreshing: () => {},
  threshold: 0,
  setThreshold: () => {},
  currentBookmark: null,
  setCurrentBookmark: () => {},
  bookmarks: [],
  setBookmarks: () => {},
  questions: [],
  setQuestions: () => {},
  actions: [],
  setActions: () => {},
  activated: [],
  setActivated: () => {},
  headerName: "",
  setHeaderName: () => {},
  hasChanges: false,
  setHasChanges: () => {},
  act: null,
  setAct: () => {}
});

function useFeedbackProvider(props) {
  const sub = useRef(true);
  const [lesson, setLesson] = useState(null);
  const [headerName, setHeaderName] = useState("");
  const [data, setData] = useState({});
  const [range, setRange] = useState([0, 0]);
  const [refreshing, setRefreshing] = useState(false);
  const [threshold, setThreshold] = useState(50);
  const [bookmarks, setBookmarks] = useState([]);
  const [currentBookmark, setCurrentBookmark] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [actions, setActions] = useState([]);
  const [activated, setActivated] = useState(["net_engaging", "net_difficult"]);
  const [hasChanges, setHasChanges] = useState(false);
  const [act, setAct] = useState(null);

  useEffect(() => {
    if (lesson) {
      setCurrentBookmark(lesson.current_bookmark);
      setBookmarks(lesson.bookmarks || []);
    }
  }, [lesson]);

  useEffect(() => {
    if (currentBookmark) {
      setThreshold(t => {
        return currentBookmark.threshold || t;
      });

      setActivated(ac => {
        return currentBookmark.linechart_feedback || ac;
      });
    }
  }, [currentBookmark]);

  useEffect(() => {
    return () => (sub.current = false);
  }, []);

  return {
    lesson,
    setLesson,
    data,
    setData,
    range,
    setRange,
    refreshing,
    setRefreshing,
    threshold,
    setThreshold,
    bookmarks,
    setBookmarks,
    currentBookmark,
    setCurrentBookmark,
    questions,
    setQuestions,
    actions,
    setActions,
    activated,
    setActivated,
    headerName,
    setHeaderName,
    hasChanges,
    setHasChanges,
    act,
    setAct
  };
}

export function FeedbackProvider({ children }) {
  const feedback = useFeedbackProvider();
  return <FeedbackContext.Provider value={{ ...feedback }}>{children}</FeedbackContext.Provider>;
}

export default function useFeedback() {
  return useContext(FeedbackContext);
}
