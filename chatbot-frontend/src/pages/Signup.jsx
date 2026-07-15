import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { CHATBOT_API_URL } from "../config";
import Toast from "./Toast";
import "../styles/Signup.css";

function Signup() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: ""
  });
  const [toast, setToast] = useState(null);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    // Username validation
    if (!form.username || form.username.trim().length < 3) {
      setToast({ type: "error", text: "Username must be at least 3 characters long." });
      return false;
    }
    const usernameRegex = /^[a-zA-Z0-9_.]+$/;
    if (!usernameRegex.test(form.username)) {
      setToast({ type: "error", text: "Username can only contain letters, numbers, underscores, and periods." });
      return false;
    }

    // Email validation
    if (!form.email) {
      setToast({ type: "error", text: "Email is required." });
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setToast({ type: "error", text: "Please enter a valid email address." });
      return false;
    }

    // Password validation
    if (!form.password) {
      setToast({ type: "error", text: "Password is required." });
      return false;
    }
    if (form.password.length < 6) {
      setToast({ type: "error", text: "Password must be at least 6 characters long." });
      return false;
    }
    // Password must contain at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(form.password);
    const hasNumber = /[0-9]/.test(form.password);
    if (!hasLetter || !hasNumber) {
      setToast({ type: "error", text: "Password must contain both letters and numbers." });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const res = await axios.post(`${CHATBOT_API_URL}/signup`, form);
      setToast({ type: "success", text: res.data.message || "Signup successful!" });

      // ✅ Delay redirect to let user see success toast
      setTimeout(() => {
        navigate("/login");
      }, 1800);

    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Signup failed. Please try again.";
      setToast({ type: "error", text: errorMsg });
    }
  };

  return (
    <div className="signup-container">
      <h2>Sign Up</h2>
      <form onSubmit={handleSubmit} noValidate>
        <input
          name="username"
          placeholder="Username"
          onChange={handleChange}
          required
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          onChange={handleChange}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          onChange={handleChange}
          required
        />
        <button type="submit">Sign Up</button>
        <p className="redirect-text" style={{ textAlign: "center", marginTop: "10px" }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default Signup;

