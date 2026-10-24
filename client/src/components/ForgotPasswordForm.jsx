import React, { useRef, useEffect } from "react";
import { Form, Button, Spinner, Alert } from "react-bootstrap";
import { Link } from "react-router-dom";

import { Formik } from "formik";
import * as Yup from "yup";
import api, { getErrorMessage } from "handler/api";

const forgotPwdDefaultForm = { email: "" };

const forgotPwdValidationSchema = Yup.object({
  email: Yup.string().email("Email address is invalid").required("Email address is required"),
});

function ForgotPasswordForm() {
  const subscribed = useRef(true);

  useEffect(() => {
    subscribed.current = true;
    return () => (subscribed.current = false);
  }, []);

  const handleOnSubmit = async (values, { setStatus }) => {
    setStatus({ loginForm: null });
    try {
      const { data } = await api.post("/auth/password/forgot", { email: values.email });
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
            <div className="mt-3" style={{ fontSize: ".9rem" }}>
              <Link to="/login">Back</Link>
            </div>
          </div>
        </Form>
      )}
    </Formik>
  );
}

export default ForgotPasswordForm;
