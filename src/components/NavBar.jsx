import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./NavBar.css";

function NavBar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <span className="logo-diamond" />
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
      </div>

      <div className="navbar-actions">
        <span className="navbar-admin">Admin</span>
        <button className="navbar-logout" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}

export default NavBar;