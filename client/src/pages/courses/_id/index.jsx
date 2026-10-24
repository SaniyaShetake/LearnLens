import React, { useRef, useState } from "react";
import Layout from "components/Layout";
import { useEffect } from "react";
import { useAuth } from "provider/auth";
import Loader from "components/Loader";
import { Link, useHistory, useParams } from "react-router-dom";
import { Alert, Button, OverlayTrigger, Tooltip, Table, Modal, Form, Spinner, Dropdown } from "react-bootstrap";
import ReactPlayer from "react-player/lazy";
import QuizManager from "components/QuizManager";

import { useFormik } from "formik";
import * as Yup from "yup";
import { useCallback } from "react";
import { getErrorMessage } from "handler/api";
import { isValidVideoUrl, parseDriveFileId, drivePreviewUrl } from "utils/video";

const playerOptions = {
  youtube: {
    host: "https://www.youtube-nocookie.com",
    playerVars: { modestbranding: 1, fs: 0, iv_load_policy: 3, autohide: 0 },
  },
};

/** Preview in the add/edit lesson form: Drive's own embed for Drive links, react-player for YouTube. */
function VideoPreview({ url, onError }) {
  const driveId = parseDriveFileId(url);
  if (driveId) {
    return <iframe title="Video preview" src={drivePreviewUrl(driveId)} width="100%" height="100%" allow="autoplay; fullscreen" style={{ border: 0 }} />;
  }
  return <ReactPlayer onError={onError} height="100%" width="100%" controls config={playerOptions} url={url} />;
}

const VIDEO_LINK_HINT = 'Google Drive videos must be MP4 files shared as "Anyone with the link".';

function fallbackCopyTextToClipboard(text) {
  return new Promise((resolve, reject) => {
    var textArea = document.createElement("textarea");
    textArea.value = text;

    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      var successful = document.execCommand("copy");
      if (successful) return resolve("Link copied to clipboard!");
      reject("Couldn't copy link to clipboard");
    } catch (err) {
      reject("Couldn't copy link to clipboard");
    }

    document.body.removeChild(textArea);
  });
}

function copyTextToClipboard(text) {
  if (!navigator.clipboard) return fallbackCopyTextToClipboard(text);

  return new Promise((resolve, reject) => {
    navigator.clipboard.writeText(text).then(
      () => {
        resolve("Link copied to clipboard!");
      },
      () => {
        reject("Couldn't copy link to clipboard");
      }
    );
  });
}

const addLessonValidationSchema = Yup.object({
  name: Yup.string().required("Name is required"),
  desc: Yup.string(),
  youtube_link: Yup.string()
    .required("Video link is required")
    .test("Video URL", "Please enter a valid YouTube or Google Drive link", (value) => isValidVideoUrl(value)),
});

const editLessonValidationSchema = Yup.object({
  name: Yup.string().required("Name is required"),
  desc: Yup.string(),
  youtube_link: Yup.string()
    .required("Video link is required")
    .test("Video URL", "Please enter a valid YouTube or Google Drive link", (value) => isValidVideoUrl(value)),
});

const editCourseValidationSchema = Yup.object({
  name: Yup.string().required("Name is required"),
});

function CourseEdit({ course = null, onConfirm = () => {} }) {
  const { request } = useAuth();
  const [editCourseModal, setEditCourseModal] = useState(false);
  const [editError, setEditError] = useState(null);

  const handleShowModal = () => {
    setEditError(null);
    setEditCourseModal(true);
  };

  const handleCloseModal = () => {
    setEditError(null);
    setEditCourseModal(false);
  };

  const editCourseFormik = useFormik({
    initialValues: { name: (course && course.name) || "" },
    validationSchema: editCourseValidationSchema,
    onSubmit: async (values) => {
      setEditError(null);
      try {
        const { data } = await request("PUT", "/courses/" + course._id, { name: values.name });
        if (data && data.success) {
          onConfirm(values.name);
          setEditCourseModal(false);
        } else {
          setEditError("Couldn't save changes, try again.");
        }
      } catch (error) {
        console.log(error);
        setEditError(getErrorMessage(error, "Couldn't save changes, try again."));
      }
    },
  });
  return (
    <>
      <Dropdown.Item className="dropdown-item" onClick={handleShowModal}>
        <i className="far fa-edit text-info mr-1" />
        <span className="fg">Edit</span>
      </Dropdown.Item>
      <Modal show={editCourseModal} onHide={handleCloseModal}>
        <Modal.Header title="Edit course" closeButton closeLabel="Edit course" />
        <Modal.Body>
          <Form>
            <Form.Group controlId="lesson-name">
              <Form.Label>Course name</Form.Label>
              <Form.Control name="name" isInvalid={editCourseFormik.touched.name && editCourseFormik.errors.name} onChange={editCourseFormik.handleChange} onBlur={editCourseFormik.handleBlur} value={editCourseFormik.values.name} />
              {editCourseFormik.touched.name && editCourseFormik.errors.name && <Form.Text className="text-danger">{editCourseFormik.errors.name}</Form.Text>}
            </Form.Group>
          </Form>
          {editError && <Alert variant="danger">{editError}</Alert>}
          <Button onClick={editCourseFormik.handleSubmit}>
            {editCourseFormik.isSubmitting ? (
              <Spinner animation="border" role="status" size="sm">
                <span className="sr-only">Loading...</span>
              </Spinner>
            ) : (
              "Submit"
            )}
          </Button>
        </Modal.Body>
      </Modal>
    </>
  );
}

function CourseInfo({ id = "" }) {
  const subscribed = useRef(true);
  const history = useHistory();
  const { request } = useAuth();

  const [course, setCourse] = useState(null);
  const [loadingC, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [addLessonModal, setAddLessonModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyMessage, setCopyMessage] = useState({});
  const [joinCode, setJoinCode] = useState(null);
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);
  const [editLesson, setEditLesson] = useState(null);
  const [deleteLesson, setDeleteLesson] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteCourseError, setDeleteCourseError] = useState(null);

  const [deleteCourseModal, setDeleteCourseModal] = useState(false);
  const [quizLesson, setQuizLesson] = useState(null);

  useEffect(() => {
    subscribed.current = true;

    return () => {
      subscribed.current = false;
    };
  }, []);

  // Loads the course; `background` refreshes keep the current view mounted (no full-page loader).
  const refreshCourse = useCallback(
    async ({ background = false } = {}) => {
      if (!id) {
        setLoadError("No course was specified.");
        setLoading(false);
        return;
      }

      if (!background) setLoading(true);

      try {
        const { data } = await request("GET", "/courses/" + id);

        if (!subscribed.current) return;
        if (data && data.success && data.course) {
          setCourse(data.course);
          setLoadError(null);
        } else if (!background) {
          setCourse(null);
          setLoadError("This course could not be found.");
        }
      } catch (error) {
        console.log(error);
        if (!subscribed.current) return;
        const status = error && error.response && error.response.status;
        if (!background) {
          setCourse(null);
          setLoadError(status === 404 ? "This course could not be found." : getErrorMessage(error, "Couldn't load this course."));
        }
      } finally {
        if (subscribed.current && !background) setLoading(false);
      }
    },
    [request, id]
  );

  const handleDeleteCourseModal = () => {
    setDeleteCourseError(null);
    setDeleteCourseModal(true);
  };

  const handleCloseDeleteCourseModal = () => {
    setDeleteCourseError(null);
    setDeleteCourseModal(false);
  };

  const handleAddLesson = async (values, { setStatus, resetForm }) => {
    setStatus(null);
    // Prefer the loaded course's id; never post to /courses//lesson.
    const courseId = (course && course._id) || id;
    if (!courseId) {
      setStatus({ formError: "Couldn't determine the course for this lesson, please reload the page." });
      return;
    }
    try {
      const { data } = await request("POST", `/courses/${courseId}/lesson`, values);
      if (data && data.success) {
        if (subscribed.current) {
          await refreshCourse({ background: true });
          if (subscribed.current) {
            setAddLessonModal(false);
            resetForm();
          }
        }
        return;
      }
      setStatus({ formError: (data && data.message) || "Couldn't save lesson, try again." });
    } catch (error) {
      setStatus({ formError: getErrorMessage(error, "Couldn't save lesson, try again.") });
    }
  };

  const formik = useFormik({
    initialValues: {
      name: "",
      desc: "",
      youtube_link: "",
    },
    onSubmit: handleAddLesson,
    validationSchema: addLessonValidationSchema,
  });

  const handleEditLessonSubmit = async (values, { setStatus, resetForm }) => {
    setStatus(null);
    try {
      if (!editLesson) return;
      const { data } = await request("PUT", `/lessons/${editLesson}`, values);

      if (data && data.success) {
        setCourse((course) => {
          const result = Array.from(course.lessons);

          const lessonIndex = result.findIndex((l) => l._id === editLesson);
          result.splice(lessonIndex, 1, data.lesson);
          return { ...course, lessons: result };
        });

        resetForm();
      } else {
        setStatus({ formError: (data && data.message) || "Couldn't save changes, try again." });
      }
    } catch (error) {
      setStatus({ formError: getErrorMessage(error, "Couldn't save changes, try again.") });
    }
  };

  const handleEditLessonReset = () => {
    setEditLesson(null);
  };

  const editFormik = useFormik({
    initialValues: {
      name: "",
      desc: "",
      youtube_link: "",
    },
    onSubmit: handleEditLessonSubmit,
    onReset: handleEditLessonReset,
    validationSchema: editLessonValidationSchema,
  });

  useEffect(() => {
    refreshCourse();
  }, [refreshCourse]);

  useEffect(() => {
    if (!id) return;
    request("GET", "/courses/" + id + "/join-code")
      .then(({ data }) => { if (data && data.success) setJoinCode(data.join_code); })
      .catch(() => {});
  }, [id, request]);

  const handleCopyJoinCode = () => {
    if (!joinCode) return;
    copyTextToClipboard(joinCode)
      .then(() => { setJoinCodeCopied(true); setTimeout(() => setJoinCodeCopied(false), 2000); })
      .catch(() => {});
  };

  const hideAddLessonModal = (e) => {
    setAddLessonModal(false);
  };

  const showAddLessonModal = (e) => {
    formik.setStatus(null);
    setAddLessonModal(true);
  };

  const handleVideoError = () => {};

  const handleCloseCopy = () => {
    setShowCopyModal(false);
  };

  const handleCopyLinkOpen = (id) => (e) => {
    setShowCopyModal(true);
    copyTextToClipboard(window.location.origin + "/l/" + id)
      .then((message) => {
        setCopyMessage({ error: false, message });
        setTimeout(() => {
          setShowCopyModal(false);
        }, 800);
      })
      .catch((message) => {
        setCopyMessage({ error: true, message });
      });
  };

  const handleEditLesson = (key) => (e) => {
    const lesson = course.lessons[key];
    if (lesson) {
      setEditLesson(lesson._id);
      editFormik.setValues({ name: lesson.name, desc: lesson.desc, youtube_link: lesson.youtube_link });
    }
  };
  const handleDeleteLesson = (key) => (e) => {
    const lesson = course.lessons[key];
    setDeleteError(null);
    if (lesson) setDeleteLesson(lesson._id);
  };

  const handleDeleteLessonCancel = () => {
    setDeleteError(null);
    setDeleteLesson(null);
  };

  const handleDeleteLessonSubmit = async () => {
    if (!deleteLesson) return;
    setDeleteError(null);
    try {
      const { data } = await request("DELETE", `/lessons/${deleteLesson}`);

      if (data && data.success) {
        setCourse((course) => {
          const result = Array.from(course.lessons);

          const lessonIndex = result.findIndex((l) => l._id === deleteLesson);
          result.splice(lessonIndex, 1);
          return { ...course, lessons: result };
        });

        setDeleteLesson(null);
      } else {
        setDeleteError("Couldn't delete lesson, try again.");
      }
    } catch (error) {
      console.log(error);
      setDeleteError(getErrorMessage(error, "Some error occured while deleting"));
    }
  };
  const editCourseFormikRef = useRef();

  const [deleting, setDeleting] = useState(false);

  const handleDeleteCourse = async (e) => {
    e.preventDefault();

    setDeleting(true);
    setDeleteCourseError(null);

    try {
      const { data } = await request("DELETE", "/courses/" + course._id);

      if (!subscribed.current) return;
      if (data && data.success) {
        setDeleting(false);
        history.replace("/dashboard");
      } else {
        setDeleting(false);
        setDeleteCourseError("Couldn't remove the course, try again.");
      }
    } catch (error) {
      console.log(error);
      if (subscribed.current) {
        setDeleting(false);
        setDeleteCourseError(getErrorMessage(error, "Couldn't remove the course, try again."));
      }
    }
  };

  useEffect(() => {
    if (course && course.name) {
      if (editCourseFormikRef.current) editCourseFormikRef.current.setFieldValue("name", course.name);
    }
  }, [course]);

  if (loadingC) return <Loader />;
  if (!course)
    return (
      <div className="card course-card">
        <div className="card-body text-center py-5">
          <Alert variant="danger" className="mb-4">
            {loadError || "Couldn't load this course."}
          </Alert>
          <Button variant="outline-secondary" className="mr-2" onClick={() => refreshCourse()}>
            Try again
          </Button>
          <Link to="/dashboard" className="btn btn-primary">
            <i className="fas fa-long-arrow-alt-left mr-1" /> Back to dashboard
          </Link>
        </div>
      </div>
    );

  return (
    <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 8px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
      <Modal show={deleteCourseModal} onHide={handleCloseDeleteCourseModal}>
        <Modal.Header closeButton style={{ background: "#3b0764", color: "#f3e8ff" }}>
          <Modal.Title style={{ color: "#f3e8ff", fontSize: "1rem" }}>Delete course</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <h4 className="font-weight-bold text-danger">Are you sure?</h4>
            <h5 className="text-danger font-weight-normal">If you proceed, it will remove the course.</h5>
            <div className="mt-4">
              <button onClick={handleCloseDeleteCourseModal} className="btn btn-secondary mr-2">
                Cancel
              </button>
              <button className="btn btn-danger" disabled={deleting} onClick={handleDeleteCourse}>
                {deleting ? (
                  <Spinner animation="border" role="status" size="sm">
                    <span className="sr-only">Loading...</span>
                  </Spinner>
                ) : (
                  "Confirm"
                )}
              </button>
            </div>
            {deleteCourseError && (
              <Alert variant="danger" className="mt-3 mb-0">
                {deleteCourseError}
              </Alert>
            )}
          </div>
        </Modal.Body>
      </Modal>
      <Modal size="lg" show={addLessonModal} onHide={hideAddLessonModal}>
        <Modal.Header closeButton closeLabel="Post video" />
        <Modal.Body>
          <div className="container-fluid">
            <div className="row">
              <div className="col-lg-6">
                <Form.Group controlId="lesson-name">
                  <Form.Label>Title</Form.Label>
                  <Form.Control name="name" isInvalid={formik.touched.name && formik.errors.name} onChange={formik.handleChange} onBlur={formik.handleBlur} value={formik.values.name} />
                  {formik.touched.name && formik.errors.name && <Form.Text className="text-danger">{formik.errors.name}</Form.Text>}
                </Form.Group>
                <Form.Group controlId="lesson-yt_link">
                  <Form.Label>
                    <span>Video URL (YouTube or Google Drive) </span>
                    <a href="https://support.google.com/drive/answer/2494822" target="_blank" rel="noopener noreferrer" title="How to share a Google Drive file">
                      <i className="fas fa-info-circle" />
                    </a>
                  </Form.Label>
                  <Form.Control
                    name="youtube_link"
                    isInvalid={formik.touched.youtube_link && formik.errors.youtube_link}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.youtube_link}
                    placeholder="https://www.youtube.com/watch?v=7PXyg2r-k2c"
                  />
                  {formik.touched.youtube_link && formik.errors.youtube_link ? (
                    <Form.Text className="text-danger">{formik.errors.youtube_link}</Form.Text>
                  ) : (
                    <Form.Text className="text-muted">{VIDEO_LINK_HINT}</Form.Text>
                  )}
                </Form.Group>
              </div>
              <div className="col-lg-6 lesson-add-video">
                {formik.values.youtube_link && !formik.errors.youtube_link ? (
                  <VideoPreview onError={handleVideoError} url={formik.values.youtube_link} />
                ) : (
                  <div className="h-100 d-flex justify-content-center align-items-center border border-light">
                    <div className="lead">Enter a YouTube or Google Drive link for preview</div>
                  </div>
                )}
              </div>
              <div className="col-lg-12">
                <Form.Group controlId="lesson-desc">
                  <Form.Label>Description</Form.Label>
                  <Form.Control name="desc" as="textarea" isInvalid={formik.errors.desc} onChange={formik.handleChange} onBlur={formik.handleBlur} value={formik.values.desc} />
                </Form.Group>
              </div>
              {formik.status && formik.status.formError && (
                <div className="col-12">
                  <Alert variant="danger">{formik.status.formError}</Alert>
                </div>
              )}
              <div className="col-12 text-center">
                <Button disabled={formik.isSubmitting} onClick={formik.handleSubmit}>
                  {formik.isSubmitting ? (
                    <Spinner animation="border" role="status" size="sm">
                      <span className="sr-only">Loading...</span>
                    </Spinner>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Modal.Body>
      </Modal>
      <Modal size="lg" show={!!editLesson} onHide={editFormik.resetForm}>
        <Modal.Header closeButton>
          <Modal.Title>Edit lesson</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="container-fluid">
            <div className="row">
              <div className="col-lg-6">
                <Form.Group controlId="lesson-name">
                  <Form.Label>Title</Form.Label>
                  <Form.Control name="name" isInvalid={editFormik.touched.name && editFormik.errors.name} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur} value={editFormik.values.name} />
                  {editFormik.touched.name && editFormik.errors.name && <Form.Text className="text-danger">{editFormik.errors.name}</Form.Text>}
                </Form.Group>
                <Form.Group controlId="lesson-yt_link">
                  <Form.Label>
                    <span>Video URL (YouTube or Google Drive) </span>
                    <a href="https://support.google.com/drive/answer/2494822" target="_blank" rel="noopener noreferrer" title="How to share a Google Drive file">
                      <i className="fas fa-info-circle" />
                    </a>
                  </Form.Label>
                  <Form.Control
                    name="youtube_link"
                    isInvalid={editFormik.touched.youtube_link && editFormik.errors.youtube_link}
                    onChange={editFormik.handleChange}
                    onBlur={editFormik.handleBlur}
                    value={editFormik.values.youtube_link}
                    placeholder="https://www.youtube.com/watch?v=7PXyg2r-k2c"
                  />
                  {editFormik.touched.youtube_link && editFormik.errors.youtube_link ? (
                    <Form.Text className="text-danger">{editFormik.errors.youtube_link}</Form.Text>
                  ) : (
                    <Form.Text className="text-muted">{VIDEO_LINK_HINT}</Form.Text>
                  )}
                </Form.Group>
              </div>
              <div className="col-lg-6 lesson-add-video">
                {editFormik.values.youtube_link && !editFormik.errors.youtube_link ? (
                  <VideoPreview onError={handleVideoError} url={editFormik.values.youtube_link} />
                ) : (
                  <div className="h-100 d-flex justify-content-center align-items-center border border-light">
                    <div className="lead">Enter a YouTube or Google Drive link for preview</div>
                  </div>
                )}
              </div>
              <div className="col-lg-12">
                <Form.Group controlId="lesson-desc">
                  <Form.Label>Description</Form.Label>
                  <Form.Control name="desc" as="textarea" isInvalid={editFormik.errors.desc} onChange={editFormik.handleChange} onBlur={editFormik.handleBlur} value={editFormik.values.desc} />
                </Form.Group>
              </div>
              {editFormik.status && editFormik.status.formError && (
                <div className="col-12">
                  <Alert variant="danger">{editFormik.status.formError}</Alert>
                </div>
              )}
              <div className="col-12 text-center">
                <Button disabled={editFormik.isSubmitting} onClick={editFormik.handleSubmit}>
                  {editFormik.isSubmitting ? (
                    <Spinner animation="border" role="status" size="sm">
                      <span className="sr-only">Loading...</span>
                    </Spinner>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Modal.Body>
      </Modal>
      <Modal centered show={!!deleteLesson} onHide={handleDeleteLessonCancel}>
        <Modal.Header closeButton>
          <Modal.Title>Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <h4 className="font-weight-bold text-danger">Are you sure?</h4>
            <h5 className="text-danger font-weight-normal">Confirming will delete the lesson and all it's contents.</h5>
            <div className="mt-4">
              <button onClick={handleDeleteLessonCancel} className="btn btn-secondary mr-2">
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteLessonSubmit}>
                Delete
              </button>
            </div>

            {deleteError && (
              <Alert variant="danger" className="mt-3 mb-0">
                {deleteError}
              </Alert>
            )}
          </div>
        </Modal.Body>
      </Modal>
      {/* ── Course header ───────────────────────────────────────────── */}
      <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, background: "#fff" }}>
        <div>
          <div style={{ fontSize: "0.72rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Course</div>
          <div style={{ fontWeight: 700, fontSize: "1.15rem", color: "#111827" }}>{course.name}</div>
          {joinCode && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>Student join code:</span>
              <span
                onClick={handleCopyJoinCode}
                title="Click to copy"
                style={{ fontFamily: "monospace", fontWeight: 700, color: "#7c3aed", cursor: "pointer", background: "#ede9fe", padding: "2px 10px", borderRadius: 5, letterSpacing: 2, fontSize: "0.85rem" }}
              >
                {joinCode}
              </span>
              {joinCodeCopied && <span style={{ color: "#16a34a", fontSize: "0.75rem" }}>✓ Copied</span>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <OverlayTrigger defaultShow={!addLessonModal && course.lessons && !course.lessons.length} placement="left" overlay={<Tooltip>Post a new lesson</Tooltip>}>
            <button onClick={showAddLessonModal} style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <i className="fas fa-plus" style={{ fontSize: "0.8rem" }} /> New Lesson
            </button>
          </OverlayTrigger>
          <Dropdown alignRight as="span">
            <Dropdown.Toggle as="button" style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: "0.85rem", cursor: "pointer" }}>
              <i className="fas fa-cog" />
            </Dropdown.Toggle>
            <Dropdown.Menu alignRight>
              <CourseEdit course={course} onConfirm={(name) => setCourse((s) => ({ ...s, name }))} />
              <Dropdown.Item onClick={handleDeleteCourseModal}>
                <i className="far fa-trash-alt text-danger mr-2" />Remove course
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </div>

      {/* ── Lessons list ────────────────────────────────────────────── */}
      <div style={{ padding: "20px 24px" }}>
        {Array.isArray(course.lessons) && course.lessons.length > 0 ? (
          <div>
            <div style={{ fontSize: "0.78rem", color: "#6b7280", fontWeight: 600, marginBottom: 12 }}>
              {course.lessons.length} Lesson{course.lessons.length !== 1 ? "s" : ""}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {course.lessons.map((lesson, k) => (
                <div key={lesson._id || k} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 28, height: 28, background: "#ede9fe", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "#7c3aed", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 }}>
                    {k + 1}
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontWeight: 600, color: "#111827", fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {lesson.name}
                      {lesson.desc && (
                        <OverlayTrigger placement="top" trigger={["hover", "focus"]} overlay={<Tooltip>{lesson.desc}</Tooltip>}>
                          <i className="ml-2 fas fa-info-circle" style={{ color: "#9ca3af", fontSize: "0.75rem" }} />
                        </OverlayTrigger>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <OverlayTrigger placement="top" trigger={["hover","focus"]} overlay={<Tooltip>Share</Tooltip>}>
                      <button onClick={handleCopyLinkOpen(lesson.id)} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 9px", color: "#6b7280", cursor: "pointer", fontSize: "0.78rem" }}>
                        <i className="far fa-share-square" />
                      </button>
                    </OverlayTrigger>
                    <OverlayTrigger placement="top" trigger={["hover","focus"]} overlay={<Tooltip>Dashboard</Tooltip>}>
                      <a href={"/l/" + lesson.id + "/dashboard"} target="_blank" rel="noreferrer" style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 9px", color: "#6b7280", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                        <i className="far fa-chart-bar" />
                      </a>
                    </OverlayTrigger>
                    <OverlayTrigger placement="top" trigger={["hover","focus"]} overlay={<Tooltip>Manage Quiz</Tooltip>}>
                      <button onClick={() => setQuizLesson(lesson)} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 9px", color: "#6b7280", cursor: "pointer", fontSize: "0.78rem" }}>
                        <i className="fas fa-question-circle" />
                      </button>
                    </OverlayTrigger>
                    <Dropdown alignRight>
                      <Dropdown.Toggle as="button" style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 9px", color: "#6b7280", cursor: "pointer", fontSize: "0.78rem" }}>
                        <i className="fas fa-ellipsis-v" />
                      </Dropdown.Toggle>
                      <Dropdown.Menu alignRight>
                        <Dropdown.Item onClick={handleEditLesson(k)}>
                          <i className="far fa-edit mr-2 text-primary" />Edit
                        </Dropdown.Item>
                        <Dropdown.Item onClick={handleDeleteLesson(k)}>
                          <i className="far fa-trash-alt mr-2 text-danger" />Delete
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <i className="fas fa-book-open" style={{ fontSize: "2rem", color: "#d1d5db", marginBottom: 12, display: "block" }} />
            <div style={{ fontWeight: 600, color: "#374151" }}>No lessons yet</div>
            <div style={{ fontSize: "0.82rem", color: "#9ca3af", marginTop: 4 }}>Click <strong>New Lesson</strong> to post your first.</div>
          </div>
        )}
      </div>
      <Modal size="sm" centered show={showCopyModal} onHide={handleCloseCopy}>
        <Modal.Body>
          <div className={"py-3 font-weight-bold text-center " + (copyMessage.error ? "text-danger" : "text-primary")}>{copyMessage.message}</div>
        </Modal.Body>
      </Modal>
      <QuizManager
        lesson={quizLesson}
        show={!!quizLesson}
        onHide={() => setQuizLesson(null)}
      />
    </div>
  );
}

function CourseId() {
  const { course_id } = useParams();
  const { user, loading } = useAuth();

  if (loading) return <Loader />;

  if (user)
    return (
      <Layout className="course-lessons">
        <div className="container">
          <div className="row py-3">
            <div className="col-12">
              <CourseInfo id={course_id} />
            </div>
          </div>
        </div>
      </Layout>
    );
  return null;
}

export default CourseId;
