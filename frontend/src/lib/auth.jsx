import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { formatApiError } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = loading, false = anon
  const [permissions, setPermissions] = useState({});

  const fetchPermissions = useCallback(async () => {
    try {
      const { data } = await api.get("/permissions");
      setPermissions(data.permissions || {});
    } catch (e) {
      setPermissions({});
    }
  }, []);

  const bootstrap = useCallback(async () => {
    const token = localStorage.getItem("sms_token");
    if (!token) {
      setUser(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      await fetchPermissions();
    } catch {
      localStorage.removeItem("sms_token");
      localStorage.removeItem("sms_user");
      setUser(false);
    }
  }, [fetchPermissions]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (username, password) => {
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("sms_token", data.token);
      localStorage.setItem("sms_user", JSON.stringify(data.user));
      setUser(data.user);
      await fetchPermissions();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: formatApiError(err) };
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    localStorage.removeItem("sms_token");
    localStorage.removeItem("sms_user");
    setUser(false);
    setPermissions({});
  };

  const can = (resource, action) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return !!permissions?.[user.role]?.[resource]?.[action];
  };

  return (
    <AuthContext.Provider value={{ user, permissions, login, logout, can, refreshPermissions: fetchPermissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
