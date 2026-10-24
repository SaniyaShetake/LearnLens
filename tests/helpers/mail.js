// Access to the jest mock of utils/mail installed in tests/setup/after-env.js.
const getSendMail = () => require("../../utils/mail").sendMail;

const sentMails = () => getSendMail().mock.calls.map((args) => args[0]);

const mailText = (mail) => (typeof mail === "string" ? mail : JSON.stringify(mail));

const extractResetLink = (mail, kind = "") => {
  const re = new RegExp(`https?://[^\\s"'<>\\\\]*${kind}/password/reset/([A-Za-z0-9_\\-~.%]+)`);
  const m = mailText(mail).match(re);
  return m ? { url: m[0], token: decodeURIComponent(m[1]) } : null;
};

module.exports = { getSendMail, sentMails, mailText, extractResetLink };
