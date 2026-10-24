import React, { useEffect, useRef, useState } from "react";
import { Badge, Button as BSButton, Form, Modal } from "react-bootstrap";
import Button from "components/Button";
import { useAuth } from "provider/auth";
import useFeedback from "provider/feedback";
import { Prompt } from "react-router-dom";

const feedbackTypes = [
  { key: "difficult", name: "Difficult" },
  { key: "easy", name: "Easy" },
  { key: "boring", name: "Boring" },
  { key: "engaging", name: "Engaging" },
];

function NewBookmarks() {
  const subscribed = useRef(true);
  const bookmarkRef = useRef(null);

  const { lesson, range, bookmarks, setBookmarks, setCurrentBookmark, currentBookmark, threshold, activated, hasChanges, setHasChanges, questions, actions, setRange } = useFeedback();
  const { request } = useAuth();

  const [topic, setTopic] = useState("");
  const [feedbackSelected, setFeedbackSelected] = useState([]);

  useEffect(() => {
    if (currentBookmark) {
      setTopic(currentBookmark.topic);
      setFeedbackSelected(currentBookmark.feedback_type);
    }
  }, [currentBookmark]);

  useEffect(() => {
    if (hasChanges === true) {
      window.onbeforeunload = () => true;
    } else {
      window.onbeforeunload = false;
    }
  });

  const handleChangeTopic = (e) => {
    const value = e.target.value;
    setTopic(value);
    setHasChanges(true);
  };

  const handleChangeFeedback = (key) => (e) => {
    e.preventDefault();

    setFeedbackSelected((a) => {
      const index = a.indexOf(key);

      if (index > -1) {
        const result = Array.from(a);
        result.splice(index, 1);

        return result;
      }

      // if (a.length < 2) {
      return [...a, key];
      // }

      // return [key];
    });
    setHasChanges(true);
  };

  const createNewBookmark = async () => {
    try {
      const body = {
        topic: topic,
        feedback_type: feedbackSelected,
        time_from: range[0],
        time_to: range[1],
        activated,
        threshold,
      };

      if (currentBookmark) {
        body.questions = questions;
        body.actions = actions;
      }

      const { data } = await request("PUT", `/lessons/${lesson._id}/bookmark/add`, body);

      if (data && data.success) {
        if (subscribed.current) {
          setBookmarks(data.bookmarks);
          setCurrentBookmark(data.current_bookmark);
          setHasChanges(false);
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const saveCurrentBookmark = async () => {
    try {
      const { data } = await request("PUT", `/lessons/bookmark/save/${currentBookmark._id}`, {
        topic,
        feedback_type: feedbackSelected,
        time_from: range[0],
        time_to: range[1],
        activated,
        threshold,
      });

      if (data && data.success) {
        setHasChanges(false);
        setBookmarks((bms) => {
          const result = Array.from(bms);

          const currentBmIndex = result.findIndex((b) => b._id === currentBookmark._id);

          if (currentBmIndex > -1) {
            result[currentBmIndex].topic = topic;
            result[currentBmIndex].feedback_type = feedbackSelected;
            result[currentBmIndex].time_from = range[0];
            result[currentBmIndex].time_to = range[1];
            result[currentBmIndex].activated = activated;
            result[currentBmIndex].threshold = threshold;
          }

          return result;
        });
      }

      // No need to refresh changes
    } catch (error) {
      console.log(error);
    }
  };

  const switchBookmark = async (id) => {
    try {
      await request("PUT", `/lessons/${lesson._id}/bookmark/switch`, {
        switch_to: id,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleCreateNew = (e) => {
    createNewBookmark();
  };

  const handleSaveCurrent = (e) => {
    saveCurrentBookmark();
  };

  const deleteBookmark = async (delete_id, next_id) => {
    try {
      await request("PUT", `/lessons/${lesson._id}/bookmark/delete`, {
        switch_to: next_id,
        delete: delete_id,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleSwitchBookmark = (key) => (e) => {
    const changeBookmark = bookmarks[key];
    if (changeBookmark) {
      setCurrentBookmark(changeBookmark);
      setRange([changeBookmark.time_from, changeBookmark.time_to]);
      switchBookmark(changeBookmark._id);
    }
  };

  const [bookmarkDeleteModal, setBookmarkDeleteModal] = useState(false);

  const handleDeleteBookmark = (key) => {
    const cBookmark = bookmarks[key];
    if (cBookmark) {
      // Send request

      if (cBookmark._id === currentBookmark._id) {
        const nextBookmark = bookmarks[key - 1] || bookmarks[key + 1];

        if (nextBookmark) {
          deleteBookmark(cBookmark._id, nextBookmark._id);
          setCurrentBookmark(nextBookmark);
          setRange([nextBookmark.time_from, nextBookmark.time_to]);
        } else {
          deleteBookmark(cBookmark._id, null);
          setCurrentBookmark(null);
          setRange([cBookmark.time_from, cBookmark.time_to]);
          setBookmarks((sbs) => {
            const result = Array.from(sbs);
            result.splice(key, 1);
            return result;
          });
        }
      } else {
        deleteBookmark(cBookmark._id, currentBookmark._id);
        setBookmarks((sbs) => {
          const result = Array.from(sbs);
          result.splice(key, 1);
          return result;
        });
      }
    }
  };

  const handleDeleteBookmarkModal = (key) => (e) => {
    e.preventDefault();
    setBookmarkDeleteModal(key);
  };

  const handleCancelBookmarkDelete = (e) => {
    setBookmarkDeleteModal(false);
  };

  const handleSubmitBookmarkDelete = (e) => {
    e.preventDefault();
    handleDeleteBookmark(bookmarkDeleteModal);

    setBookmarkDeleteModal(false);
  };

  useEffect(() => {
    if (bookmarkRef.current) {
      bookmarkRef.current.scrollIntoView({
        behavior: "smooth",
        block: currentBookmark ? "center" : "end",
      });
    }
  }, [currentBookmark]);

  useEffect(() => {
    subscribed.current = true;

    return () => (subscribed.current = false);
  }, []);

  const canScroll = (bookmark_id, key) => {
    if (currentBookmark) {
      if (currentBookmark._id === bookmark_id) return true;
    } else {
      if (key === bookmarks.length - 1) return true;
    }
    return false;
  };

  return (
    <>
      <Prompt when={hasChanges} message="You have unsaved changes in bookmark section, are you sure you want to continue?" />
      <Modal centered show={bookmarkDeleteModal !== false} onHide={handleCancelBookmarkDelete}>
        <Modal.Header closeButton>
          <Modal.Title className="text-danger">Delete bookmark</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <h5 className="mb-0 text-danger">Are you sure you want to delete this?</h5>
          <p className="text-muted">Note: This action cannot be reverted</p>
        </Modal.Body>
        <Modal.Footer>
          <BSButton variant="secondary" onClick={handleCancelBookmarkDelete}>
            Cancel
          </BSButton>
          <BSButton variant="danger" onClick={handleSubmitBookmarkDelete}>
            Confirm Delete
          </BSButton>
        </Modal.Footer>
      </Modal>
      <div className="child-caption">Save Your Analysis</div>
      <div className="td-input">
        <div className="td-input-left">
          <div className="td-input-label">Selected range:</div>
          <div className="td-input-label">Select feedback:</div>
          <div className="td-input-label"></div>
        </div>
        <div className="td-input-right">
          <div className="td-input-wrapper">
            <div
              style={{
                width: "35%",
                height: "100%",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div className="range-meter">
                <div className="circle">
                  <div className="range">{range[0]}</div>
                  <div className="text">min</div>
                </div>
                <div className="circle-dash" />
                <div className="circle">
                  <div className="range">{range[1]}</div>
                  <div className="text">min</div>
                </div>
              </div>
            </div>
            <div
              style={{
                width: "65%",
                height: "100%",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Form.Control className="bookmark-topic" value={topic} onChange={handleChangeTopic} size="sm" placeholder="Enter topic name here" />
            </div>
          </div>
          <div className="td-input-wrapper td-feedback-types">
            {feedbackTypes.map((feedback, key) => (
              <Button key={key} active={feedbackSelected.includes(feedback.key)} onClick={handleChangeFeedback(feedback.key)} variant={feedback.key + " small auto px-0"} title={feedback.name} />
            ))}
          </div>
          <div className="td-input-wrapper add-bookmark">
            <BSButton disabled={!hasChanges} variant="none" className="nd-btn-save" size="sm" onClick={handleCreateNew}>
              <span>Add Bookmark</span>
            </BSButton>
          </div>
        </div>
      </div>
      {/* <div className="td-buttons">
        {currentBookmark ? (
          <>
            <BSButton disabled={!hasChanges} variant="none" className="nd-btn-save mb-1" size="sm" onClick={handleCreateNew}>
              <span>Add Bookmark</span>
              <i className="fas fa-chevron-right ml-2" />
            </BSButton>
            {hasChanges && (
              <BSButton variant="link" size="sm" onClick={handleSaveCurrent} style={{ whiteSpace: "nowrap" }}>
                <span>Save changes</span>
              </BSButton>
            )}
          </>
        ) : (
          <BSButton variant="none" className="nd-btn-save" size="sm" onClick={handleCreateNew}>
            <span>Add Bookmark</span>
            <i className="fas fa-chevron-right ml-2" />
          </BSButton>
        )}
      </div> */}
      <div className="td-history">
        <div className="bookmark-header">
          <div className="heading">Your bookmarks</div>
          <div className="save">
            {hasChanges && (
              <BSButton variant="none" className="nd-btn-save" size="sm" onClick={handleSaveCurrent} style={{ whiteSpace: "nowrap" }}>
                <span>Save changes</span>
              </BSButton>
            )}
          </div>
        </div>
        <div className="bookmark-list">
          {bookmarks.map((bookmark, key) => {
            return (
              <div className={"item" + (currentBookmark && currentBookmark._id === bookmark._id ? " active" : "")} key={bookmark._id || "bookmark-" + key} ref={canScroll(bookmark._id, key) ? bookmarkRef : null} onClick={handleSwitchBookmark(key)}>
                <div className="bm-range">
                  <div className="range-meter">
                    <div className="circle">
                      <div className="range">{bookmark.time_from}</div>
                    </div>
                    <div className="circle-dash" />
                    <div className="circle">
                      <div className="range">{bookmark.time_to}</div>
                      <div className="text">min</div>
                    </div>
                  </div>
                </div>
                <div className="bm-topic">{bookmark.topic}</div>
                <div className="bm-types">
                  {bookmark.feedback_type && Array.isArray(bookmark.feedback_type) ? (
                    bookmark.feedback_type.map((fd, k2) => (
                      <div className="wrapper" key={"bookmark-" + key + "-" + k2}>
                        <Badge key={k2} className={fd + " text-capitalize"}>
                          {String(fd)}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <Badge className={bookmark.feedback_type + " text-capitalize"}>{String(bookmark.feedback_type)}</Badge>
                  )}
                </div>
                <div className="bm-delete" onClick={handleDeleteBookmarkModal(key)}>
                  <i className="fas fa-trash-alt" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

const dummyBookmarks = [
  { time_from: 0, time_to: 2, feedback_type: ["easy"], topic: "Bookmark 1" },
  {
    time_from: 2,
    time_to: 4,
    feedback_type: ["difficult"],
    topic: "Bookmark 2",
  },
  {
    time_from: 1,
    time_to: 3,
    feedback_type: ["engaging"],
    topic: "Bookmark 3",
  },
];

function BookmarksBasic() {
  const { range, currentBookmark } = useFeedback();

  return (
    <>
      <div className="td-input td-blocked">
        <div className="td-input-left">
          <div className="td-input-label">Selected range:</div>
          <div className="td-input-label">Select the feedback:</div>
        </div>
        <div className="td-input-right">
          <div className="td-input-wrapper">
            <div
              style={{
                width: "25%",
                height: "100%",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div className="range-meter">
                <div className="circle-num">{range[0]}</div>
                <div className="circle-dash" />
                <div className="circle-num">{range[1]}</div>
              </div>
            </div>
            <div
              style={{
                width: "75%",
                height: "100%",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Form.Control className="bookmark-topic" size="sm" placeholder="Enter topic name here" />
            </div>
          </div>
          <div className="td-input-wrapper td-feedback-types">
            {feedbackTypes.map((feedback, key) => (
              <Button key={key} variant={feedback.key + " small auto px-0"} title={feedback.name} />
            ))}
          </div>
        </div>
      </div>
      <div className="td-buttons">
        <BSButton variant="none" className="nd-btn-save" size="sm">
          <span>Bookmark</span>
          <i className="fas fa-chevron-right ml-2" />
        </BSButton>
      </div>
      <div className="td-history">
        {dummyBookmarks.map((bookmark, key) => (
          <div className={"item" + (currentBookmark && currentBookmark._id === bookmark._id ? " active" : "")} key={key}>
            <Badge className="time mr-1">
              {bookmark.time_from} - {bookmark.time_to} min
            </Badge>
            {bookmark.feedback_type && Array.isArray(bookmark.feedback_type) ? (
              bookmark.feedback_type.map((fd, k2) => (
                <Badge key={k2} className={fd + " text-capitalize"}>
                  {String(fd)}
                </Badge>
              ))
            ) : (
              <Badge className={bookmark.feedback_type + " text-capitalize"}>{String(bookmark.feedback_type)}</Badge>
            )}
            <div className="ml-1 text">- {bookmark.topic}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export { BookmarksBasic };

export default NewBookmarks;
