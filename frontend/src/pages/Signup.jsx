import React, { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiUser, FiMail, FiLock, FiArrowRight } from "react-icons/fi";

const API_URL = process.env.REACT_APP_API_URL;

export default function Signup() {
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    password: "", 
    role: "user" 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simple validation
    const newErrors = {};
    if (!form.name) newErrors.name = "Name is required";
    if (!form.email) newErrors.email = "Email is required";
    if (!form.password) newErrors.password = "Password is required";
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      await axios.post(`${API_URL}/api/auth/register`, form);
      alert("Registered successfully! You can now log in.");
      navigate("/login");
    } catch (err) {
      alert(err.response?.data?.error || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="p-8 sm:p-10">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Create Account</h2>
              <p className="text-gray-600">Join us to start booking resources</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiUser className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className={`w-full pl-10 pr-3 py-3 rounded-lg border ${errors.name ? "border-red-500" : "border-gray-300"} focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent`}
                    placeholder="John Doe"
                    value={form.name}
                    onChange={handleChange}
                  />
                </div>
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div className="mb-5">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiMail className="text-gray-400" />
                  </div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className={`w-full pl-10 pr-3 py-3 rounded-lg border ${errors.email ? "border-red-500" : "border-gray-300"} focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent`}
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div className="mb-5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    className={`w-full pl-10 pr-3 py-3 rounded-lg border ${errors.password ? "border-red-500" : "border-gray-300"} focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent`}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                  />
                </div>
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
                <div className="flex space-x-4">
                  <label className="flex-1">
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      checked={form.role === "user"}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="p-4 border border-gray-300 rounded-lg cursor-pointer text-center peer-checked:border-green-500 peer-checked:bg-green-50 peer-checked:ring-1 peer-checked:ring-green-500 transition-all">
                      <span className="block font-medium">User</span>
                      <span className="block text-sm text-gray-600 mt-1">Book resources</span>
                    </div>
                  </label>
                  <label className="flex-1">
                    <input
                      type="radio"
                      name="role"
                      value="admin"
                      checked={form.role === "admin"}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="p-4 border border-gray-300 rounded-lg cursor-pointer text-center peer-checked:border-green-500 peer-checked:bg-green-50 peer-checked:ring-1 peer-checked:ring-green-500 transition-all">
                      <span className="block font-medium">Admin</span>
                      <span className="block text-sm text-gray-600 mt-1">Manage system</span>
                    </div>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold shadow-md transition duration-300 ease-in-out ${isLoading ? "opacity-70 cursor-not-allowed" : "hover:-translate-y-0.5"}`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    Register <FiArrowRight className="ml-2" />
                  </span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-green-600 hover:text-green-500 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}