import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { CHATBOT_API_URL } from "../config";
import "../styles/Signup.css";

function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(`${CHATBOT_API_URL}/login`, form);

      alert(res.data.message);

      // ✅ Store user data for sidebar
      localStorage.setItem("username", res.data.username);
      localStorage.setItem("userEmail", res.data.email);

      navigate("/chat");

    } catch (err) {
      alert(err.response?.data?.detail || "Login failed");
    }
  };

  return (
    <div className="signup-container">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
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
      </form>
    </div>
  );
}

export default Login;
