require("dotenv").config({ quiet: true });

const defaultData = {
  from: "Tcherly Support <support@tcherly.com>"
};

const isProduction = () => process.env.NODE_ENV === "production";
const hasMailgunConfig = () => !!process.env.MG_APIKEY && !!process.env.MG_DOMAIN;
const logTransportRequested = () => process.env.MAIL_TRANSPORT === "log";

/**
 * How mail is delivered:
 *  - "mailgun":  Mailgun is configured (and MAIL_TRANSPORT=log is not set)
 *  - "log":      mail is printed to the console, never sent. Outside production this is the
 *                fallback (tests, missing Mailgun config, MAIL_TRANSPORT=log). In production only
 *                when MAIL_TRANSPORT=log is set explicitly.
 *  - "disabled": production without Mailgun config and without MAIL_TRANSPORT=log. Sending fails
 *                and nothing (in particular no reset link) is logged.
 */
const getTransport = () => {
  if (isProduction()) {
    if (logTransportRequested()) return "log";
    return hasMailgunConfig() ? "mailgun" : "disabled";
  }
  if (process.env.NODE_ENV === "test" || logTransportRequested() || !process.env.MG_APIKEY) return "log";
  return "mailgun";
};

let mg = null;
// Mailgun client (mailgun.js). MG_URL selects the API region, e.g. https://api.eu.mailgun.net for EU domains.
const getMailgun = () => {
  if (!mg) {
    const Mailgun = require("mailgun.js");
    const FormData = require("form-data");
    const options = { username: "api", key: process.env.MG_APIKEY };
    if (process.env.MG_URL) options.url = process.env.MG_URL;
    mg = new Mailgun(FormData).client(options);
  }
  return mg;
};

const logMail = message => {
  console.log(
    [
      "[mail] ---- mail not sent (log transport) ----",
      "[mail] from: " + message.from,
      "[mail] to: " + message.to,
      "[mail] subject: " + message.subject,
      message.text ? "[mail] text:\n" + message.text : null,
      message.html ? "[mail] html:\n" + message.html : null,
      "[mail] ---------------------------------------"
    ]
      .filter(Boolean)
      .join("\n")
  );
  return { id: null, message: "Logged (not sent)" };
};

/** Logs the mail configuration once at startup (warnings/errors only in production). */
const checkMailConfig = () => {
  const transport = getTransport();
  if (!isProduction()) return transport;
  if (transport === "log") {
    console.warn(
      "[mail] WARNING: MAIL_TRANSPORT=log is set in production: emails (including password reset links) are NOT delivered, only printed to the server log."
    );
  } else if (transport === "disabled") {
    console.error(
      "[mail] ERROR: MG_APIKEY and/or MG_DOMAIN are not set in production. Emails (password resets) cannot be sent. " +
        "Configure Mailgun (see documents/ENVIRONMENT.md), or set MAIL_TRANSPORT=log to deliberately print mails to the log."
    );
  }
  return transport;
};

/**
 * Sends a mail. Resolves to the Mailgun response (or a "logged" marker for the log transport).
 * Rejects when mail cannot be delivered (not configured in production, or Mailgun failed);
 * the error never contains the message body.
 */
const sendMail = async data => {
  const message = { ...defaultData, ...data };
  const transport = getTransport();
  if (transport === "log") return logMail(message);
  if (transport === "disabled") {
    console.error("[mail] not sent (mail is not configured in production): subject=" + JSON.stringify(message.subject));
    throw new Error("Mail is not configured.");
  }
  try {
    return await getMailgun().messages.create(process.env.MG_DOMAIN, message);
  } catch (error) {
    console.error("[mail] delivery failed: subject=" + JSON.stringify(message.subject) + ": " + (error && error.message));
    throw new Error("Mail delivery failed.");
  }
};

module.exports = { sendMail, checkMailConfig, getTransport };
