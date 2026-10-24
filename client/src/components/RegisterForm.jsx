import React, { useEffect, useState } from "react";
import { Link, useHistory } from "react-router-dom";

import { Form, InputGroup, Button, Alert } from "react-bootstrap";
import PhoneNumberInput, { isPossiblePhoneNumber } from "react-phone-number-input";
import { useFormik } from "formik";
import * as Yup from "yup";

import { useQuery } from "utils/query";
import { useAuth } from "provider/auth";
import Loader from "./Loader";

import "react-phone-number-input/style.css";
import OnlineLearningPNG from "assets/images/student.png";
import ClassroomPNG from "assets/images/classroom.png";
import WatchVideo from "./watch-video";

const options = {
  class: [
    { id: 1, name: "Start lecture recording in the classroom" },
    { id: 2, name: "Collect student feedback" },
    { id: 3, name: "Analyze feedback on interactive teacher dashboard" },
  ],
  online: [
    { id: 1, name: "Upload a video lecture" },
    { id: 2, name: "Collect student feedback" },
    { id: 3, name: "Analyze feedback on interactive teacher dashboard" },
  ],
};

const defaultForm = { email: "", password: "", organization: "", fullname: "", mobile_number: "", feature_level: "", contact_for_research: null };

const featureOptions = [
  { value: "basic", label: "Basic", desc: "We will not have access to your videos, and you can access only the static dashboard where the detailed aggregate feedback analytics will be presented." },
  { value: "advanced", label: "Advanced", desc: "We will have access to your videos, and you can access the interactive dashboard where you can analyze feedback of specific sections, write to do’s based on analysis, and save the analysis." },
];

const registerValidationSchema = Yup.object({
  fullname: Yup.string().required("Fullname is required"),
  email: Yup.string().email("Email address is invalid").required("Email address is required"),
  password: Yup.string().min(8, "Password must be at least 8 characters").max(32, "Password must be at most 32 characters").required("Password is required"),
  organization: Yup.string().min(3).optional(),
  mobile_number: Yup.string().optional(),
  contact_for_research: Yup.string().oneOf(["yes", "no"]).required(),
  feature_level: Yup.string().oneOf(["basic", "advanced"], "Please select one of basic and advanced.").required("Please select one of the above."),
});

const Asterisk = () => <span className="text-danger"> *</span>;

function RegisterForm() {
  const { user, loading, register } = useAuth();
  const history = useHistory();

  const [mode, setMode] = useState(null);

  const query = useQuery();

  const formik = useFormik({
    initialValues: defaultForm,
    validationSchema: registerValidationSchema,
    onSubmit: (values, { setFieldError, setStatus }) => {
      setStatus(null);
      return register({ ...values, mode })
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
    },
    validateOnBlur: true,
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleToggleViewPassword = (e) => {
    setShowPassword((sp) => !sp);
  };

  const handleMobileNumberChange = (value) => {
    formik.setFieldValue("mobile_number", value);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    formik.handleSubmit(e);
  };

  useEffect(() => {
    if (query.mode !== null) {
      setMode(query.mode);
    }
  }, [query.mode]);

  useEffect(() => {
    if (user) {
      history.push("/dashboard");
    }
  }, [history, user]);

  if (user || loading) return <Loader />;

  if (mode === "online" || mode === "offline") {
    // if (feature !== "basic" && feature !== "advanced") {
    //   return (
    //     <>
    //       <div className="container">
    //         <div className="row justify-content-center">
    //           <div className="col-md-5 col-lg-4">
    //             <div className="card register-opts">
    //               <div className="card-body text-center">
    //                 <h4>
    //                   <Link to={`?mode=${mode}&feature=basic`}>Basic</Link>
    //                 </h4>
    //                 <ul>
    //                   <li>Unlimited lectures</li>
    //                   <li>Unlimited audience / students</li>
    //                   <li>We will not have access to your videos</li>
    //                   <li>See aggregate detailed feedback analytics</li>
    //                   <li>Static teacher dashboard</li>
    //                 </ul>
    //               </div>
    //             </div>
    //           </div>
    //           <div className="col-md-5 col-lg-4">
    //             <div className="card register-opts">
    //               <div className="card-body text-center">
    //                 <h4>
    //                   <Link to={`?mode=${mode}&feature=advanced`}>Advanced</Link>
    //                 </h4>
    //                 <ul>
    //                   <li>Unlimited lectures</li>
    //                   <li>Unlimited audience / students</li>
    //                   <li>Analyze student feedback for specific sections of the lecture video</li>
    //                   <li>Feedback synced with the lecture video for detailed feedback specific analysis</li>
    //                   <li>Interactive teacher dashboard</li>
    //                 </ul>
    //               </div>
    //             </div>
    //           </div>
    //         </div>
    //       </div>
    //       <br />
    //     </>
    //   );
    // }
  } else {
    return (
      <>
        <section className="py-3" style={{ minHeight: "100vh", background: "#efefef" }}>
          <div className="container login-container h-100">
            <div className="row h-100 justify-content-between align-items-center">
              <div className="col-md-6 col-lg-5 pb-3">
                <div className="card">
                  <div className="card-body">
                    <img src={ClassroomPNG} className="feature-img img-fluid" alt="" />

                    <h3 className="text-center mt-3">
                      <span>Classroom Feedback</span>
                    </h3>

                    <div className="features mt-3 mb-4">
                      {options.class.map((c) => {
                        return (
                          <div key={c.id} className="feature-box d-flex align-items-center">
                            <i className="fas fa-circle" style={{ fontSize: ".5rem" }} />
                            <h3>{c.name}</h3>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-center mt-3">
                      <Button disabled>
                        <span>Coming soon</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-6 col-lg-5 pb-3">
                <div className="card">
                  <div className="card-body">
                    <img src={OnlineLearningPNG} className="feature-img img-fluid" alt="" />

                    <h3 className="text-center mt-3">
                      <span>Online Feedback</span>
                    </h3>

                    <div className="features mt-3 mb-4">
                      {options.online.map((c) => {
                        return (
                          <div key={c.id} className="feature-box d-flex align-items-center">
                            <i className="fas fa-circle" style={{ fontSize: ".5rem" }} />
                            <h3>{c.name}</h3>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-center mt-3">
                      <WatchVideo />
                      <Button className="ml-3" as={Link} to="/register?mode=online">
                        <span>Get started </span>
                        <i className="fas fa-arrow-right" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="container-fluid login-container py-5">
        <div className="row h-100 justify-content-center ">
          <div className="col-md-8 col-lg-6 col-xl-4">
            <Form className="login-form" onSubmit={handleFormSubmit} onReset={formik.handleReset}>
              <Form.Group controlId="fullname">
                <Form.Label>
                  Name
                  <Asterisk />
                </Form.Label>
                <Form.Control type="text" isInvalid={formik.touched.fullname && formik.errors.fullname} name="fullname" placeholder="Enter your full name" value={formik.values.fullname} onChange={formik.handleChange} />
                {formik.touched.fullname && formik.errors.fullname ? <Form.Text className="text-danger">{formik.errors.fullname}</Form.Text> : null}
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
              <Form.Group controlId="register-org">
                <Form.Label>Organization</Form.Label>
                <Form.Control type="text" autoComplete="none" name="organization" placeholder="Enter organization name" value={formik.values.organization} onChange={formik.handleChange} />
              </Form.Group>
              <Form.Group controlId="register-form">
                <Form.Label>Mobile number</Form.Label>
                <PhoneNumberInput
                  defaultCountry={"IN"}
                  inputComponent={Form.Control}
                  isInvalid={formik.touched.mobile_number && formik.values.mobile_number && !isPossiblePhoneNumber(formik.values.mobile_number)}
                  placeholder="Enter your mobile number"
                  autoComplete="tel"
                  value={formik.values.mobile_number}
                  onChange={handleMobileNumberChange}
                />
                {formik.touched.mobile_number && formik.values.mobile_number && !isPossiblePhoneNumber(formik.values.mobile_number) ? <Form.Text className="text-danger">Mobile number is invalid</Form.Text> : null}
              </Form.Group>
              <Form.Group>
                <Form.Label>
                  Select one of the following
                  <Asterisk />
                </Form.Label>
                {featureOptions.map((ft, k) => (
                  <div key={k}>
                    <Form.Check
                      isInvalid={formik.touched.feature_level && !!formik.errors.feature_level}
                      key={k}
                      checked={formik.values.feature_level === ft.value}
                      name="feature_level"
                      value={ft.value}
                      onChange={formik.handleChange}
                      id={ft.value}
                      type="radio"
                      label={ft.label}
                      custom
                    />
                    {formik.values.feature_level === ft.value ? <Form.Text className="mb-2">{ft.desc}</Form.Text> : null}
                  </div>
                ))}
                {formik.touched.feature_level && formik.errors.feature_level ? (
                  <Form.Text className="text-danger">{formik.errors.feature_level}</Form.Text>
                ) : (
                  formik.values.feature_level !== "basic" && formik.values.feature_level !== "advanced" && <Form.Text className="text-muted">Depending on the option, you get access to features</Form.Text>
                )}
              </Form.Group>
              <Form.Group>
                <Form.Label>
                  Do you want to be contacted for research purposes?
                  <Asterisk />
                </Form.Label>
                <br />
                {["Yes", "No"].map((co, k) => {
                  const v = co.toLowerCase();
                  return (
                    <Form.Check
                      key={k}
                      isInvalid={formik.touched.contact_for_research && formik.errors.contact_for_research}
                      type="radio"
                      inline
                      custom
                      id={"contact_for_research-" + v}
                      checked={formik.values.contact_for_research === v}
                      name="contact_for_research"
                      label={co}
                      value={v}
                      onChange={formik.handleChange}
                    />
                  );
                })}
                {formik.touched.contact_for_research && formik.errors.contact_for_research ? (
                  <Form.Text className="text-danger">Please select one of the above.</Form.Text>
                ) : (
                  <Form.Text>{formik.values.contact_for_research === "yes" ? "Research team will get in touch with you." : formik.values.contact_for_research === "no" && "You won't be contacted."}</Form.Text>
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
                <div className="mt-3">
                  <span>Already have an account? </span>
                  <Link to="/login">Login</Link>
                </div>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </>
  );
}

export default RegisterForm;
