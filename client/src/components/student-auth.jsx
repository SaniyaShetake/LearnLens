import React, { useState, useRef, useEffect } from "react";
import { Form, InputGroup, Button, Spinner, Alert } from "react-bootstrap";
import { Link, useHistory } from "react-router-dom";

import { Formik, useFormik } from "formik";
import * as Yup from "yup";
import { useStudentAuth } from "provider/student-auth";

import PhoneNumberInput, { isPossiblePhoneNumber } from "react-phone-number-input";

import Loader from "./Loader";
import api, { getErrorMessage } from "handler/api";

import "react-phone-number-input/style.css";

const defaultForm = { email: "", password: "", rememberMe: false };

const loginValidationSchema = Yup.object({
  email: Yup.string().email("Email address is invalid").required("Email address is required"),
  password: Yup.string().required("Password is required"),
  rememberMe: Yup.boolean(),
});

function StudentLoginForm({ onClickRegister, onClickForget }) {
  const subscribed = useRef(true);

  const { login, loading } = useStudentAuth();

  useEffect(() => {
    subscribed.current = true;
    return () => (subscribed.current = false);
  }, []);

  const [showPassword, setShowPassword] = useState(false);

  const handleToggleViewPassword = (e) => {
    setShowPassword((sp) => !sp);
  };

  const handleOnSubmit = async (values, { setStatus }) => {
    setStatus({ loginForm: null });
    try {
      const [error] = await login(values.email, values.password, values.rememberMe);

      if (subscribed.current) {
        console.log({ error });

        if (error) setStatus({ loginForm: error });
        else {
          // Logged in
        }
      }
    } catch (error) {
      if (subscribed.current) {
        setStatus({ loginForm: "Some error occured, try again" });
      }
    }
  };

  return (
    <Formik initialValues={defaultForm} validationSchema={loginValidationSchema} onSubmit={handleOnSubmit}>
      {({ values, touched, errors, handleBlur, handleChange, handleSubmit, status, isSubmitting }) => (
        <>
          {(loading || isSubmitting) && <Loader label="Verifying student auth" />}

          <Form
            style={{ display: loading ? "none" : undefined }}
            className="login-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <h4>Login as student</h4>
            <hr />
            <Form.Group controlId="login-email">
              <Form.Label>Email</Form.Label>
              <Form.Control isInvalid={touched.email && errors.email} type="email" name="email" autoComplete="email" placeholder="Enter email" value={values.email} onBlur={handleBlur} onChange={handleChange} />
              {touched.email && errors.email ? <Form.Text className="text-danger">{errors.email}</Form.Text> : null}
            </Form.Group>
            <Form.Group controlId="login-password">
              <Form.Label>Password</Form.Label>
              <InputGroup className="input-group-password">
                <Form.Control
                  isInvalid={touched.password && errors.password}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                />
                <InputGroup.Append>
                  <InputGroup.Text as="div" className="toggle-show-password" id="show-password" onClick={handleToggleViewPassword}>
                    {showPassword ? "Hide" : "Show"}
                  </InputGroup.Text>
                </InputGroup.Append>
              </InputGroup>
              {touched.password && errors.password ? <Form.Text className="text-danger">{errors.password}</Form.Text> : null}
            </Form.Group>
            <Form.Group controlId="login-rememberme">
              <Form.Check custom type="checkbox" name="rememberMe" label="Remember me" value={values.rememberMe} onChange={handleChange} onBlur={handleBlur} />
            </Form.Group>

            {status && status.loginForm && (
              <Alert variant="danger" className="text-center">
                {status.loginForm}
              </Alert>
            )}

            <div className="text-center">
              {isSubmitting ? (
                <Button onClick={(e) => e.preventDefault()} variant="primary">
                  <Spinner animation="border" role="status" size="sm">
                    <span className="sr-only">Loading...</span>
                  </Spinner>
                </Button>
              ) : (
                <Button type="submit" variant="primary">
                  Login
                </Button>
              )}
              <div className="mt-2" style={{ fontSize: ".9rem" }} id="forgot-password">
                <a href="#forgot-password" onClick={onClickForget}>
                  Forgot password?
                </a>
              </div>
              <hr />
              <div className="mt-3" id="register-btn">
                <span>Don't have a student account? </span>
                <a href="#register-btn" onClick={onClickRegister}>
                  Register
                </a>
              </div>
            </div>
          </Form>
        </>
      )}
    </Formik>
  );
}

const defaultRegistrationForm = {
  name: "",
  email: "",
  password: "",
  confirm_password: "",
  phone: "",
};

const registerValidationSchema = Yup.object({
  name: Yup.string().required("Fullname is required"),
  email: Yup.string().email("Email address is invalid").required("Email address is required"),
  password: Yup.string().min(8, "Password must be at least 8 characters").max(32, "Password must be at most 32 characters").required("Password is required"),
  confirm_password: Yup.string().required("Confirm password is required"),
  phone: Yup.string().optional(),
});

const Asterisk = () => <span className="text-danger"> *</span>;

function StudentRegisterForm({ onClickLogin }) {
  const { user, loading, register } = useStudentAuth();
  const history = useHistory();

  const formik = useFormik({
    initialValues: defaultRegistrationForm,
    validationSchema: registerValidationSchema,
    onSubmit: (values, { setFieldError, setStatus }) => {
      setStatus(null);
      if (values.password === values.confirm_password) {
        return register({ ...values })
          .then((ok) => {
            if (!ok) setStatus({ registerForm: "Registration failed, please try again." });
          })
          .catch((err) => {
            const message = (err && err.message) || "";
            if (err && (err.status === 401 || err.status === 409 || /exist/i.test(message))) {
              setFieldError("email", "Account already exists, please use a different email.");
            } else {
              setStatus({ registerForm: message || "Registration failed, please try again." });
            }
          });
      } else {
        setFieldError("confirm_password", "Passwords don't match");
      }
    },
    validateOnBlur: true,
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleToggleViewPassword = (e) => {
    setShowPassword((sp) => !sp);
  };

  const handleMobileNumberChange = (value) => {
    formik.setFieldValue("phone", value);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    formik.handleSubmit(e);
  };

  useEffect(() => {
    if (user) {
      history.push("/dashboard");
    }
  }, [history, user]);

  return (
    <>
      {(user || loading || formik.isSubmitting) && <Loader label="Verifying credentials" />}
      <Form style={{ display: user || loading ? "none" : undefined }} className="login-form" onSubmit={handleFormSubmit} onReset={formik.handleReset}>
        <h4>Register as student</h4>
        <hr />
        <Form.Group controlId="name">
          <Form.Label>
            Name
            <Asterisk />
          </Form.Label>
          <Form.Control type="text" isInvalid={formik.touched.name && formik.errors.name} name="name" placeholder="Enter your full name" value={formik.values.name} onChange={formik.handleChange} />
          {formik.touched.name && formik.errors.name ? <Form.Text className="text-danger">{formik.errors.name}</Form.Text> : null}
        </Form.Group>

        <Form.Group controlId="register-email">
          <Form.Label>
            Email
            <Asterisk />
          </Form.Label>
          <Form.Control
            isValid={formik.touched.email && !formik.errors.email}
            isInvalid={formik.touched.email && formik.errors.email}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Enter email"
            value={formik.values.email}
            onChange={formik.handleChange}
          />
          {formik.touched.email && formik.errors.email ? <Form.Text className="text-danger">{formik.errors.email}</Form.Text> : <Form.Text className="text-muted">We'll never share your email with anyone else.</Form.Text>}
        </Form.Group>

        <Form.Group controlId="register-password">
          <Form.Label>
            Password
            <Asterisk />
          </Form.Label>
          <InputGroup className="input-group-password">
            <Form.Control
              isValid={formik.touched.password && !formik.errors.password}
              isInvalid={formik.touched.password && formik.errors.password}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              placeholder="Password"
              value={formik.values.password}
              onChange={formik.handleChange}
            />
            <InputGroup.Append>
              <InputGroup.Text as="div" className="toggle-show-password" id="show-password" onClick={handleToggleViewPassword}>
                {showPassword ? "Hide" : "Show"}
              </InputGroup.Text>
            </InputGroup.Append>
          </InputGroup>
          {formik.touched.password && formik.errors.password ? <Form.Text className="text-danger">{formik.errors.password}</Form.Text> : <Form.Text className="text-muted">Choose a strong password between 8-32 characters.</Form.Text>}
        </Form.Group>

        <Form.Group controlId="register-confirmpassword">
          <Form.Label>
            Confirm Password
            <Asterisk />
          </Form.Label>
          <Form.Control
            isInvalid={formik.touched.confirm_password && formik.errors.confirm_password}
            type={showPassword ? "text" : "password"}
            name="confirm_password"
            autoComplete="new-password"
            placeholder="Confirm Password"
            value={formik.values.confirm_password}
            onChange={formik.handleChange}
          />
          {formik.touched.confirm_password && formik.errors.confirm_password ? <Form.Text className="text-danger">{formik.errors.confirm_password}</Form.Text> : <Form.Text className="text-muted">Repeat the password again.</Form.Text>}
        </Form.Group>

        <Form.Group controlId="register-form">
          <Form.Label>Phone</Form.Label>
          <PhoneNumberInput
            defaultCountry={"IN"}
            inputComponent={Form.Control}
            isInvalid={formik.touched.phone && formik.values.phone && !isPossiblePhoneNumber(formik.values.phone)}
            placeholder="Enter your mobile number"
            autoComplete="tel"
            value={formik.values.phone}
            onChange={handleMobileNumberChange}
          />
          {formik.touched.phone && formik.values.phone && !isPossiblePhoneNumber(formik.values.phone) ? (
            <Form.Text className="text-danger">Mobile number is invalid</Form.Text>
          ) : (
            <Form.Text className="text-muted">We'll never share your phone with anyone else.</Form.Text>
          )}
        </Form.Group>

        {formik.status && formik.status.registerForm && (
          <Alert variant="danger" className="text-center">
            {formik.status.registerForm}
          </Alert>
        )}
        <div className="text-center pt-3">
          <Button variant="primary" type="submit">
            Register
          </Button>
          <Button size="sm" className="ml-2" variant="link" type="reset">
            Reset
          </Button>
          <div className="mt-2" style={{ fontSize: ".85rem" }}>
            {"By signing up, you agree to our "}
            <Link to="/terms">terms and conditions</Link>.
          </div>
          <hr />
          <div className="mt-3" id="login-btn">
            <span>Already have a student account? </span>
            <a href="#login-btn" onClick={onClickLogin}>
              Login
            </a>
          </div>
        </div>
      </Form>
    </>
  );
}
const forgotPwdDefaultForm = { email: "" };

const forgotPwdValidationSchema = Yup.object({
  email: Yup.string().email("Email address is invalid").required("Email address is required"),
});

function ForgotPasswordForm({ onClickBack }) {
  const subscribed = useRef(true);

  useEffect(() => {
    subscribed.current = true;
    return () => (subscribed.current = false);
  }, []);

  const handleOnSubmit = async (values, { setStatus }) => {
    setStatus({ loginForm: null });
    try {
      const { data } = await api.post("/auth/student/password/forgot", { email: values.email });
      if (subscribed.current && data) setStatus({ loginForm: data.message });
    } catch (error) {
      if (subscribed.current) {
        setStatus({ loginForm: getErrorMessage(error, "Some error occured, try again") });
      }
    }
  };

  return (
    <Formik initialValues={forgotPwdDefaultForm} validationSchema={forgotPwdValidationSchema} onSubmit={handleOnSubmit}>
      {({ values, touched, errors, handleBlur, handleChange, handleSubmit, status, isSubmitting }) => (
        <Form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="text-center pt-3">
            <h5>Trouble Logging In?</h5>
            <p style={{ fontSize: ".9rem" }} className="px-5 mb-4 text-muted">
              Enter your email and we'll send you a link to get back into your account.
            </p>
          </div>
          <Form.Group controlId="login-email">
            <Form.Control isInvalid={touched.email && errors.email} type="email" name="email" autoComplete="email" placeholder="Email" value={values.email} onBlur={handleBlur} onChange={handleChange} />
            {touched.email && errors.email ? <Form.Text className="text-danger">{errors.email}</Form.Text> : <Form.Text></Form.Text>}
          </Form.Group>

          {status && status.loginForm && (
            <Alert variant="info" className="text-center">
              {status.loginForm}
            </Alert>
          )}

          <div className="text-center">
            {isSubmitting ? (
              <Button onClick={(e) => e.preventDefault()} variant="primary">
                <Spinner animation="border" role="status" size="sm">
                  <span className="sr-only">Loading...</span>
                </Spinner>
              </Button>
            ) : (
              <Button type="submit" variant="primary" size="sm">
                Send Login Link
              </Button>
            )}
            <div className="mt-3" style={{ fontSize: ".9rem" }} id="back-btn">
              <a href="#back-btn" onClick={onClickBack}>
                Back
              </a>
            </div>
          </div>
        </Form>
      )}
    </Formik>
  );
}

export default function StudentAuth() {
  const subscribed = useRef(false);
  const [selectedForm, setSelectedForm] = useState("login");

  const handleClickRegister = () => {
    setSelectedForm("register");
  };

  const handleClickLogin = () => {
    setSelectedForm("login");
  };

  const handleClickForget = () => {
    setSelectedForm("forgot");
  };

  useEffect(() => {
    subscribed.current = true;

    return () => {
      subscribed.current = false;
    };
  }, []);

  return (
    <>
      <div className="container-fluid login-container">
        <div className="row h-100 justify-content-center ">
          <div className="col-md-8 col-lg-6 col-xl-4">
            {
              {
                login: <StudentLoginForm onClickRegister={handleClickRegister} onClickForget={handleClickForget} />,
                register: <StudentRegisterForm onClickLogin={handleClickLogin} />,
                forgot: <ForgotPasswordForm onClickBack={handleClickLogin} />,
              }[selectedForm]
            }
          </div>
        </div>
      </div>
    </>
  );
}
