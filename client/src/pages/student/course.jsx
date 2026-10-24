import React, { useState, useEffect } from "react";
import { Link, useParams, useHistory } from "react-router-dom";
import { Button, Badge, Alert } from "react-bootstrap";
import { ProvideStudentAuth, useStudentAuth } from "provider/student-auth";
import StudentAuth from "components/student-auth";
import Loader from "components/Loader";
import { FaPlay, FaArrowLeft, FaClock } from "react-icons/fa";

function formatDuration(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function CourseLessons() {
  const { id } = useParams();
  const history = useHistory();
  const { request, logout, data: student } = useStudentAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    request("GET", `/student/courses/${id}`)
      .then(({ data }) => {
        if (data && data.success) setCourse(data.course);
        else setError("Could not load this course.");
      })
      .catch((err) => {
        const status = err && err.response && err.response.status;
        if (status === 404) setError("Course not found or you do not have access.");
        else setError("Could not load this course.");
      })
      .finally(() => setLoading(false));
  }, [id, request]);

  const handleLogout = async () => {
    await logout();
    history.push("/student");
  };

  if (loading) return <Loader label="Loading lectures..." />;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #dee2e6", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link to="/student" style={{ color: "#6c757d", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <FaArrowLeft size={13} /> My Courses
          </Link>
          <span style={{ color: "#dee2e6" }}>›</span>
          <span style={{ fontWeight: 600, color: "#343a40" }}>{course ? course.name : "Course"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Badge variant="secondary" style={{ fontSize: "0.75rem" }}>
            {student && student.name ? student.name : student && student.email}
          </Badge>
          <Button variant="outline-secondary" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      <div className="container py-4">
        {error && <Alert variant="danger">{error}</Alert>}

        {course && (
          <>
            <h5 className="mb-1" style={{ color: "#343a40" }}>{course.name}</h5>
            <p className="text-muted mb-4" style={{ fontSize: "0.85rem" }}>
              {course.lessons ? course.lessons.length : 0} lecture{course.lessons && course.lessons.length !== 1 ? "s" : ""}
            </p>

            {course.lessons && course.lessons.length === 0 && (
              <div className="text-center py-5">
                <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🎬</div>
                <p className="text-muted">No lectures have been added to this course yet.</p>
              </div>
            )}

            <div className="row">
              {course.lessons && course.lessons.map((lesson, index) => (
                <div key={lesson._id} className="col-12 col-md-6 col-lg-4 mb-4">
                  <div
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 8,
                      border: "1px solid #dee2e6",
                      padding: "16px",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: "0.75rem", color: "#adb5bd", fontWeight: 500 }}>Lecture {index + 1}</span>
                      {lesson.minutes && (
                        <span style={{ fontSize: "0.75rem", color: "#6c757d", display: "flex", alignItems: "center", gap: 4 }}>
                          <FaClock size={11} /> {formatDuration(lesson.minutes)}
                        </span>
                      )}
                    </div>
                    <h6 style={{ fontWeight: 600, color: "#343a40", marginBottom: 6, fontSize: "0.95rem" }}>{lesson.name}</h6>
                    {lesson.desc && (
                      <p style={{ fontSize: "0.82rem", color: "#6c757d", marginBottom: 12, flexGrow: 1 }}>
                        {lesson.desc}
                      </p>
                    )}
                    <div className="mt-auto">
                      <Link to={`/l/${lesson.id}`}>
                        <Button variant="success" size="sm" block style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <FaPlay size={11} /> Watch Lecture
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StudentCourseInner() {
  const { isLoggedIn, loading, refresh } = useStudentAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  if (!checked || loading) return <Loader />;
  if (!isLoggedIn) return <StudentAuth />;
  return <CourseLessons />;
}

export default function StudentCoursePage() {
  return (
    <ProvideStudentAuth>
      <StudentCourseInner />
    </ProvideStudentAuth>
  );
}
