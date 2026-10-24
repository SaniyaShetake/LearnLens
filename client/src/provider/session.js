import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import api, { createAuthRequest, isAuthError } from "handler/api";

// Refresh the access token once 80% of its lifetime has passed (but never sooner than 30s).
const REFRESH_AT = 0.8;
const MIN_REFRESH_DELAY = 30 * 1000;
// setTimeout overflows above ~24.8 days.
const MAX_TIMEOUT = 2147483647;
// On focus / visibility change, refresh when less than this much lifetime remains.
const NEAR_EXPIRY = 2 * 60 * 1000;

/** jwt_token_expiry is the token lifetime in ms; tolerate an absolute timestamp as well. */
function toLifetime(expiry) {
  const n = Number(expiry);
  if (!n || n < 0) return null;
  if (n > 1e12) return Math.max(n - Date.now(), 0);
  return n;
}

/**
 * Shared access-token session handling for the teacher, student and researcher providers.
 *
 * - The access token lives in memory only; the refresh token is an httpOnly cookie.
 * - refresh() is single-flight and resolves true on success, false on a definitive auth failure
 *   (session cleared) and rejects on network / server errors (session kept).
 * - Every refresh remembers the session "generation" it started in. logout() / clearSession() bump
 *   the generation, so a refresh that started earlier can never resurrect the session afterwards.
 * - Refreshes are scheduled from the token lifetime, and re-checked on window focus / visibility.
 */
export function useTokenSession({ refreshPath, logoutPath, getLogoutBody }) {
  const subs = useRef(true);
  const token = useRef(null); // { token, expiresAt, lifetime }
  const generation = useRef(0);
  const refreshInFlight = useRef(null);
  const timer = useRef(null);
  const refreshRef = useRef(null);
  const logoutBody = useRef(getLogoutBody);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    logoutBody.current = getLogoutBody;
  }, [getLogoutBody]);

  const cancelTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const scheduleRefresh = useCallback(
    (delay) => {
      cancelTimer();
      if (!subs.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        if (refreshRef.current) refreshRef.current({ silent: true }).catch((error) => console.log(error));
      }, Math.min(Math.max(delay, MIN_REFRESH_DELAY), MAX_TIMEOUT));
    },
    [cancelTimer]
  );

  const clearSession = useCallback(() => {
    generation.current += 1;
    refreshInFlight.current = null;
    token.current = null;
    cancelTimer();
    if (subs.current) setUser(null);
  }, [cancelTimer]);

  /**
   * Stores a signin / signup / refresh response. A refresh passes the generation it started in and is
   * ignored when that is stale; a signin / signup (no generation) starts a new generation so an older
   * refresh can't overwrite or clear the fresh session.
   */
  const storeSession = useCallback(
    (data, gen) => {
      if (gen === undefined) {
        generation.current += 1;
        refreshInFlight.current = null;
      } else if (gen !== generation.current) return false;
      if (!subs.current) return false;
      const lifetime = toLifetime(data.jwt_token_expiry);
      token.current = {
        token: data.jwt_token,
        lifetime,
        expiresAt: lifetime ? Date.now() + lifetime : null,
      };
      setUser(data.user);
      if (lifetime) scheduleRefresh(lifetime * REFRESH_AT);
      else cancelTimer();
      return true;
    },
    [scheduleRefresh, cancelTimer]
  );

  const refresh = useCallback(
    ({ silent = false } = {}) => {
      if (refreshInFlight.current) return refreshInFlight.current;

      const gen = generation.current;
      if (!silent) setLoading(true);

      const promise = api
        .post(refreshPath, {}, { withCredentials: true })
        .then(({ data }) => {
          if (gen !== generation.current) return false;
          if (data && data.success) return storeSession(data, gen);
          clearSession();
          return false;
        })
        .catch((err) => {
          if (gen !== generation.current) return false;
          if (isAuthError(err)) {
            clearSession();
            return false;
          }
          // Couldn't reach the server: keep the session and try again a bit later.
          if (token.current) scheduleRefresh(MIN_REFRESH_DELAY);
          throw err;
        })
        .finally(() => {
          if (refreshInFlight.current === promise) refreshInFlight.current = null;
          if (!silent && subs.current) setLoading(false);
        });

      refreshInFlight.current = promise;
      return promise;
    },
    [refreshPath, storeSession, clearSession, scheduleRefresh]
  );

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const request = useMemo(
    () =>
      createAuthRequest({
        getToken: () => (token.current ? token.current.token : null),
        refresh: () => refresh({ silent: true }),
        onAuthFailure: clearSession,
      }),
    [refresh, clearSession]
  );

  // Works with an expired access token: the server identifies the session by the refresh cookie.
  const logout = useCallback(async () => {
    const pending = refreshInFlight.current;
    // Invalidate any refresh that is still running so it can't log the user back in.
    generation.current += 1;
    refreshInFlight.current = null;
    cancelTimer();

    // Let an in-flight refresh settle first so the request carries the latest refresh cookie.
    if (pending) await pending.catch(() => {});

    const body = logoutBody.current ? logoutBody.current() : {};
    try {
      const { data } = await api.post(logoutPath, body || {}, { withCredentials: true });
      return !!(data && data.success);
    } catch (err) {
      console.log(err);
      return false;
    } finally {
      clearSession();
      try {
        window.localStorage.setItem("logout", Date.now());
      } catch (e) {}
    }
  }, [logoutPath, cancelTimer, clearSession]);

  // Background tabs throttle timers, so re-check the token when the tab becomes active again.
  useEffect(() => {
    const check = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const current = token.current;
      if (!current || !current.expiresAt) return;
      const remaining = current.expiresAt - Date.now();
      const margin = Math.min(NEAR_EXPIRY, current.lifetime * (1 - REFRESH_AT));
      if (remaining <= margin) refresh({ silent: true }).catch((error) => console.log(error));
    };

    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [refresh]);

  useEffect(() => {
    subs.current = true;
    return () => {
      subs.current = false;
      generation.current += 1;
      cancelTimer();
    };
  }, [cancelTimer]);

  return { user, setUser, loading, setLoading, subs, storeSession, clearSession, refresh, request, logout };
}
