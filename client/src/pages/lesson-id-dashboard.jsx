import React, { useState, useEffect, useRef } from "react";
import { Link, Redirect, useHistory, useParams } from "react-router-dom";
import Layout from "components/Layout";
import { useAuth } from "provider/auth";
import Loader from "components/Loader";
import useFeedback, { FeedbackProvider } from "provider/feedback";
import "../assets/styles/teacher-dashboard.scss";
import "../assets/styles/teacher-dashboard-theme.scss";

import AdvancedDashboard from "components/Dashboard/Advanced";
import Tour from "components/Tour";
import { Alert } from "react-bootstrap";
import { getErrorMessage } from "handler/api";

function LessonIdDashboard() {
  const { user, request } = useAuth();
  const {
    lesson,
    setLesson,
    setHeaderName,
    setData,
    range,
    setRange,
    // refreshing,
    setRefreshing,
    act,
    setActivated,
  } = useFeedback();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [rangeError, setRangeError] = useState(null);
  const subs = useRef(true);
  const mounted = useRef(false);
  const history = useHistory();

  useEffect(() => {
    subs.current = true;

    return () => {
      subs.current = false;
    };
  }, []);

  useEffect(() => {
    if (user && user.tour && user.tour.dashboard === 0) {
      history.push(`/tour?backto=${id}`);
    }
  }, [history, user, id]);

  useEffect(() => {
    const fetchData = () => {
      setLoading(true);
      setError(null);
      setNotFound(false);

      request("GET", `/lessons/${id}/feedback?min=0`)
        .then(({ data }) => {
          if (data && data.success) {
            if (subs.current) {
              if (data.lesson) {
                setLesson(data.lesson);
                setHeaderName(data.lesson.name);

                if (data.lesson.current_bookmark) {
                  const { time_from, time_to } = data.lesson.current_bookmark;
                  setRange([time_from, time_to]);
                } else {
                  setRange([0, data.lesson.minutes]);
                }
              }
              setData(data.feedback);
              setLoading(false);
            }
          }
        })
        .catch((err) => {
          console.log(err);
          const status = err && err.response && err.response.status;
          if (!subs.current) return;
          // 404 (missing / not owned) and 400 (malformed id) are rendered as "Lesson not found".
          if (status === 404 || status === 400) setNotFound(true);
          else setError(getErrorMessage(err, "Couldn't load the lesson dashboard, please refresh the page."));
        })
        .finally(() => {
          if (subs.current) {
            setLoading(false);
          }
          mounted.current = true;
        });
    };

    fetchData();

    return () => {
      mounted.current = false;
    };
  }, [id, request, setData, setHeaderName, setLesson, setRange]);

  useEffect(() => {
    const fetchDataWithRange = (_range) => {
      setRefreshing(true);
      setRangeError(null);
      request(
        "GET",
        `/lessons/${id}/feedback?min=${_range[0] || 0}&max=${_range[1] || 0}`
      )
        .then(({ data }) => {
          if (data && data.success) {
            if (subs.current) {
              setLesson(data.lesson);
              setData(data.feedback);
              if (act) setActivated(act);
            }
          } else if (subs.current) {
            setRangeError("Couldn't update the feedback for the selected range.");
          }
        })
        .catch((err) => {
          console.log(err);
          if (subs.current) setRangeError(getErrorMessage(err, "Couldn't update the feedback for the selected range."));
        })
        .finally(() => {
          if (subs.current) {
            setRefreshing(false);
          }
        });
    };

    if (mounted.current) fetchDataWithRange(range);
  }, [
    range,
    setRange,
    act,
    id,
    request,
    setActivated,
    setData,
    setLesson,
    setRefreshing,
  ]);
  // if (refreshing) return <Loader label="Refreshing" />;
  if (loading) return <Loader />;
  if (!user) return <Redirect to="/login" />;
  if (notFound) return <LessonNotFound />;
  if (lesson) {
    return (
      <>
        <div style={{ padding: "4px 20px", borderBottom: "1px solid #dee2e6", backgroundColor: "#fff", fontSize: "0.82rem" }}>
          <Link
            to={lesson.course ? `/c/${lesson.course}` : "/dashboard"}
            style={{ color: "#6c757d", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: "0.82rem" }}
          >
            <i className="fas fa-arrow-left" style={{ fontSize: "0.75rem" }} /> Back to Course
          </Link>
        </div>
        {rangeError && (
          <Alert variant="danger" className="m-2" dismissible onClose={() => setRangeError(null)}>
            {rangeError}
          </Alert>
        )}
        <AdvancedDashboard
          research={user.feature_level === "advanced-research"}
          locked={user.feature_level === "basic"}
        />
      </>
    );
  }

  if (error)
    return (
      <div className="container py-5">
        <Alert variant="danger" className="text-center">
          {error}
        </Alert>
      </div>
    );

  return <LessonNotFound />;
}

function LessonNotFound() {
  return (
    <div className="container py-5 text-center">
      <h4 className="mb-2">Lesson not found</h4>
      <p className="text-muted mb-4">This lesson doesn't exist, or it isn't one of yours.</p>
      <Link to="/dashboard" className="btn btn-primary">
        <i className="fas fa-long-arrow-alt-left mr-1" /> Back to dashboard
      </Link>
    </div>
  );
}

function LessonIdDashboardPage() {
  return (
    <FeedbackProvider>
      <Layout
        headerProps={{ hasTour: true }}
        minifiedNav
        pageName={
          <>
            <span>Teacher Dashboard </span>
          </>
        }
      >
        <Tour />
        <LessonIdDashboard />
      </Layout>
    </FeedbackProvider>
  );
}

export default LessonIdDashboardPage;
