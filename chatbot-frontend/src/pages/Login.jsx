import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { CHATBOT_API_URL } from "../config";
import Toast from "./Toast";
import "../styles/Signup.css";

function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
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

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const res = await axios.post(`${CHATBOT_API_URL}/login`, form);

      setToast({ type: "success", text: res.data.message || "Login successful!" });

      // ✅ Store user data for sidebar
      localStorage.setItem("username", res.data.username);
      localStorage.setItem("userEmail", res.data.email);
      localStorage.setItem("isLoggedIn", "true");

      // ✅ Delay navigation to let user see success toast
      setTimeout(() => {
        navigate("/chat");
      }, 1500);

    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Login failed. Please check your credentials.";
      setToast({ type: "error", text: errorMsg });
    }
  };

  return (
    <div className="signup-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit} noValidate>
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
        <button type="submit">Login</button>
        <p className="redirect-text">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </form>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default Login;

