import { useState, useEffect, useRef } from "react";
import api from "handler/api";

// const options = {
//   easy: [
//     { id: "good-exp", name: "Good explanation" },
//     { id: "enough-bg-concept", name: "Enough background to understand the topic / concept" },
//     { id: "easy-understand", name: "Easy to understand" },
//     { id: "well-prep-presentation", name: "Well-prepared presentation" },
//     { id: "good-presentation", name: "Good presentation style" }
//   ],
//   difficult: [
//     { id: "lack-explanation", name: "Lack of explanation" },
//     { id: "new-concept", name: "New concept for me" },
//     { id: "difficult-understand", name: "Too difficult to understand" },
//     { id: "issue-blackboard-writing", name: "Issue with slide / blackboard writing" },
//     { id: "no-reallife-example", name: "No exposure to real-life examples" },
//     { id: "too-fast", name: "Too fast" }
//   ],
//   boring: [
//     { id: "not-explained-properly", name: "Not explained properly" },
//     { id: "difficult-content", name: "Too challenging / difficult content" },
//     { id: "easy-content", name: "Too easy content" },
//     { id: "not-meaningful", name: "Content not meaningful for me" },
//     { id: "bored-in-general", name: "I am bored in general" },
//     { id: "presentation-style", name: "Presentation style of the teacher" },
//     { id: "too-much-repetition", name: "Too much repetition" },
//     { id: "too-slow", name: "Too slow" }
//   ],
//   engaging: [
//     { id: "good-exp", name: "Good explanation" },
//     { id: "practical-applications", name: "Practical applications are discussed" },
//     { id: "idea-about-content", name: "I have some idea about the topic / content" },
//     { id: "ci-examples", name: "Counter-intuitive examples / explanation" },
//     { id: "presentation-style", name: "Presentation style of the teacher" }
//   ]
// };
export function useOptions() {
  const subscribed = useRef(true);
  const [options, setOptions] = useState({ difficult: [], easy: [], boring: [], engaging: [] });

  useEffect(() => {
    subscribed.current = true;

    const getData = async () => {
      const { data } = await api.get("/misc/columns");

      if (data && data.success) {
        if (subscribed.current)
          setOptions(data.options);
      }
    };

    getData();

    return () => (subscribed.current = false);
  }, []);

  return { options };
}
