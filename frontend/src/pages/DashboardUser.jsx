import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
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
  // FiArrowRight, // Removed as it was unused
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

const API_URL = process.env.REACT_APP_API_URL;

// Optional: Create a separate skeleton component for better organization
// This component should be defined OUTSIDE or ABOVE the main functional component
const BookingCardSkeleton = () => (
  <div className="p-4 flex items-center animate-pulse bg-white border border-gray-100 rounded-lg shadow-sm mb-4">
    <div className="p-3 bg-gray-200 rounded-lg mr-4 h-9 w-9"></div>{" "}
    {/* Icon placeholder */}
    <div className="flex-1">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>{" "}
      {/* Title placeholder */}
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>{" "}
      {/* Subtitle placeholder */}
    </div>
    <div className="h-4 bg-gray-200 rounded w-1/6 ml-4"></div>{" "}
    {/* Status placeholder */}
  </div>
);

export default function DashboardUser() {
  const [approvedBookings, setApprovedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextMeeting, setNextMeeting] = useState(null);

  const { user, logout, loadingAuth } = useAuth(); // Removed setUser as it was unused
  const navigate = useNavigate();

  // Helper to format 24hr time from backend to am/pm for display
  const formatTime = useCallback((time24) => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    hour = hour === 0 ? 12 : hour; // Convert 0 (midnight) to 12 AM
    return `${hour}:${minuteStr} ${ampm}`;
  }, []); // No dependencies, so can be memoized

  const formatDate = useCallback((dateStr) => {
    // Add a check to ensure dateStr is valid before creating Date object
    if (!dateStr || isNaN(new Date(dateStr))) {
        console.warn("Invalid date string for formatDate:", dateStr);
        return "Invalid Date"; // Or handle as appropriate
    }
    const options = { weekday: "short", month: "short", day: "numeric" };
    return new Date(dateStr).toLocaleDateString("en-US", options);
  }, []); // No dependencies, so can be memoized


  // Helper to ensure time string includes seconds for consistent Date parsing
  // This helps prevent 'Invalid time value' if backend times are inconsistent (e.g., "HH:MM" vs "HH:MM:SS")
  const ensureSeconds = useCallback((timeStr) => {
    if (!timeStr) return "00:00:00"; // Default to a safe value
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return `${timeStr}:00`; // Append seconds if missing
    }
    return timeStr; // Already has seconds or is malformed, Date() will handle it
  }, []); // No dependencies, so can be memoized


  // Helper function to create Google Calendar event link
  const createGoogleCalendarLink = useCallback((booking) => {
    if (!booking || !booking.date || !booking.time || !booking.end_time) {
      console.error("Missing booking details for calendar link:", booking);
      return "#";
    }

    // Use the helper to ensure consistent time format with seconds
    const startTimeWithSeconds = ensureSeconds(booking.time);
    const endTimeWithSeconds = ensureSeconds(booking.end_time);

    // Combine date and time for Date objects
    const startDateTimeStr = `${booking.date}T${startTimeWithSeconds}`;
    const endDateTimeStr = `${booking.date}T${endTimeWithSeconds}`;

    const startTime = new Date(startDateTimeStr);
    const endTime = new Date(endDateTimeStr);

    // IMPORTANT: Check if Date objects are valid before calling .toISOString()
    if (isNaN(startTime.getTime())) {
      console.error("Invalid startTime Date object for GCal link:", { booking, startDateTimeStr });
      return "#"; // Return a safe link to prevent error
    }
    if (isNaN(endTime.getTime())) {
      console.error("Invalid endTime Date object for GCal link:", { booking, endDateTimeStr });
      return "#"; // Return a safe link to prevent error
    }

    // Google Calendar expects times in 'YYYYMMDDTHHMMSS' format (Zulu time if no timezone specified)
    // We'll use UTC/Zulu time for consistency.
    const formatGCalTime = (date) => {
      // .toISOString() will return something like "2025-06-23T08:00:00.000Z"
      // We slice it to get "20250623T080000" and append "Z"
      return date.toISOString().replace(/-|:|\.\d{3}/g, "").slice(0, 15) + "Z";
    };

    const details = encodeURIComponent(
      `Meeting in ${booking.room} from ${formatTime(
        booking.time
      )} to ${formatTime(booking.end_time)}.`
    );
    const location = encodeURIComponent(booking.room);
    const title = encodeURIComponent(`Meeting in ${booking.room}`);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGCalTime(
      startTime
    )}/${formatGCalTime(
      endTime
    )}&details=${details}&location=${location}&sf=true&output=xml`;
  }, [ensureSeconds, formatTime]); // Dependencies for useCallback

  // Helper for countdown (e.g., "Starts in 30 minutes")
  const getCountdown = useCallback((booking) => {
    if (!booking || !booking.date || !booking.time) return "";

    const bookingDateTime = new Date(`${booking.date}T${booking.time}`);
    if (isNaN(bookingDateTime.getTime())) {
        console.warn("Invalid booking date/time for countdown:", booking.date, booking.time);
        return "";
    }

    const now = new Date();
    const diffMs = bookingDateTime.getTime() - now.getTime();

    if (diffMs < 0) return "Meeting has started!"; // Already passed or starting

    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;

    if (diffHours > 0) {
      return `Starts in ${diffHours}h ${remainingMinutes}m`;
    } else if (diffMinutes > 0) {
      return `Starts in ${diffMinutes}m`;
    } else {
      return "Starting soon!";
    }
  }, []); // No dependencies, so can be memoized


  const fetchApprovedBookings = useCallback(async () => {
    if (loadingAuth) {
      return;
    }
    if (!user?.email) {
      setLoading(false);
      setError("User not logged in or email not available.");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await axios.get(
        `${API_URL}/api/booking/approved?userEmail=${user.email}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setApprovedBookings(response.data);
      setError("");
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.response?.data?.message || "Failed to fetch approved bookings");
    } finally {
      setLoading(false);
    }
  }, [user, loadingAuth]); // Dependencies for useCallback

  useEffect(() => {
    fetchApprovedBookings();
  }, [fetchApprovedBookings]); // Added fetchApprovedBookings as dependency


  useEffect(() => {
    if (!loadingAuth && user && approvedBookings.length > 0) {
      const now = new Date();
      const userUpcomingBookings = approvedBookings
        .filter((booking) => {
          const bookingDateTime = new Date(`${booking.date}T${booking.time}`);
          // Ensure the date object is valid before comparing
          return !isNaN(bookingDateTime.getTime()) && bookingDateTime.getTime() > now.getTime();
        })
        .sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.time}`);
          const dateB = new Date(`${b.date}T${b.time}`);
          // Ensure both date objects are valid before comparing
          if (isNaN(dateA.getTime())) return 1; // Push invalid dates to the end
          if (isNaN(dateB.getTime())) return -1; // Push invalid dates to the end
          return dateA.getTime() - dateB.getTime();
        });
      setNextMeeting(userUpcomingBookings[0] || null);
    } else if (!loadingAuth && !user) {
      setNextMeeting(null);
    }
  }, [user, approvedBookings, loadingAuth]);

  const handleLogout = () => {
    logout();
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
                      {/* Check if createGoogleCalendarLink returns a valid link */}
                      {createGoogleCalendarLink(booking) !== "#" && (
                        <a
                          href={createGoogleCalendarLink(booking)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm"
                          title="Add to Google Calendar"
                        >
                          <FiCalendar className="mr-1" /> Add to Cal
                        </a>
                      )}
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