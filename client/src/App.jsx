import { Component, Suspense, lazy } from "react";
import { Switch, Route, Redirect } from "react-router-dom";

// Route-level code splitting: each page (and the heavy vendors only it uses) loads on demand.
const IndexPage = lazy(() => import("pages/index"));
const LoginPage = lazy(() => import("pages/login"));
const RegisterPage = lazy(() => import("pages/register"));
const LandingPage = lazy(() => import("pages/landing"));
const CourseId = lazy(() => import("pages/courses/_id"));
const LessonId = lazy(() => import("pages/lesson-id"));
const LessonIdDashboard = lazy(() => import("pages/lesson-id-dashboard"));
const NotFoundPage = lazy(() => import("pages/not-found"));
const ForgotPasswordPage = lazy(() => import("pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("pages/reset-password"));
const TermsPage = lazy(() => import("pages/terms"));
const IntroPage = lazy(() => import("pages/intro"));
const DashboardTourPage = lazy(() => import("pages/dashboard-tour"));
const ResearchPage = lazy(() => import("pages/research"));
const TeacherGuidelinesPage = lazy(() => import("pages/teacher-guidelines"));
const ResearcherPage = lazy(() => import("pages/researcher"));
const VideoPage = lazy(() => import("pages/video"));
const StudentDashboardPage = lazy(() => import("pages/student/dashboard"));
const StudentCoursePage = lazy(() => import("pages/student/course"));
const AiTutorPage = lazy(() => import("pages/ai-tutor"));

import Loader from "components/Loader";
import ServerUnreachable from "components/ServerUnreachable";
import { safeRedirectPath } from "handler/api";

import { AuthContext } from "provider/auth";

const routes = [
  { to: "/dashboard", name: "Index", component: IndexPage, exact: true },
  { to: "/", name: "landing", component: LandingPage, exact: true },
  { to: "/research", name: "research", component: ResearchPage, exact: true },
  { to: "/ai-tutor", name: "AI Doubt Solver", component: AiTutorPage, exact: true },
  { to: "/guidelines", name: "guidelines", component: TeacherGuidelinesPage, exact: true },
  { to: "/instructions", name: "Instructions", component: () => <NotFoundPage underConstruction />, exact: true },
  { to: "/c/:course_id", name: "Course", component: CourseId, exact: true },
  { to: "/l/:id/dashboard", name: "Lesson-id-dashboard", component: LessonIdDashboard, exact: true },
  { to: "/l/:id", name: "Lesson-id", component: LessonId, exact: true },
  { to: "/tour", name: "Dashboard tour", component: DashboardTourPage, exact: true },
];

// Paths that need a logged-in teacher; logged-out visitors are sent to /login and brought back afterwards.
const protectedPaths = ["/dashboard", "/instructions", "/c/:course_id", "/l/:id/dashboard", "/tour"];

function getRedirectTarget(location) {
  return safeRedirectPath(location && location.state && location.state.from);
}

class App extends Component {
  static contextType = AuthContext;
  subscribed = true;
  constructor() {
    super();
    this.state = {
      loading: true,
      // true when the first session check failed with a network / server error (not a logout).
      unreachable: false,
    };
  }
  componentDidMount() {
    this.checkSession();
  }
  checkSession = () => {
    const { refresh } = this.context;

    this.setState({ loading: true, unreachable: false });
    refresh()
      .then(() => {
        if (this.subscribed) this.setState({ unreachable: false });
      })
      .catch((error) => {
        console.log(error);
        if (this.subscribed) this.setState({ unreachable: true });
      })
      .finally(() => {
        if (this.subscribed) this.setState({ loading: false });
      });
  };
  componentWillUnmount() {
    this.subscribed = false;
  }
  render() {
    const { user } = this.context;
    if (this.state.loading) return <Loader />;
    return <Suspense fallback={<Loader />}>{user ? this.renderUserRoutes() : this.renderGuestRoutes()}</Suspense>;
  }
  renderGuestRoutes() {
    return (
      <Switch>
        <Route key="landing" path="/" component={LoginPage} exact />
        <Route key="login" path="/login" component={LoginPage} exact />
        <Route key="register" path="/register" component={RegisterPage} exact />
        <Route key="forgot-password" path="/password/forgot" component={ForgotPasswordPage} exact />
        <Route key="reset-password" path="/password/reset" component={ResetPasswordPage} exact />
        <Route key="lesson-id" path="/l/:id" component={LessonId} exact />
        <Route key="student-dashboard" path="/student" component={StudentDashboardPage} exact />
        <Route key="student-course" path="/student/courses/:id" component={StudentCoursePage} exact />
        <Route key="research" path="/research" component={ResearchPage} exact />
        <Route key="ai-tutor" path="/ai-tutor" component={AiTutorPage} exact />
        <Route key="guidelines" path="/guidelines" component={TeacherGuidelinesPage} exact />
        <Route key="introduction" path="/introduction" component={VideoPage} exact />
        <Route key="terms" path="/terms" component={TermsPage} />
        <Route key="intro" path="/intro" component={IntroPage} />
        <Route key="researcher" path="/researcher" component={ResearcherPage} />
        <Route
          key="protected"
          path={protectedPaths}
          exact
          render={({ location }) =>
            // We couldn't tell whether the user is logged in; offer a retry instead of the login page.
            this.state.unreachable ? (
              <ServerUnreachable onRetry={this.checkSession} />
            ) : (
              <Redirect to={{ pathname: "/login", state: { from: location.pathname + location.search } }} />
            )
          }
        />
        <Route key="default" component={NotFoundPage} />
      </Switch>
    );
  }
  renderUserRoutes() {
    return (
      <Switch>
        {routes.map((route, key) => (
          <Route key={key} path={route.to} component={route.component} exact={route.exact} />
        ))}
        <Redirect path="/password/forgot" to="/login" />
        <Redirect path="/password/reset" to="/login" />
        <Route path="/register" render={({ location }) => <Redirect to={getRedirectTarget(location)} />} />
        <Route path="/login" render={({ location }) => <Redirect to={getRedirectTarget(location)} />} />
        <Route key="terms" path="/terms" component={TermsPage} />
        <Route key="intro" path="/intro" component={IntroPage} />
        <Route key="introduction" path="/introduction" component={VideoPage} exact />
        <Route key="student-dashboard" path="/student" component={StudentDashboardPage} exact />
        <Route key="student-course" path="/student/courses/:id" component={StudentCoursePage} exact />
        <Route key="researcher" path="/researcher" component={ResearcherPage} />
        <Route key="default" component={NotFoundPage} />
      </Switch>
    );
  }
}

export default App;
