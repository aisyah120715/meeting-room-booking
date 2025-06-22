import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'; // Added useCallback
import axios from 'axios';

const AuthContext = createContext();
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000'; // Ensure API_URL is defined

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [error, setError] = useState(null); // Added error state

  const login = useCallback(async (email, password) => {
    try {
      setLoadingAuth(true); // Set loading true at the start of login
      const response = await axios.post(`${API_URL}/api/auth/login`, { email, password });
      const { token, user: userData } = response.data;
      localStorage.setItem('authToken', token);
      setUser(userData);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error("Login failed:", err);
      setError(err.response?.data?.message || "Login failed. Please check your credentials.");
      throw err; // Re-throw to allow component to handle
    } finally {
      setLoadingAuth(false);
    }
  }, []); // No dependencies for useCallback if it doesn't use outside state/props

  const register = useCallback(async (name, email, password) => {
    try {
      setLoadingAuth(true); // Set loading true at the start of register
      const response = await axios.post(`${API_URL}/api/auth/register`, { name, email, password });
      const { token, user: userData } = response.data;
      localStorage.setItem('authToken', token);
      setUser(userData);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error("Registration failed:", err);
      setError(err.response?.data?.message || "Registration failed.");
      throw err;
    } finally {
      setLoadingAuth(false);
    }
  }, []); // No dependencies for useCallback

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    setUser(null);
    setError(null); // Clear errors on logout
  }, []); // No dependencies for useCallback

  // This useEffect fetches user data if a token exists
  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('authToken');
      if (token && !user) { // 'user' is correctly a dependency here
        try {
          setLoadingAuth(true);
          const response = await axios.get(`${API_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          setUser(response.data.user);
          setError(null); // Clear any previous errors
        } catch (err) {
          console.error("Failed to fetch user data:", err);
          localStorage.removeItem('authToken'); // Clear invalid token
          setUser(null);
          setError(err.response?.data?.message || "Session expired or invalid. Please log in again.");
        } finally {
          setLoadingAuth(false);
        }
      } else if (!token) {
         setLoadingAuth(false); // If no token, finish loading immediately
      }
    };

    checkAuthStatus();
  }, [user]); // Add user to dependencies

  const value = {
    user,
    loadingAuth,
    error, // Expose error state
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}