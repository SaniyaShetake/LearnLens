const request = require("supertest");

/**
 * Performs the browser flow for a password reset: GET the reset page (to get
 * the CSRF cookie + token) and POST the new password as a form.
 * `prefix` is "" for teachers and "/student" for students.
 */
const submitReset = async (app, token, password, prefix = "") => {
  const agent = request.agent(app);
  const page = await agent.get(`${prefix}/password/reset/${encodeURIComponent(token)}`);
  const m = String(page.text || "").match(/name="_csrf"\s+value="([^"]+)"/);
  const form = { password, confirm_password: password };
  if (m) form._csrf = m[1];
  const res = await agent.post(`${prefix}/password/reset/${encodeURIComponent(token)}`).type("form").send(form);
  return { page, res };
};

module.exports = { submitReset };
