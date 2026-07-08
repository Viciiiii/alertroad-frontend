import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);
const API_URL = "http://localhost:8000";

function decodeToken(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const decoded = JSON.parse(atob(padded));
    return decoded;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const storedToken = localStorage.getItem("token");
  const storedPayload = storedToken ? decodeToken(storedToken) : null;

  const [isAuthenticated, setIsAuthenticated] = useState(!!storedToken);
  const [isAdmin, setIsAdmin] = useState(storedPayload?.is_admin || false);

  const login = async (email, password) => {
    const response = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "Incorrect Email or Password");
    }

    const data = await response.json();
    const payload = decodeToken(data.access_token);

    localStorage.setItem("token", data.access_token);
    setIsAuthenticated(true);
    setIsAdmin(payload?.is_admin || false);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}