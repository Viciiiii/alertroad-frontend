import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import alertroadLogo from "../assets/alertroad-logo.jpg";
import "./Login.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");

  const trimmedUsername = username.trim();

  if (!trimmedUsername || !password.trim()) {
    setError("Incorrect Username or Password");
    return;
  }

  setIsSubmitting(true);
  try {
    await login(trimmedUsername, password);
    navigate("/dashboard");
  } catch (err) {
    setError(err.message || "Incorrect Username or Password");
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className="login-page">
      <div className="login-logo">
        <img src={alertroadLogo} alt="AlertRoad logo" className="logo-image" />
        <span className="logo-text">ALERTROAD</span>
      </div>

      <div className="login-wrapper">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h1 className="login-title">Log In</h1>

          <label className="login-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            className={`login-input ${error ? "login-input-error" : ""}`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onInput={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />

          <label className="login-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className={`login-input ${error ? "login-input-error" : ""}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onInput={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="login-error-text">{error}</p>}

          <button type="submit" className="login-button" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;