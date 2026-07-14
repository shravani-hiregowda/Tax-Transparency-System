import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { CHATBOT_API_URL } from "../config";
import "../styles/Signup.css";

function Signup() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: ""
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post(`${CHATBOT_API_URL}/signup`, form);
      alert(res.data.message);

      // ✅ After signup go to login page
      navigate("/login");

    } catch (err) {
      alert(err.response?.data?.detail || "Signup failed");
    }
  };

  return (
    <div className="signup-container">
      <h2>Sign Up</h2>
      <form onSubmit={handleSubmit}>
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
      </form>
    </div>
  );
}

export default Signup;
