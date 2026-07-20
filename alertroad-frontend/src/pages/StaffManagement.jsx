import { useState } from "react";
import { useEffect } from "react";
import NavBar from "../components/NavBar";
import "./StaffManagement.css";

const API_URL = "";

function StaffManagement() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetTargetId, setResetTargetId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");

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

    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.detail || "Failed to create staff account.");
        return;
      }

      setUsername("");
      setPassword("");
      loadUsers();
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId, isCurrentlyActive) => {
    const confirmMessage = isCurrentlyActive
      ? "Disable this staff account? They won't be able to log in until re-enabled."
      : "Re-enable this staff account?";
    if (!window.confirm(confirmMessage)) return;

    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/status`, {
        method: "PUT",
        headers: authHeaders(),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.detail || "Failed to update account status.");
        return;
      }

      loadUsers();
    } catch (err) {
      console.error("Status toggle failed:", err);
    }
  };

  const handleOpenReset = (userId) => {
    setResetTargetId(userId);
    setNewPassword("");
    setResetError("");
  };

  const handleCancelReset = () => {
    setResetTargetId(null);
    setNewPassword("");
    setResetError("");
  };

  const handleSubmitReset = async (e) => {
    e.preventDefault();
    setResetError("");

    if (!newPassword.trim()) {
      setResetError("Enter a new password.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/users/${resetTargetId}/reset-password`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ new_password: newPassword }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setResetError(data.detail || "Failed to reset password.");
        return;
      }

      alert("Password reset. Share the new password with the staff member directly.");
      handleCancelReset();
    } catch (err) {
      setResetError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="staff-page">
      <NavBar />

      <div className="staff-content">
        <h1 className="staff-title">Manage Staff</h1>

        <form className="staff-form" onSubmit={handleCreate}>
          <h2 className="staff-form-title">Add New Staff</h2>

          <label className="staff-label" htmlFor="staff-username">
            Username
          </label>
          <input
            id="staff-username"
            type="text"
            className="staff-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
                <div
                  key={user.id}
                  className={`staff-row${user.is_active === false ? " staff-row-disabled" : ""}`}
                >
                  <span className="staff-row-email">{user.username}</span>
                  <span className="staff-row-role">
                    {user.is_admin ? "Admin" : "Staff"}
                  </span>
                  <span className="staff-row-status">
                    {user.is_active === false ? "Disabled" : "Active"}
                  </span>

                  {!user.is_admin && (
                    <>
                      <button
                        className="staff-row-reset"
                        onClick={() => handleOpenReset(user.id)}
                      >
                        Reset Password
                      </button>
                      <button
                        className={
                          user.is_active === false
                            ? "staff-row-enable"
                            : "staff-row-delete"
                        }
                        onClick={() => handleToggleStatus(user.id, user.is_active !== false)}
                      >
                        {user.is_active === false ? "Enable" : "Disable"}
                      </button>
                    </>
                  )}

                  {resetTargetId === user.id && (
                    <form className="staff-reset-form" onSubmit={handleSubmitReset}>
                      <input
                        type="password"
                        className="staff-input"
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoFocus
                      />
                      {resetError && (
                        <p className="staff-error-text">{resetError}</p>
                      )}
                      <div className="staff-reset-actions">
                        <button type="submit" className="staff-submit">
                          Save New Password
                        </button>
                        <button
                          type="button"
                          className="staff-row-delete"
                          onClick={handleCancelReset}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
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