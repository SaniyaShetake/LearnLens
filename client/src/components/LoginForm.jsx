import React, { useState, useRef, useEffect } from "react";
import { Form, InputGroup, Button, Spinner, Alert } from "react-bootstrap";
import { Link, useHistory, useLocation } from "react-router-dom";
import { useAuth } from "provider/auth";
import { safeRedirectPath } from "handler/api";

import { Formik } from "formik";
import * as Yup from "yup";

const defaultForm = { email: "", password: "", rememberMe: false };

const loginValidationSchema = Yup.object({
  email: Yup.string().email("Email address is invalid").required("Email address is required"),
  password: Yup.string().required("Password is required"),
  rememberMe: Yup.boolean()
});

function LoginForm() {
  const subscribed = useRef(true);

  const { login } = useAuth();
  const history = useHistory();
  const location = useLocation();

  useEffect(() => {
    subscribed.current = true;
    return () => (subscribed.current = false);
  }, []);

  const [showPassword, setShowPassword] = useState(false);

  const handleToggleViewPassword = e => {
    setShowPassword(sp => !sp);
  };

  const handleOnSubmit = async (values, { setStatus }) => {
    setStatus({ loginForm: null });
    try {
      const [error] = await login(values.email, values.password, values.rememberMe);

      if (subscribed.current) {
        if (error) setStatus({ loginForm: error });
        else {
          history.push(safeRedirectPath(location.state && location.state.from));
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
        <Form
          className="login-form"
          onSubmit={e => {
            e.preventDefault();
            handleSubmit();
          }}
        >
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
              <Button onClick={e => e.preventDefault()} variant="primary">
                <Spinner animation="border" role="status" size="sm">
                  <span className="sr-only">Loading...</span>
                </Spinner>
              </Button>
            ) : (
              <Button type="submit" variant="primary">
                Login
              </Button>
            )}
            <div className="mt-2" style={{ fontSize: ".9rem" }}>
              <Link to="/password/forgot">Forgot password?</Link>
            </div>
            <hr />
            <div className="mt-3">
              <span>Don't have an account? </span>
              <Link to="/register">Register</Link>
            </div>
          </div>
        </Form>
      )}
    </Formik>
  );
}

export default LoginForm;
