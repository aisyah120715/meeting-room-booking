import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // Import useNavigate here

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true); // Tracks if initial auth check is ongoing
  const navigate = useNavigate(); // Get navigate from React Router

  const API_URL = process.env.REACT_APP_API_URL;

  // Function to load user from localStorage
  const loadUserFromLocalStorage = useCallback(() => {
    try {
      const storedEmail = localStorage.getItem('userEmail');
      const storedName = localStorage.getItem('userName');
      const storedRole = localStorage.getItem('userRole');
      const authToken = localStorage.getItem('authToken'); // Assuming you store a token

      if (authToken && storedEmail && storedName && storedRole) {
        // Optionally, you might want to validate the token with your backend here
        // For simplicity, we'll assume a token means valid session for now
        setUser({ email: storedEmail, name: storedName, role: storedRole });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to load user from local storage:", error);
      setUser(null);
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    loadUserFromLocalStorage();
  }, [loadUserFromLocalStorage]); // Run once on mount

  // Login function to be exposed
  const login = useCallback(async (identifier, password, rememberMe) => {
    try {
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        identifier,
        password,
      });

      const { name, email, role, token } = res.data; // Assuming your backend sends a token

      if (!email || !name || !role || !token) {
        throw new Error("Incomplete user data or token returned from backend.");
      }

      // Store user data in context
      setUser({ name, email, role });
      // Store token (essential for authenticated requests)
      localStorage.setItem("authToken", token);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("userName", name);
      localStorage.setItem("userRole", role);

      // Save credentials if "Remember Me" is checked
      if (rememberMe) {
        localStorage.setItem("rememberedIdentifier", identifier);
        localStorage.setItem("rememberedPassword", password);
      } else {
        // Clear saved credentials if "Remember Me" is unchecked
        localStorage.removeItem("rememberedIdentifier");
        localStorage.removeItem("rememberedPassword");
      }

      // Redirect based on role within the AuthContext
      if (role === "admin") {
        navigate("/dashboard-admin");
      } else {
        navigate("/dashboard-user");
      }
      return true; // Indicate successful login
    } catch (err) {
      console.error("Login failed:", err);
      setUser(null); // Clear user on failed login
      localStorage.clear(); // Clear all auth-related storage
      throw err; // Re-throw for component to catch and display error
    }
  }, [API_URL, navigate]); // Dependencies for useCallback

  // Logout function to be exposed
  const logout = useCallback(() => {
    setUser(null);
    localStorage.clear(); // Clear all user-related data including token
    navigate("/login"); // Redirect to login page
  }, [navigate]); // Dependencies for useCallback

  const authContextValue = {
    user,
    loadingAuth,
    login, // Expose the login function
    logout, // Expose the logout function
    // If you need direct setUser, you can expose it too:
    // setUser,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};