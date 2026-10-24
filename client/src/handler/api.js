import axios from "axios";
import { isMobile } from "react-device-detect";

let baseURL = "/api/";

if (import.meta.env.DEV) {
  // On a phone the API must be reached via the dev machine's LAN address
  // (see VITE_MOBILE_API_URL in .env.example). Fall back to the regular
  // API url when it is not configured, and finally to the Vite dev-server proxy path.
  if (isMobile) baseURL = import.meta.env.VITE_MOBILE_API_URL || import.meta.env.VITE_API_URL || "/api/";
  else baseURL = import.meta.env.VITE_API_URL || "/api/";
}

const api = axios.create({
  baseURL,
});

export default api;

/** True when the error is a definitive authentication failure (not a network / server error). */
export function isAuthError(error) {
  const status = error && error.response && error.response.status;
  return status === 401 || status === 403;
}

/** Extracts a human readable message from an axios error / response. */
export function getErrorMessage(error, fallback = "Something went wrong, please try again.") {
  if (!error) return fallback;
  if (error.response) {
    const { data, status } = error.response;
    if (data && typeof data === "object" && typeof data.message === "string" && data.message) return data.message;
    if (status === 404) return "The requested item could not be found.";
    // Only a 401 that survived a refresh attempt means the session is really gone.
    if (status === 401 && error.sessionExpired) return "Your session has expired, please log in again.";
    if (status === 403) return "You don't have permission to do that.";
    if (status >= 500) return "The server ran into a problem, please try again later.";
    return fallback;
  }
  if (error.request) return "Could not reach the server. Check your connection and try again.";
  if (typeof error === "string") return error;
  return fallback;
}

/**
 * Builds an authenticated request function.
 *
 * - getToken(): returns the current in-memory access token (or null)
 * - refresh(): resolves true when a new token was obtained, false on a definitive auth
 *   failure, and rejects on network / server errors.
 * - onAuthFailure(): called when a 401 could not be recovered by refreshing.
 *
 * On a 401 the request is retried exactly once: straight away with the new token when the token
 * already changed while the request was in flight (e.g. a concurrent refresh just finished),
 * otherwise after a successful refresh. Errors from a 401 that could not be recovered carry
 * `sessionExpired = true`.
 */
export function createAuthRequest({ getToken, refresh, onAuthFailure }) {
  const send = (type, url, data, opts, token) => {
    const config = { ...opts, withCredentials: true };
    if (token) config.headers = { ...(opts.headers || {}), Authorization: token };

    switch (type) {
      case "GET":
        return api.get(url, config);
      case "POST":
        return api.post(url, data, config);
      case "PUT":
        return api.put(url, data, config);
      case "DELETE":
        return api.delete(url, config);
      default:
        return Promise.reject(new Error("Please provide a valid request type"));
    }
  };

  const markExpired = (error) => {
    if (error && error.response && error.response.status === 401) error.sessionExpired = true;
    return error;
  };

  return async function request(type = null, url = null, data = {}, opts = {}) {
    if (typeof type !== "string") throw new Error("Request type (GET/POST/PUT/DELETE) needed.");
    if (typeof url !== "string") throw new Error("Provide a valid string as url.");

    if (data === null || typeof data !== "object") data = {};
    if (opts === null || typeof opts !== "object") opts = {};

    data = { ...data, date_client: Date.now() };

    const sentWith = getToken();
    try {
      return await send(type, url, data, opts, sentWith);
    } catch (error) {
      if (!(error && error.response && error.response.status === 401)) throw error;

      // Another request already refreshed the token while this one was in flight: just retry.
      const current = getToken();
      if (current && current !== sentWith) {
        try {
          return await send(type, url, data, opts, current);
        } catch (retryError) {
          throw markExpired(retryError);
        }
      }

      // A network / server error while refreshing rejects here: the session is kept and that
      // error (e.g. "Could not reach the server") is reported instead of an expired session.
      const refreshed = await refresh();

      if (!refreshed) {
        onAuthFailure();
        throw markExpired(error);
      }

      try {
        return await send(type, url, data, opts, getToken());
      } catch (retryError) {
        throw markExpired(retryError);
      }
    }
  };
}

/**
 * Returns `from` when it is a safe same-origin path ("/..." with no "//" prefix, no backslashes
 * and no control characters), otherwise the fallback.
 */
export function safeRedirectPath(from, fallback = "/dashboard") {
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(from)) return fallback;
  return from;
}

/**
 * Saves a binary (xlsx) axios response (responseType "blob") to disk.
 * Works for both a streamed response with Content-Disposition and a plain sendFile response.
 * Rejects when the server answered with a JSON error instead of a file.
 */
export async function saveBlobResponse(response, fallbackName) {
  const { data, headers = {} } = response || {};
  if (!data) throw new Error("Empty download");

  const contentType = headers["content-type"] || (data && data.type) || "";
  if (contentType.indexOf("application/json") !== -1) {
    let message = "Export failed";
    try {
      const parsed = JSON.parse(await data.text());
      if (parsed && parsed.message) message = parsed.message;
    } catch (e) {}
    throw new Error(message);
  }

  let filename = fallbackName;
  const disposition = headers["content-disposition"];
  if (disposition) {
    const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    const plain = /filename="?([^";]+)"?/i.exec(disposition);
    try {
      if (utf8) filename = decodeURIComponent(utf8[1]);
      else if (plain) filename = plain[1];
    } catch (e) {}
  }

  const blob = data instanceof Blob ? data : new Blob([data], { type: contentType || "application/octet-stream" });
  const href = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(href), 1000);
  return filename;
}
