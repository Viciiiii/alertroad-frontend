import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import "./StaffManagement.css";

const API_URL = "http://localhost:8000";

function StaffManagement() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        headers: authHeaders(),
      });
      if (!response.ok) return;
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.detail || "Failed to create staff account.");
        return;
      }

      setEmail("");
      setPassword("");
      loadUsers();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.detail || "Failed to delete account.");
        return;
      }

      loadUsers();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="staff-page">
      <NavBar />

      <div className="staff-content">
        <h1 className="staff-title">Manage Staff</h1>

        <form className="staff-form" onSubmit={handleCreate}>
          <h2 className="staff-form-title">Add New Staff</h2>

          <label className="staff-label" htmlFor="staff-email">
            Email
          </label>
          <input
            id="staff-email"
            type="email"
            className="staff-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="staff-label" htmlFor="staff-password">
            Password
          </label>
          <input
            id="staff-password"
            type="password"
            className="staff-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="staff-error-text">{error}</p>}

          <button type="submit" className="staff-submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Staff Account"}
          </button>
        </form>

        <div className="staff-list">
          <h2 className="staff-list-title">All Accounts</h2>
          {users.length === 0 ? (
            <p className="staff-empty-text">No accounts yet.</p>
          ) : (
            <div className="staff-table">
              {users.map((user) => (
                <div key={user.id} className="staff-row">
                  <span className="staff-row-email">{user.email}</span>
                  <span className="staff-row-role">
                    {user.is_admin ? "Admin" : "Staff"}
                  </span>
                  {!user.is_admin && (
                    <button
                      className="staff-row-delete"
                      onClick={() => handleDelete(user.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StaffManagement;