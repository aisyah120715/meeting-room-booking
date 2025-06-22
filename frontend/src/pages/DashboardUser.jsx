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
  FiCheckCircle,
  FiArrowRight,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

const API_URL = process.env.REACT_APP_API_URL;

// ... (BookingCardSkeleton component remains the same) ...

export default function DashboardUser() {
  const [approvedBookings, setApprovedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextMeeting, setNextMeeting] = useState(null);

  const { user, login: setUser, logout, loadingAuth } = useAuth(); // Destructure loadingAuth and rename setUser to login
  const navigate = useNavigate();

  // ... (formatTime, formatDate, createGoogleCalendarLink, getCountdown remain the same) ...

  useEffect(() => {
    const fetchApprovedBookings = async () => {
      // If auth is still loading, wait.
      if (loadingAuth) {
        return;
      }

      // If auth is done loading and no user or user email, set error and stop.
      if (!user?.email) {
        setLoading(false);
        setError("User not logged in or email not available.");
        return;
      }

      try {
        setLoading(true); // Start loading when fetch begins
        const response = await axios.get(
          `${API_URL}/api/booking/approved?userEmail=${user.email}`
        );
        setApprovedBookings(response.data);
        setError("");
      } catch (err) {
        console.error("Fetch error:", err);
        // More specific error message if the API returns one
        setError(err.response?.data?.message || "Failed to fetch approved bookings");
      } finally {
        setLoading(false); // Stop loading after fetch
      }
    };

    fetchApprovedBookings();
  }, [user, loadingAuth]); // Add loadingAuth to dependency array

  // Effect to determine the next upcoming meeting (remains largely the same)
  useEffect(() => {
    if (!loadingAuth && user && approvedBookings.length > 0) { // Ensure auth is done loading
      const now = new Date();
      const userUpcomingBookings = approvedBookings
        .filter((booking) => {
          const bookingDateTime = new Date(`${booking.date}T${booking.time}`);
          return bookingDateTime > now;
        })
        .sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.time}`);
          const dateB = new Date(`${b.date}T${b.time}`);
          return dateA - dateB;
        });
      setNextMeeting(userUpcomingBookings[0] || null);
    } else if (!loadingAuth && !user) { // If auth is done and no user, no next meeting
      setNextMeeting(null);
    }
  }, [user, approvedBookings, loadingAuth]); // Add loadingAuth to dependency array

  const handleLogout = () => {
    logout(); // Use the logout function from context
    navigate("/login");
  };

  if (loadingAuth) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
        <p className="ml-3 text-gray-700">Loading user data...</p>
      </div>
    );
  }

  // Rest of your JSX remains the same
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
            to="/dashboard-user"
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
              <p className="text-xs text-green-200">
                {user?.email || "user@example.com"}
              </p>
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
          <h1 className="text-2xl font-bold text-gray-800">
            Welcome back, {user?.name?.split(" ")[0] || "User"}!
          </h1>
          <p className="text-gray-600">Manage your meeting room bookings</p>
        </header>

        {/* Your Next Meeting Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-md p-6 mb-8 max-w-4xl border border-gray-100"
        >
          <div className="flex items-center mb-4">
            <div className="p-3 bg-indigo-100 rounded-lg mr-4 text-indigo-600">
              <FiCalendar className="text-xl" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">
              Your Next Meeting
            </h2>
          </div>

          {loading ? (
            <div className="py-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading next meeting...</p>
            </div>
          ) : nextMeeting ? (
            <div>
              <p className="text-gray-700 text-lg font-medium mb-1">
                {nextMeeting.room} - {formatDate(nextMeeting.date)}
              </p>
              <p className="text-gray-600 text-md mb-2">
                <FiClock className="inline-block mr-1 text-gray-500" />
                {formatTime(nextMeeting.time)} -{" "}
                {formatTime(nextMeeting.end_time)}
              </p>
              <p className="text-sm text-indigo-700 font-semibold">
                {getCountdown(nextMeeting)}
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-4">
                No upcoming meetings scheduled for you.
              </p>
              <Link
                to="/calendar"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                <FiPlus className="mr-2" /> Book one now!
              </Link>
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-4xl">
          <motion.div
            whileHover={{ y: -3 }}
            className="bg-white p-6 rounded-xl shadow-md border border-gray-100"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 bg-green-100 rounded-lg mr-4 text-green-600">
                <FiBookOpen className="text-xl" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800">
                My Bookings
              </h2>
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
              <h2 className="text-xl font-semibold text-gray-800">
                Availability Calendar
              </h2>
            </div>
            <p className="text-gray-600 mb-6">
              Check available time slots and make a new booking.
            </p>
            <Link
              to="/calendar"
              className="inline-flex items-center text-blue-600 font-medium hover:text-blue-700 transition-colors"
            >
              Book a Slot <FiChevronRight className="ml-1" />
            </Link>
          </motion.div>
        </div>

        {/* All Approved Bookings Section (User Specific) */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8 max-w-4xl">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800">
              All My Approved Bookings
            </h2>
            <p className="text-sm text-gray-600">
              Showing all approved bookings you have made.
            </p>
          </div>

          {loading ? (
            <div className="p-6">
              <BookingCardSkeleton />
              <BookingCardSkeleton />
              <BookingCardSkeleton />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-500">{error}</div>
          ) : approvedBookings.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No approved bookings found for your account.
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
                        <h3 className="font-medium text-gray-800">
                          {booking.room}
                        </h3>
                        <p className="text-gray-500 text-sm">
                          {formatDate(booking.date)} •{" "}
                          {formatTime(booking.time)} -{" "}
                          {formatTime(booking.end_time)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="flex items-center text-sm text-green-600 mr-3">
                        <FiCheckCircle className="mr-1" />
                        Approved
                      </div>
                      <a
                        href={createGoogleCalendarLink(booking)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm"
                        title="Add to Google Calendar"
                      >
                        <FiCalendar className="mr-1" /> Add to Cal
                      </a>
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
                <p className="text-green-100">
                  Quickly book available meeting spaces
                </p>
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