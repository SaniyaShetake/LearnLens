import React from "react";
import Header from "components/Header";
import Footer from "components/Footer";
import ForgotPasswordForm from "components/ForgotPasswordForm";

ForgotPassword.propTypes = {};

function ForgotPassword(props) {
  return (
    <>
      <Header pageName="" />
      <section className="py-5" style={{ minHeight: "100vh", background: "#efefef" }}>
        <div className="container h-100">
          <div className="row h-100 justify-content-center align-items-center">
            <div className="col-md-5">
              <div className="card">
                <div className="card-body">
                  <ForgotPasswordForm />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}

export default ForgotPassword;
