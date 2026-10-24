import React, { createContext, useContext, useCallback } from "react";
import api, { getErrorMessage } from "handler/api";
import { useTokenSession } from "provider/session";
import { useParams } from "react-router-dom";

export const StudentAuthContext = createContext({
  isLoggedIn: false,
  data: null,
  loading: false,
  login: () => {},
  register: () => {},
  refresh: () => {},
  request: async () => {},
  logout: () => {},
});

function useProvideStudentAuth() {
  const { id } = useParams();
  const getLogoutBody = useCallback(() => ({ lesson_id: id }), [id]);

  const { user, setLoading, loading, subs, storeSession, refresh, request, logout } = useTokenSession({
    refreshPath: "/auth/student/refresh",
    logoutPath: "/auth/student/logout",
    getLogoutBody,
  });

  const login = useCallback(
    async (email, password, remember = false) => {
      setLoading(true);
      try {
        if (!email && !password) return ["Please enter both username and password", false];

        const { data } = await api.post("/auth/student/signin", { email, password, remember, lesson_id: id }, { withCredentials: true });

        if (data && data.success) {
          storeSession(data);

          return [null, true];
        }

        return ["There was an error in logging in, try again.", false];
      } catch (error) {
        const status = error && error.response && error.response.status;
        if (status && status < 500) return ["The email or password was incorrect.", false];
        return [getErrorMessage(error, "Couldn't log in, please try again."), false];
      } finally {
        if (subs.current) setLoading(false);
      }
    },
    [id, setLoading, storeSession, subs]
  );

  const register = useCallback((body) => {
    return new Promise((resolve, reject) => {
      setLoading(true);

      api
        .post("/auth/student/signup", body, { withCredentials: true })
        .then(({ data }) => {
          if (subs.current) setLoading(false);

          if (data && data.success) {
            storeSession(data);

            return resolve(true);
          }

          return resolve(false);
        })
        .catch((err) => {
          if (subs.current) setLoading(false);
          console.log(err);
          return reject({ status: err && err.response && err.response.status, message: getErrorMessage(err, "Registration failed") });
        });
    });
  }, [setLoading, storeSession, subs]);

  return {
    isLoggedIn: !!user,
    data: user,
    loading,
    login,
    register,
    refresh,
    request,
    logout,
  };
}

export function ProvideStudentAuth({ children }) {
  const auth = useProvideStudentAuth();

  return <StudentAuthContext.Provider value={{ ...auth }}>{children}</StudentAuthContext.Provider>;
}

export const useStudentAuth = () => {
  return useContext(StudentAuthContext);
};
