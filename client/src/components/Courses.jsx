import React, { useState, useEffect, useRef } from "react";
import { Spinner, Alert } from "react-bootstrap";
import { useHistory } from "react-router-dom";
import { useAuth } from "provider/auth";
import Loader from "./Loader";
import { getErrorMessage } from "handler/api";

function Courses() {
  const { request } = useAuth();
  const history = useHistory();
  const subscribed = useRef(true);

  const [newCourse, setNewCourse] = useState("");
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    subscribed.current = true;
    return () => { subscribed.current = false; };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    request("GET", "/courses")
      .then(({ data }) => {
        if (!subscribed.current) return;
        if (data && data.success) setCourses(Array.isArray(data.courses) ? data.courses : []);
        else setError("Couldn't load your courses, please refresh.");
      })
      .catch((err) => { if (subscribed.current) setError(getErrorMessage(err, "Couldn't load courses.")); })
      .finally(() => { if (subscribed.current) setLoading(false); });
  }, [request]);

  const createCourse = (e) => {
    e && e.preventDefault();
    const name = newCourse.trim();
    if (!name) { setError("Please enter a course name."); return; }
    if (creating) return;
    setError(null);
    setCreating(true);
    request("POST", "/courses/", { name })
      .then(({ data }) => {
        const id = data && data.success && data.course && data.course._id;
        if (id) history.push("/c/" + id);
        else if (subscribed.current) setError((data && data.message) || "Couldn't create course, try again.");
      })
      .catch((err) => { if (subscribed.current) setError(getErrorMessage(err, "Couldn't create course.")); })
      .finally(() => { if (subscribed.current) setCreating(false); });
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <Loader />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", display: "flex", alignItems: "center", padding: "40px 16px" }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-9 col-lg-7 col-xl-6">

            {/* Heading */}
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>My Courses</h2>
              <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: 0 }}>
                Select an existing course or create a new one to get started.
              </p>
            </div>

            {error && (
              <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-4">
                {error}
              </Alert>
            )}

            {/* Existing courses */}
            {courses.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>
                    Your courses
                  </span>
                  <span style={{ marginLeft: 8, background: "#ede9fe", color: "#7c3aed", borderRadius: 12, padding: "1px 8px", fontSize: "0.75rem", fontWeight: 600 }}>
                    {courses.length}
                  </span>
                </div>
                <div style={{ padding: "8px 12px" }}>
                  {courses.map((c, k) => (
                    <button
                      key={c._id || k}
                      onClick={() => history.push("/c/" + c._id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 10px",
                        background: "transparent",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f5f3ff"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ width: 36, height: 36, background: "#ede9fe", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <i className="fas fa-book" style={{ color: "#7c3aed", fontSize: "0.9rem" }} />
                      </div>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{ fontWeight: 600, color: "#111827", fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.name}
                        </div>
                        {c.lessons !== undefined && (
                          <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 1 }}>
                            {c.lessons.length} lesson{c.lessons.length !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                      <i className="fas fa-chevron-right" style={{ color: "#d1d5db", fontSize: "0.75rem", flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create new course */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
                <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#374151" }}>Create a new course</span>
              </div>
              <div style={{ padding: "20px" }}>
                <form onSubmit={createCourse}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Course name
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      type="text"
                      value={newCourse}
                      onChange={e => setNewCourse(e.target.value)}
                      placeholder="e.g. Introduction to Physics"
                      style={{
                        flex: 1, border: "1px solid #d1d5db", borderRadius: 8,
                        padding: "9px 13px", fontSize: "0.9rem", outline: "none", color: "#111827",
                      }}
                      onFocus={e => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.1)"; }}
                      onBlur={e => { e.target.style.borderColor = "#d1d5db"; e.target.style.boxShadow = "none"; }}
                    />
                    <button
                      type="submit"
                      disabled={creating}
                      style={{
                        background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8,
                        padding: "9px 20px", fontWeight: 600, fontSize: "0.88rem",
                        cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1,
                        display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                      }}
                    >
                      {creating ? <Spinner animation="border" size="sm" /> : "Create"}
                    </button>
                  </div>
                </form>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default Courses;
