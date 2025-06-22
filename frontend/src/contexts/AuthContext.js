import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios'; // Assuming you use axios for API calls

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Initialize user from localStorage or null if not found
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      return null;
    }
  });
  const [loadingAuth, setLoadingAuth] = useState(true); // New state to indicate auth loading

  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem('authToken');
      if (token && !user) {
        // If a token exists but user isn't in state (e.g., after refresh),
        // try to fetch user details to re-hydrate the state.
        try {
          // Adjust this API endpoint to your user details endpoint
          const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const fetchedUser = response.data.user; // Adjust based on your API response structure
          setUser(fetchedUser);
          localStorage.setItem('user', JSON.stringify(fetchedUser));
        } catch (error) {
          console.error("Failed to fetch user data with token", error);
          // If token is invalid or fetching fails, clear it
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoadingAuth(false); // Auth loading is complete
    };

    checkAuthStatus();
  }, []); // Run once on mount

  // Whenever the user state changes, update localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('authToken', token); // Store token
    localStorage.setItem('user', JSON.stringify(userData)); // Store user data
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, setUser: login, logout, loadingAuth }}> {/* Expose loadingAuth */}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);