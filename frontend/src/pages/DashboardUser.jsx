import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  FiCalendar, 
  FiBookOpen, 
  FiHome,
  FiLogOut,
  FiUser,
  FiPlus,
  FiChevronRight,
  FiClock,
  FiCheckCircle
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

const API_URL = process.env.REACT_APP_API_URL;

export default function DashboardUser() {
  const [approvedBookings, setApprovedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user, setUser } = useAuth(); // Changed from logout to setUser
  const navigate = useNavigate();

  useEffect(() => {
    const fetchApprovedBookings = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/booking/approved`);
        setApprovedBookings(response.data);
        setError("");
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Failed to fetch approved bookings");
      } finally {
        setLoading(false);
      }
    };

    fetchApprovedBookings();
  }, []);

  const handleLogout = () => {
    // Clear user from context
    setUser(null);
    // Remove token from localStorage if you're using it
    localStorage.removeItem("authToken");
    // Redirect to login
    navigate("/login");
  };

  const formatTime = (timeStr) => {
    return timeStr.replace(/([ap]m)/i, match => ` ${match.toUpperCase()}`);
  };

  const formatDate = (dateStr) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-poppins">
      {/* Sidebar */}
      <div className="w-64 bg-gradient-to-b from-green-700 to-green-600 shadow-xl hidden md:flex flex-col p-6 text-white">
        <div className="mb-10">
          <h2 className="text-2xl font-bold mb-1">MeetingHub</h2>
          <p className="text-green-100 text-sm">User Dashboard</p>
        </div>
        
        <nav className="flex-1 space-y-2">
          <Link 
            to="/dashboard" 
            className="flex items-center p-3 text-white bg-green-800 rounded-lg transition-all hover:bg-green-900"
          >
            <FiHome className="mr-3 text-lg" />
            <span>Dashboard</span>
          </Link>
          <Link 
            to="/my-bookings" 
            className="flex items-center p-3 text-green-100 hover:bg-green-800 rounded-lg transition-all"
          >
            <FiBookOpen className="mr-3 text-lg" />
            <span>My Bookings</span>
          </Link>
          <Link 
            to="/calendar" 
            className="flex items-center p-3 text-green-100 hover:bg-green-800 rounded-lg transition-all"
          >
            <FiCalendar className="mr-3 text-lg" />
            <span>New Booking</span>
          </Link>
        </nav>
        
        <div className="mt-auto pt-4 border-t border-green-800">
          {/* User Info Section */}
          <div className="flex items-center mb-4 p-3 bg-green-800 rounded-lg">
            <div className="p-2 bg-green-600 rounded-full mr-3">
              <FiUser className="text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">{user?.name || "User"}</p>
              <p className="text-xs text-green-200">{user?.email || "user@example.com"}</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center w-full p-3 text-green-100 hover:bg-green-800 rounded-lg transition-all"
          >
            <FiLogOut className="mr-3 text-lg" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-6">
        <header className="bg-white shadow-sm p-6 mb-6 rounded-lg">
          <h1 className="text-2xl font-bold text-gray-800">Welcome back!</h1>
          <p className="text-gray-600">Manage your meeting room bookings</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-4xl">
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-white p-6 rounded-xl shadow-md border border-gray-100"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 bg-green-100 rounded-lg mr-4 text-green-600">
                <FiBookOpen className="text-xl" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800">My Bookings</h2>
            </div>
            <p className="text-gray-600 mb-6">
              View and manage your active and upcoming bookings.
            </p>
            <Link
              to="/my-bookings"
              className="inline-flex items-center text-green-600 font-medium hover:text-green-700 transition-colors"
            >
              View Bookings <FiChevronRight className="ml-1" />
            </Link>
          </motion.div>

          <motion.div
            whileHover={{ y: -3 }}
            className="bg-white p-6 rounded-xl shadow-md border border-gray-100"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 bg-blue-100 rounded-lg mr-4 text-blue-600">
                <FiCalendar className="text-xl" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800">Availability Calendar</h2>
            </div>
            <p className="text-gray-600 mb-6">
              Check available time slots and make a booking.
            </p>
            <Link
              to="/calendar"
              className="inline-flex items-center text-blue-600 font-medium hover:text-blue-700 transition-colors"
            >
              Book a Slot <FiChevronRight className="ml-1" />
            </Link>
          </motion.div>
        </div>

        {/* Approved Bookings Section */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8 max-w-4xl">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800">Approved Bookings</h2>
          </div>
          
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500 mx-auto"></div>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-500">{error}</div>
          ) : approvedBookings.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No approved bookings found
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {approvedBookings.map((booking) => (
                <motion.div 
                  key={booking.id}
                  whileHover={{ backgroundColor: "#f9fafb" }}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-50 rounded-lg mr-4 text-blue-600">
                        <FiClock />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-800">{booking.room}</h3>
                        <p className="text-gray-500 text-sm">
                          {formatDate(booking.date)} • {formatTime(booking.time)} - {formatTime(booking.end_time)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-green-600">
                      <FiCheckCircle className="mr-1" />
                      Approved
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Booking CTA */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="bg-gradient-to-r from-green-600 to-green-500 rounded-xl shadow-lg overflow-hidden max-w-4xl"
        >
          <div className="p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">Need a room now?</h2>
                <p className="text-green-100">Quickly book available meeting spaces</p>
              </div>
              <Link
                to="/calendar"
                className="inline-flex items-center px-4 py-2 bg-white text-green-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                <FiPlus className="mr-2" />
                New Booking
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}