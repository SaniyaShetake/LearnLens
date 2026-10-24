import React, { useState, useRef, useEffect } from "react";
import { Form, InputGroup, Button, Spinner, Alert } from "react-bootstrap";
import { Link, useHistory, useLocation } from "react-router-dom";
import { Formik, useFormik } from "formik";
import * as Yup from "yup";

import { useAuth } from "provider/auth";
import { ProvideStudentAuth, useStudentAuth } from "provider/student-auth";
import { safeRedirectPath } from "handler/api";
import Loader from "components/Loader";
import api, { getErrorMessage } from "handler/api";

// ─── shared helpers ────────────────────────────────────────────────────────────

function ShowHideInput({ name, value, onChange, onBlur, isInvalid, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <InputGroup className="input-group-password">
      <Form.Control
        isInvalid={isInvalid}
        type={show ? "text" : "password"}
        name={name}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
      />
      <InputGroup.Append>
        <InputGroup.Text as="div" className="toggle-show-password" style={{ cursor: "pointer" }} onClick={() => setShow((s) => !s)}>
          {show ? "Hide" : "Show"}
        </InputGroup.Text>
      </InputGroup.Append>
    </InputGroup>
  );
}

// ─── Teacher – Login ───────────────────────────────────────────────────────────

const teacherLoginSchema = Yup.object({
  email: Yup.string().email("Email address is invalid").required("Email address is required"),
  password: Yup.string().required("Password is required"),
  rememberMe: Yup.boolean(),
});

function TeacherLogin({ onSwitchToRegister }) {
  const subscribed = useRef(true);
  const { login } = useAuth();
  const history = useHistory();
  const location = useLocation();

  useEffect(() => { subscribed.current = true; return () => { subscribed.current = false; }; }, []);

  const handleSubmit = async (values, { setStatus }) => {
    setStatus({ error: null });
    try {
      const [error] = await login(values.email, values.password, values.rememberMe);
      if (!subscribed.current) return;
      if (error) setStatus({ error });
      else history.push(safeRedirectPath(location.state && location.state.from));
    } catch {
      if (subscribed.current) setStatus({ error: "Something went wrong, try again." });
    }
  };

  return (
    <Formik initialValues={{ email: "", password: "", rememberMe: false }} validationSchema={teacherLoginSchema} onSubmit={handleSubmit}>
      {({ values, touched, errors, handleBlur, handleChange, handleSubmit: submit, status, isSubmitting }) => (
        <Form onSubmit={(e) => { e.preventDefault(); submit(); }} className="login-form">
          <Form.Group controlId="tl-email">
            <Form.Label>Email</Form.Label>
            <Form.Control isInvalid={touched.email && errors.email} type="email" name="email" autoComplete="email" placeholder="Enter email" value={values.email} onBlur={handleBlur} onChange={handleChange} />
            {touched.email && errors.email && <Form.Text className="text-danger">{errors.email}</Form.Text>}
          </Form.Group>
          <Form.Group controlId="tl-password">
            <Form.Label>Password</Form.Label>
            <ShowHideInput name="password" value={values.password} onChange={handleChange} onBlur={handleBlur} isInvalid={touched.password && errors.password} autoComplete="current-password" placeholder="Password" />
            {touched.password && errors.password && <Form.Text className="text-danger">{errors.password}</Form.Text>}
          </Form.Group>
          <Form.Group controlId="tl-remember">
            <Form.Check custom type="checkbox" name="rememberMe" label="Remember me" checked={values.rememberMe} onChange={handleChange} />
          </Form.Group>
          {status && status.error && <Alert variant="danger" className="text-center">{status.error}</Alert>}
          <div className="text-center">
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? <Spinner animation="border" size="sm" /> : "Login"}
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}

// ─── Teacher – Register ────────────────────────────────────────────────────────

const teacherRegisterSchema = Yup.object({
  fullname: Yup.string().required("Full name is required"),
  email: Yup.string().email("Invalid email").required("Email is required"),
  password: Yup.string().min(8, "At least 8 characters").max(32, "At most 32 characters").required("Password is required"),
  organization: Yup.string().optional(),
});

function TeacherRegister({ onSwitchToLogin }) {
  const { register, loading } = useAuth();
  const history = useHistory();

  const formik = useFormik({
    initialValues: { fullname: "", email: "", password: "", organization: "" },
    validationSchema: teacherRegisterSchema,
    validateOnBlur: true,
    onSubmit: (values, { setFieldError, setStatus }) => {
      setStatus(null);
      return register({ ...values, mode: "online", feature_level: "basic", contact_for_research: "no" })
        .then((ok) => { if (!ok) setStatus({ error: "Registration failed, please try again." }); })
        .catch((err) => {
          const message = (err && err.message) || "";
          if (err && (err.status === 409 || /exist/i.test(message))) setFieldError("email", "Account already exists.");
          else setStatus({ error: message || "Registration failed, please try again." });
        });
    },
  });

  useEffect(() => { if (formik.values && loading === false) { /* handled by auth context redirect */ } }, [loading]);

  return (
    <Form className="login-form" onSubmit={(e) => { e.preventDefault(); formik.handleSubmit(); }}>
      <Form.Group controlId="tr-name">
        <Form.Label>Full name <span className="text-danger">*</span></Form.Label>
        <Form.Control type="text" name="fullname" isInvalid={formik.touched.fullname && formik.errors.fullname} placeholder="Enter your full name" value={formik.values.fullname} onChange={formik.handleChange} onBlur={formik.handleBlur} />
        {formik.touched.fullname && formik.errors.fullname && <Form.Text className="text-danger">{formik.errors.fullname}</Form.Text>}
      </Form.Group>
      <Form.Group controlId="tr-email">
        <Form.Label>Email <span className="text-danger">*</span></Form.Label>
        <Form.Control type="email" name="email" autoComplete="email" isInvalid={formik.touched.email && formik.errors.email} placeholder="Enter email" value={formik.values.email} onChange={formik.handleChange} onBlur={formik.handleBlur} />
        {formik.touched.email && formik.errors.email && <Form.Text className="text-danger">{formik.errors.email}</Form.Text>}
      </Form.Group>
      <Form.Group controlId="tr-password">
        <Form.Label>Password <span className="text-danger">*</span></Form.Label>
        <ShowHideInput name="password" value={formik.values.password} onChange={formik.handleChange} onBlur={formik.handleBlur} isInvalid={formik.touched.password && formik.errors.password} autoComplete="new-password" placeholder="Min 8 characters" />
        {formik.touched.password && formik.errors.password && <Form.Text className="text-danger">{formik.errors.password}</Form.Text>}
      </Form.Group>
      <Form.Group controlId="tr-org">
        <Form.Label>Organization <span className="text-muted" style={{ fontSize: "0.8rem" }}>(optional)</span></Form.Label>
        <Form.Control type="text" name="organization" placeholder="Your institution or university" value={formik.values.organization} onChange={formik.handleChange} />
      </Form.Group>
      {formik.status && formik.status.error && <Alert variant="danger">{formik.status.error}</Alert>}
      <div className="text-center pt-2">
        <Button type="submit" variant="primary" disabled={formik.isSubmitting || loading}>
          {formik.isSubmitting || loading ? <Spinner animation="border" size="sm" /> : "Register"}
        </Button>
        <div className="mt-2" style={{ fontSize: ".85rem" }}>
          By signing up, you agree to our <Link to="/terms">terms</Link>.
        </div>
      </div>
    </Form>
  );
}

// ─── Student – Login ───────────────────────────────────────────────────────────

const studentLoginSchema = Yup.object({
  email: Yup.string().email("Email address is invalid").required("Email address is required"),
  password: Yup.string().required("Password is required"),
  rememberMe: Yup.boolean(),
});

function StudentLogin({ onSwitchToRegister }) {
  const subscribed = useRef(true);
  const { login, isLoggedIn, loading } = useStudentAuth();
  const history = useHistory();

  useEffect(() => { subscribed.current = true; return () => { subscribed.current = false; }; }, []);
  useEffect(() => { if (isLoggedIn) history.push("/student"); }, [isLoggedIn, history]);

  const handleSubmit = async (values, { setStatus }) => {
    setStatus({ error: null });
    try {
      const [error] = await login(values.email, values.password, values.rememberMe);
      if (!subscribed.current) return;
      if (error) setStatus({ error });
    } catch {
      if (subscribed.current) setStatus({ error: "Something went wrong, try again." });
    }
  };

  if (loading) return <Loader label="Verifying..." />;

  return (
    <Formik initialValues={{ email: "", password: "", rememberMe: false }} validationSchema={studentLoginSchema} onSubmit={handleSubmit}>
      {({ values, touched, errors, handleBlur, handleChange, handleSubmit: submit, status, isSubmitting }) => (
        <Form onSubmit={(e) => { e.preventDefault(); submit(); }} className="login-form">
          <Form.Group controlId="sl-email">
            <Form.Label>Email</Form.Label>
            <Form.Control isInvalid={touched.email && errors.email} type="email" name="email" autoComplete="email" placeholder="Enter email" value={values.email} onBlur={handleBlur} onChange={handleChange} />
            {touched.email && errors.email && <Form.Text className="text-danger">{errors.email}</Form.Text>}
          </Form.Group>
          <Form.Group controlId="sl-password">
            <Form.Label>Password</Form.Label>
            <ShowHideInput name="password" value={values.password} onChange={handleChange} onBlur={handleBlur} isInvalid={touched.password && errors.password} autoComplete="current-password" placeholder="Password" />
            {touched.password && errors.password && <Form.Text className="text-danger">{errors.password}</Form.Text>}
          </Form.Group>
          <Form.Group controlId="sl-remember">
            <Form.Check custom type="checkbox" name="rememberMe" label="Remember me" checked={values.rememberMe} onChange={handleChange} />
          </Form.Group>
          {status && status.error && <Alert variant="danger" className="text-center">{status.error}</Alert>}
          <div className="text-center">
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? <Spinner animation="border" size="sm" /> : "Login"}
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}

// ─── Student – Register ────────────────────────────────────────────────────────

const studentRegisterSchema = Yup.object({
  name: Yup.string().required("Full name is required"),
  email: Yup.string().email("Invalid email").required("Email is required"),
  password: Yup.string().min(8, "At least 8 characters").max(32, "At most 32 characters").required("Password is required"),
  confirm_password: Yup.string().required("Please confirm your password"),
});

function StudentRegister({ onSwitchToLogin }) {
  const { register, loading, isLoggedIn } = useStudentAuth();
  const history = useHistory();

  useEffect(() => { if (isLoggedIn) history.push("/student"); }, [isLoggedIn, history]);

  const formik = useFormik({
    initialValues: { name: "", email: "", password: "", confirm_password: "" },
    validationSchema: studentRegisterSchema,
    validateOnBlur: true,
    onSubmit: (values, { setFieldError, setStatus }) => {
      setStatus(null);
      if (values.password !== values.confirm_password) { setFieldError("confirm_password", "Passwords don't match"); return; }
      return register({ name: values.name, email: values.email, password: values.password })
        .then((ok) => { if (!ok) setStatus({ error: "Registration failed, please try again." }); })
        .catch((err) => {
          const message = (err && err.message) || "";
          if (err && (err.status === 409 || /exist/i.test(message))) setFieldError("email", "Account already exists.");
          else setStatus({ error: message || "Registration failed, please try again." });
        });
    },
  });

  if (loading) return <Loader label="Verifying..." />;

  return (
    <Form className="login-form" onSubmit={(e) => { e.preventDefault(); formik.handleSubmit(); }}>
      <Form.Group controlId="sr-name">
        <Form.Label>Full name <span className="text-danger">*</span></Form.Label>
        <Form.Control type="text" name="name" isInvalid={formik.touched.name && formik.errors.name} placeholder="Enter your full name" value={formik.values.name} onChange={formik.handleChange} onBlur={formik.handleBlur} />
        {formik.touched.name && formik.errors.name && <Form.Text className="text-danger">{formik.errors.name}</Form.Text>}
      </Form.Group>
      <Form.Group controlId="sr-email">
        <Form.Label>Email <span className="text-danger">*</span></Form.Label>
        <Form.Control type="email" name="email" autoComplete="email" isInvalid={formik.touched.email && formik.errors.email} placeholder="Enter email" value={formik.values.email} onChange={formik.handleChange} onBlur={formik.handleBlur} />
        {formik.touched.email && formik.errors.email && <Form.Text className="text-danger">{formik.errors.email}</Form.Text>}
      </Form.Group>
      <Form.Group controlId="sr-password">
        <Form.Label>Password <span className="text-danger">*</span></Form.Label>
        <ShowHideInput name="password" value={formik.values.password} onChange={formik.handleChange} onBlur={formik.handleBlur} isInvalid={formik.touched.password && formik.errors.password} autoComplete="new-password" placeholder="Min 8 characters" />
        {formik.touched.password && formik.errors.password && <Form.Text className="text-danger">{formik.errors.password}</Form.Text>}
      </Form.Group>
      <Form.Group controlId="sr-confirm">
        <Form.Label>Confirm password <span className="text-danger">*</span></Form.Label>
        <ShowHideInput name="confirm_password" value={formik.values.confirm_password} onChange={formik.handleChange} onBlur={formik.handleBlur} isInvalid={formik.touched.confirm_password && formik.errors.confirm_password} autoComplete="new-password" placeholder="Repeat password" />
        {formik.touched.confirm_password && formik.errors.confirm_password && <Form.Text className="text-danger">{formik.errors.confirm_password}</Form.Text>}
      </Form.Group>
      {formik.status && formik.status.error && <Alert variant="danger">{formik.status.error}</Alert>}
      <div className="text-center pt-2">
        <Button type="submit" variant="primary" disabled={formik.isSubmitting || loading}>
          {formik.isSubmitting || loading ? <Spinner animation="border" size="sm" /> : "Register"}
        </Button>
        <div className="mt-2" style={{ fontSize: ".85rem" }}>
          By signing up, you agree to our <Link to="/terms">terms</Link>.
        </div>
      </div>
    </Form>
  );
}

// ─── Student tab wrapper (needs ProvideStudentAuth) ────────────────────────────

function StudentTab({ mode }) {
  return (
    <ProvideStudentAuth>
      {mode === "login"
        ? <StudentLogin onSwitchToRegister={null} />
        : <StudentRegister onSwitchToLogin={null} />}
    </ProvideStudentAuth>
  );
}

// ─── Teacher tab ───────────────────────────────────────────────────────────────

function TeacherTab({ mode }) {
  return mode === "login"
    ? <TeacherLogin onSwitchToRegister={null} />
    : <TeacherRegister onSwitchToLogin={null} />;
}

// ─── Unified page ──────────────────────────────────────────────────────────────

function UnifiedAuth({ mode = "login" }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialTab = params.get("tab") === "student" ? "student" : "teacher";
  const [tab, setTab] = useState(initialTab);
  const isLogin = mode === "login";
  const heading = isLogin ? "Welcome back" : "Create your account";
  const switchText = isLogin ? "New to LearnLens?" : "Already have an account?";
  const switchLabel = isLogin ? "Create account" : "Sign in";
  const switchPath = isLogin ? "/register" : "/login";

  return (
    <main className="ll-auth-shell">
      <section className="ll-auth-story">
        <div className="ll-brand-lockup">
          <span className="ll-brand-mark"><i className="fas fa-lightbulb" /></span>
          <span>LearnLens</span>
        </div>
        <div className="ll-story-content">
          <div className="ll-eyebrow"><span /> GROUP G46 · LEARNING ANALYTICS</div>
          <h1>Make every<br /><em>lesson count.</em></h1>
          <p className="ll-story-copy">A smarter way to understand learning, explore student feedback, and turn classroom insights into better teaching.</p>
          <div className="ll-feature-list">
            <div className="ll-feature"><span className="ll-feature-icon ll-icon-violet"><i className="fas fa-chart-line" /></span><div><strong>Meaningful insights</strong><small>Understand engagement and learning patterns.</small></div></div>
            <div className="ll-feature"><span className="ll-feature-icon ll-icon-orange"><i className="fas fa-play-circle" /></span><div><strong>Video-based learning</strong><small>Explore feedback at the right moment.</small></div></div>
            <div className="ll-feature"><span className="ll-feature-icon ll-icon-green"><i className="fas fa-users" /></span><div><strong>Built for classrooms</strong><small>Bring teacher and student experiences together.</small></div></div>
          </div>
        </div>
        <div className="ll-story-bottom">INTELLIGENT LEARNING ANALYTICS PLATFORM</div>
        <span className="ll-orb ll-orb-one" /><span className="ll-orb ll-orb-two" />
      </section>

      <section className="ll-auth-panel">
        <div className="ll-mobile-brand"><span className="ll-brand-mark"><i className="fas fa-lightbulb" /></span><strong>LearnLens</strong></div>
        <div className="ll-auth-card">
          <div className="ll-auth-kicker">YOUR LEARNING SPACE</div>
          <h2>{heading}</h2>
          <p className="ll-auth-subtitle">{isLogin ? "Sign in to continue to your dashboard." : "Join LearnLens and get started in a few steps."}</p>
          <div className="ll-role-switch" role="tablist" aria-label="Choose account type">
            {[{ key: "teacher", label: "Teacher", icon: "fa-chalkboard-teacher" }, { key: "student", label: "Student", icon: "fa-user-graduate" }].map(({ key, label, icon }) => (
              <button type="button" key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
                <i className={`fas ${icon}`} /> {label}
              </button>
            ))}
          </div>
          {tab === "teacher" ? <TeacherTab mode={mode} /> : <StudentTab mode={mode} />}
          <div className="ll-auth-switch">{switchText} <Link to={switchPath}>{switchLabel} <i className="fas fa-arrow-right" /></Link></div>
          <div className="ll-auth-security"><i className="fas fa-shield-alt" /> Your learning workspace, all in one place.</div>
        </div>
        <div className="ll-auth-footer">LEARN BETTER · TEACH SMARTER</div>
      </section>
    </main>
  );
}

function LoginPage() {
  const { user } = useAuth();
  const history = useHistory();

  useEffect(() => { if (user) history.push("/dashboard"); }, [user, history]);

  if (user) return <Loader />;

  return <UnifiedAuth mode="login" />;
}

export function RegisterPage() {
  const { user } = useAuth();
  const history = useHistory();

  useEffect(() => { if (user) history.push("/dashboard"); }, [user, history]);

  if (user) return <Loader />;

  return <UnifiedAuth mode="register" />;
}

export default LoginPage;
