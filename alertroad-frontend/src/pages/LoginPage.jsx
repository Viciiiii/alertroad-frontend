import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const MOCK_EMAIL = "alertroad@gmail.com";
const MOCK_PASSWORD = "password123";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Incorrect Email or Password");
      return;
    }

    if (email !== MOCK_EMAIL || password !== MOCK_PASSWORD) {
      setError("Incorrect Email or Password");
      return;
    }

    login();
    navigate("/dashboard");
  };

  return (
    <div className="login-page">
      <div className="login-logo">
        <span className="logo-diamond" />
        <span className="logo-text">ALERTROAD</span>
      </div>

      <div className="login-wrapper">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <h1 className="login-title">Log In</h1>

          <label className="login-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={`login-input ${error ? "login-input-error" : ""}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            autoComplete="current-password"
          />
          {error && <p className="login-error-text">{error}</p>}

          <button type="submit" className="login-button">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;