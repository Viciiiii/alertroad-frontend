import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import alertroadLogo from "../assets/alertroad-logo.jpg";
import "./NavBar.css";

function NavBar() {
  const { logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isOnDashboard = location.pathname === "/dashboard";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleLogoClick = () => {
    // "unless he's already in the dashboard" - do nothing if we're already there
    if (!isOnDashboard) {
      navigate("/dashboard");
    }
  };

  const scrollToSection = (id) => {
    if (!isOnDashboard) {
      // Not on the dashboard yet (e.g. we're on /admin) - navigate there first,
      // and tell Dashboard which section to scroll to once it mounts.
      navigate("/dashboard", { state: { scrollTo: id } });
      return;
    }

    // Already on the dashboard - scroll directly.
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav className="navbar">
      <div
        className={`navbar-logo${!isOnDashboard ? " navbar-logo-clickable" : ""}`}
        onClick={handleLogoClick}
      >
        <img src={alertroadLogo} alt="AlertRoad logo" className="logo-image" />
        <span className="logo-text">ALERTROAD</span>
      </div>

      <div className="navbar-links">
        <button
          className="navbar-link"
          onClick={() => scrollToSection("overview")}
        >
          Overview
        </button>
        <button
          className="navbar-link"
          onClick={() => scrollToSection("features")}
        >
          Features
        </button>
        <button
          className="navbar-link"
          onClick={() => scrollToSection("how-it-works")}
        >
          How it works
        </button>
        {isAdmin && (
          <button
            className="navbar-link"
            onClick={() => navigate("/admin")}
          >
            Manage Staff
          </button>
        )}
      </div>

      <div className="navbar-actions">
        <span className="navbar-admin">{isAdmin ? "Admin" : "Staff"}</span>
        <button className="navbar-logout" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}

export default NavBar;