import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import "../styles/navbar.css";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isLoggedIn = localStorage.getItem("isLoggedIn");

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("userEmail");
    localStorage.removeItem("isLoggedIn");
    navigate("/");
  };

  return (
    <>
      <header className="navbar">
        {/* LEFT: Hamburger + Logo */}
        <div className="nav-left">
          <button
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>

          <div className="nav-logo">
            <h1 className="nav-title">TTS</h1>
          </div>
        </div>

        {/* CENTER / RIGHT: Navigation */}
        <nav className={`navbar-links ${menuOpen ? "active" : ""}`}>
          <Link to="/" className={location.pathname === "/" ? "active" : ""}>
            Home
          </Link>

          <Link
            to="/allocation"
            className={location.pathname === "/allocation" ? "active" : ""}
          >
            Allocation
          </Link>

          <Link
            to="/chat"
            className={location.pathname === "/chat" ? "active" : ""}
          >
            Calculation
          </Link>

          <Link
            to="/report"
            className={location.pathname === "/report" ? "active" : ""}
          >
            Reports
          </Link>

          <Link
            to="/comparison"
            className={location.pathname === "/comparison" ? "active" : ""}
          >
            Comparison
          </Link>

          {/* AUTH SECTION */}
          {!isLoggedIn ? (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup">Signup</Link>
            </>
          ) : (
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          )}
        </nav>
      </header>
    </>
  );
}
