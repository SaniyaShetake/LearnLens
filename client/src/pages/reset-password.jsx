import React from "react";
import Layout from "components/Layout";
import ResetPasswordForm from "components/ResetPasswordForm";

function ResetPassword() {
  return (
    <Layout>
      <div className="container h-100">
        <div className="row h-100 justify-content-center align-items-center">
          <div className="col-md-5">
            <div className="card">
              <div className="card-body">
                <ResetPasswordForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default ResetPassword;
