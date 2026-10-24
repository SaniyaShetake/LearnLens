import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Badge, Alert } from "react-bootstrap";
import { ProvideStudentAuth, useStudentAuth } from "provider/student-auth";
import StudentAuth from "components/student-auth";
import Loader from "components/Loader";
import api from "handler/api";

function CourseList() {
  const { data: student, request, logout } = useStudentAuth();
  const [courses, setCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [availableLoading, setAvailableLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [joinSuccess, setJoinSuccess] = useState(null);

  const loadCourses = () => {
    setLoading(true);
    request("GET", "/student/courses")
      .then(({ data }) => {
        if (data && data.success) setCourses(data.courses || []);
        else setError("Could not load courses.");
      })
      .catch(() => setError("Could not load courses."))
      .finally(() => setLoading(false));
  };

  const loadAvailableCourses = () => {
    setAvailableLoading(true);
    request("GET", "/student/available-courses")
      .then(({ data }) => { if (data && data.success) setAvailableCourses(data.courses || []); })
      .catch(() => {})
      .finally(() => setAvailableLoading(false));
  };

  useEffect(() => { loadCourses(); loadAvailableCourses(); }, [request]);

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(""), 1800);
    } catch (err) {
      setJoinCode(code);
      setJoinError("Code placed in the join box. Select and copy it if needed.");
      const input = document.getElementById("student-course-join-code");
      if (input) { input.focus(); input.select(); }
    }
  };


  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinError(null);
    setJoinSuccess(null);
    try {
      const { data } = await request("POST", "/student/join", { join_code: joinCode.trim() });
      if (data && data.success) {
        setJoinSuccess(data.already_enrolled ? `You are already enrolled in "${data.course.name}".` : `Joined "${data.course.name}" successfully!`);
        setJoinCode("");
        loadCourses();
        loadAvailableCourses();
      } else {
        setJoinError((data && data.message) || "Could not join. Check the code and try again.");
      }
    } catch (err) {
      const msg = err && err.response && err.response.data && err.response.data.message;
      setJoinError(msg || "Invalid join code. Please check and try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (loading) return <Loader label="Loading courses..." />;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #dee2e6", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "1.25rem", fontWeight: 600, color: "#343a40" }}>Student Dashboard</span>
          <Badge variant="secondary" style={{ fontSize: "0.75rem" }}>
            {student && student.name ? student.name : student && student.email}
          </Badge>
        </div>
        <Button variant="outline-secondary" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      <div className="container py-4">
        <div className="mb-4 p-4" style={{ background: "linear-gradient(120deg, #f0edff 0%, #eff8ff 100%)", border: "1px solid #e2ddff", borderRadius: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff", display: "grid", placeItems: "center", fontSize: 22 }}>📚</div>
            <div>
              <h4 className="mb-1" style={{ color: "#30266f", fontWeight: 750 }}>Discover your subjects</h4>
              <p className="mb-0 text-muted" style={{ fontSize: "0.9rem" }}>Find a subject, copy its course code, and join in one click.</p>
            </div>
          </div>
          {availableLoading ? <p className="text-muted mb-0 mt-3">Loading available subjects…</p> : availableCourses.length === 0 ? (
            <div className="mt-3 p-3" style={{ background: "rgba(255,255,255,.8)", borderRadius: 10, color: "#5b6475" }}>
              No subjects are available yet. Your teacher's course will appear here after it is created.
            </div>
          ) : (
            <div className="row mt-2">
              {availableCourses.map((course, index) => {
                const enrolled = courses.some((item) => String(item._id) === String(course._id));
                const colors = [{ bg: "#e9e5ff", fg: "#6741d9" }, { bg: "#dff7ef", fg: "#16866a" }, { bg: "#fff0d9", fg: "#b86b00" }, { bg: "#e2f1ff", fg: "#2475b8" }];
                const color = colors[index % colors.length];
                return <div key={course._id} className="col-sm-6 col-lg-4 mb-3">
                  <Card className="h-100" style={{ border: "1px solid #e8eaf2", borderRadius: 13, boxShadow: "0 4px 16px rgba(39,42,80,.05)" }}>
                    <Card.Body className="d-flex flex-column">
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 12, background: color.bg, color: color.fg, display: "grid", placeItems: "center", fontSize: 19, fontWeight: 700 }}>▤</div>
                        <div style={{ minWidth: 0 }}><Card.Title className="mb-1" style={{ fontSize: "1rem", fontWeight: 700, color: "#20243a", overflowWrap: "anywhere" }}>{course.name}</Card.Title><div className="text-muted" style={{ fontSize: ".78rem" }}>{course.lesson_count} lesson{course.lesson_count === 1 ? "" : "s"} · {course.student_count} student{course.student_count === 1 ? "" : "s"}</div></div>
                      </div>
                      <div style={{ border: "1px dashed #c9c4f2", borderRadius: 9, padding: "10px 11px", background: "#faf9ff", marginBottom: 12 }}>
                        <div style={{ color: "#77718e", fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Course code</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <code style={{ color: "#4d36b4", fontSize: "1.05rem", fontWeight: 800, letterSpacing: 2 }}>{course.join_code}</code>
                          <Button type="button" variant="outline-primary" size="sm" onClick={() => copyCode(course.join_code)}>{copiedCode === course.join_code ? "Copied ✓" : "Copy code"}</Button>
                        </div>
                      </div>
                      <div className="mt-auto">
                        {enrolled ? <Button block variant="success" disabled>Already joined ✓</Button> : <Button block variant="primary" onClick={() => { setJoinCode(course.join_code); setJoinError(null); setJoinSuccess(null); document.getElementById("student-course-join-code")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Join this subject</Button>}
                      </div>
                    </Card.Body>
                  </Card>
                </div>;
              })}
            </div>
          )}
        </div>

        {/* Join a course */}
        <div className="mb-4 p-3" style={{ background: "#fff", border: "1px solid #dee2e6", borderRadius: 8 }}>
          <h6 className="mb-2" style={{ fontWeight: 600 }}>Join a Course</h6>
          <p className="text-muted mb-2" style={{ fontSize: "0.85rem" }}>Choose a subject above, copy its code, or paste a course code here.</p>
          <form onSubmit={handleJoin} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              id="student-course-join-code"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null); setJoinSuccess(null); }}
              placeholder="e.g. AB3X7K"
              maxLength={6}
              style={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", width: 140, padding: "6px 12px", border: "1px solid #ced4da", borderRadius: 4, fontSize: "1rem" }}
            />
            <Button type="submit" variant="primary" size="sm" disabled={joining || !joinCode.trim()}>
              {joining ? "Joining…" : "Join"}
            </Button>
          </form>
          {joinError && <p className="mt-2 mb-0 text-danger" style={{ fontSize: "0.83rem" }}>{joinError}</p>}
          {joinSuccess && <p className="mt-2 mb-0 text-success" style={{ fontSize: "0.83rem" }}>{joinSuccess}</p>}
        </div>

        <h5 className="mb-3" style={{ color: "#495057" }}>My Courses</h5>

        {error && <Alert variant="danger">{error}</Alert>}

        {!error && courses.length === 0 && (
          <div className="text-center py-5">
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📚</div>
            <h5 className="text-muted">No courses yet</h5>
            <p className="text-muted" style={{ maxWidth: 400, margin: "0 auto" }}>
              You are not enrolled in any courses yet. Open a lesson link shared by your teacher to get started — you will be automatically enrolled in that course.
            </p>
          </div>
        )}

        <div className="row">
          {courses.map((course) => (
            <div key={course._id} className="col-sm-6 col-lg-4 mb-4">
              <Card className="h-100 shadow-sm" style={{ borderRadius: 8 }}>
                <Card.Body className="d-flex flex-column">
                  <Card.Title style={{ fontSize: "1rem", fontWeight: 600 }}>{course.name}</Card.Title>
                  <p className="text-muted mb-3" style={{ fontSize: "0.85rem" }}>
                    {course.lessons ? course.lessons.length : 0} lecture{course.lessons && course.lessons.length !== 1 ? "s" : ""}
                  </p>
                  <div className="mt-auto">
                    <Link to={`/student/courses/${course._id}`}>
                      <Button variant="primary" size="sm" block>
                        View Lectures
                      </Button>
                    </Link>
                  </div>
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StudentDashboardInner() {
  const { isLoggedIn, loading, refresh } = useStudentAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  if (!checked || loading) return <Loader />;
  if (!isLoggedIn) return <StudentAuth />;
  return <CourseList />;
}

export default function StudentDashboardPage() {
  return (
    <ProvideStudentAuth>
      <StudentDashboardInner />
    </ProvideStudentAuth>
  );
}
