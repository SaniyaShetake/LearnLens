import React, { createContext, useState, useContext } from "react";
import api, { getErrorMessage } from "handler/api";
import { useTokenSession } from "provider/session";

export const AuthContext = createContext({
  user: null,
  loading: false,
  login: () => {},
  register: () => {},
  refresh: () => {},
  request: async () => {},
  logout: () => {},
  viewAdvanced: () => {},
  isTourOpen: false,
  handleOpenTour: () => {},
  handleCloseTour: () => {},
  showUpgradeModal: false,
  setShowUpgradeModal: () => {},
});

const LOGOUT_BODY = () => ({});

function useProvideAuth() {
  const { user, setUser, loading, setLoading, subs, storeSession, refresh, request, logout } = useTokenSession({
    refreshPath: "/auth/refresh",
    logoutPath: "/auth/logout",
    getLogoutBody: LOGOUT_BODY,
  });

  const [isTourOpen, setIsTourOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const login = async (email, password, remember = false) => {
    setLoading(true);
    try {
      if (!email && !password) return ["Please enter both username and password", false];

      const { data } = await api.post("/auth/signin", { email, password, remember }, { withCredentials: true });

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
  };

  const register = React.useCallback((body) => {
    return new Promise((resolve, reject) => {
      setLoading(true);
      api
        .post("/auth/signup", body, { withCredentials: true })
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

  const viewAdvanced = () => {
    setUser((u) => ({ ...u, feature_level: "advanced" }));
  };

  const handleOpenTour = () => {
    setIsTourOpen(true);
  };

  const handleCloseTour = React.useCallback(() => {
    setIsTourOpen(false);

    setUser((u) => ({
      ...u,
      tour: {
        dashboard: (u.tour && u.tour.dashboard + 1) || 1,
      },
    }));

    request("PUT", "/auth/increment-tour?key=dashboard", {}).catch((err) => console.log(err));
    // Send data to backend, incrementing tour count
  }, [request, setUser]);

  return {
    user,
    loading,
    login,
    register,
    refresh,
    request,
    logout,
    viewAdvanced,
    isTourOpen,
    handleOpenTour,
    handleCloseTour,
    showUpgradeModal,
    setShowUpgradeModal,
  };
}

export function ProvideAuth({ children }) {
  const auth = useProvideAuth();
  return <AuthContext.Provider value={{ ...auth }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};
