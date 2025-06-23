import React, { useState, useEffect, useCallback } from "react";
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
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

const API_URL = process.env.REACT_APP_API_URL;

// Optional: Create a separate skeleton component for better organization
const BookingCardSkeleton = () => (
  <div className="p-4 flex items-center animate-pulse bg-white border border-gray-100 rounded-lg shadow-sm mb-4">
    <div className="p-3 bg-gray-200 rounded-lg mr-4 h-9 w-9"></div>
    <div className="flex-1">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
    </div>
    <div className="h-4 bg-gray-200 rounded w-1/6 ml-4"></div>
  </div>
);

export default function DashboardUser() {
  const [approvedBookings, setApprovedBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextMeeting, setNextMeeting] = useState(null);
  const [upcomingBookings, setUpcomingBookings] = useState([]);

  const { user, logout, loadingAuth } = useAuth();
  const navigate = useNavigate();

  const formatTime = useCallback((time24) => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    hour = hour === 0 ? 12 : hour;
    return `${hour}:${minuteStr} ${ampm}`;
  }, []);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr || isNaN(new Date(dateStr))) {
      console.warn("Invalid date string for formatDate:", dateStr);
      return "Invalid Date";
    }
    const options = { weekday: "short", month: "short", day: "numeric" };
    return new Date(dateStr).toLocaleDateString("en-US", options);
  }, []);

  const ensureSeconds = useCallback((timeStr) => {
    if (!timeStr) return "00:00:00";
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return `${timeStr}:00`;
    }
    return timeStr;
  }, []);

  const createGoogleCalendarLink = useCallback((booking) => {
    if (!booking || !booking.date || !booking.time || !booking.end_time) {
      console.error("Missing booking details for calendar link:", booking);
      return "#";
    }

    const startTimeWithSeconds = ensureSeconds(booking.time);
    const endTimeWithSeconds = ensureSeconds(booking.end_time);

    const startDateTimeStr = `${booking.date}T${startTimeWithSeconds}`;
    const endDateTimeStr = `${booking.date}T${endTimeWithSeconds}`;

    const startTime = new Date(startDateTimeStr);
    const endTime = new Date(endDateTimeStr);

    if (isNaN(startTime.getTime())) {
      console.error("Invalid startTime Date object for GCal link:", { booking, startDateTimeStr });
      return "#";
    }
    if (isNaN(endTime.getTime())) {
      console.error("Invalid endTime Date object for GCal link:", { booking, endDateTimeStr });
      return "#";
    }

    const formatGCalTime = (date) => {
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
  }, [ensureSeconds, formatTime]);

  const getCountdown = useCallback((booking) => {
    if (!booking || !booking.date || !booking.time) return "";

    const bookingTimeWithSeconds = ensureSeconds(booking.time);
    const bookingDateTime = new Date(`${booking.date}T${bookingTimeWithSeconds}`);
    if (isNaN(bookingDateTime.getTime())) {
        console.warn("Invalid booking date/time for countdown:", booking.date, bookingTimeWithSeconds);
        return "";
    }

    const now = new Date();
    const diffMs = bookingDateTime.getTime() - now.getTime();

    if (diffMs < 0) {
      const diffMinutesSinceEnd = (now.getTime() - new Date(`${booking.date}T${ensureSeconds(booking.end_time)}`).getTime()) / (1000 * 60);
      if (diffMinutesSinceEnd < 60) {
        return "Meeting has ended recently.";
      }
      return "Meeting has started/ended.";
    }

    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;

    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `Starts in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `Starts in ${diffHours}h ${remainingMinutes}m`;
    } else if (diffMinutes > 0) {
      return `Starts in ${diffMinutes}m`;
    } else {
      return "Starting now!";
    }
  }, [ensureSeconds]);

  const fetchApprovedBookings = useCallback(async () => {
    if (loadingAuth || !user?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error("Authentication token not found.");
      }
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/booking/approved?userEmail=${user.email}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setApprovedBookings(response.data);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.response?.data?.message || "Failed to fetch approved bookings.");
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        logout();
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [user, loadingAuth, logout, navigate]);

  useEffect(() => {
    fetchApprovedBookings();
  }, [fetchApprovedBookings]);

  useEffect(() => {
  if (approvedBookings.length > 0) {
    const now = new Date();
    const upcoming = approvedBookings
      .filter(booking => {
        const bookingTime = new Date(`${booking.date}T${ensureSeconds(booking.time)}`);
        return bookingTime > now;
      })
      .sort((a, b) => {
        const timeA = new Date(`${a.date}T${ensureSeconds(a.time)}`);
        const timeB = new Date(`${b.date}T${ensureSeconds(b.time)}`);
        return timeA - timeB;
      });
    setUpcomingBookings(upcoming);
  }
}, [approvedBookings, ensureSeconds]);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

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

      {/* Main Content */}
      <div className="flex-1 p-6">
        <header className="bg-white shadow-sm p-6 mb-6 rounded-lg">
          <h1 className="text-2xl font-bold text-gray-800">
            Welcome back, {user?.name?.split(" ")[0] || "User"}!
          </h1>
          <p className="text-gray-600">Manage your meeting room bookings</p>
        </header>

        {/* New Grid Layout for cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 max-w-5xl mx-auto md:mx-0">
          {/* My Bookings Card (left/top) */}
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

          {/* Availability Calendar Card (middle/bottom-left) */}
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

          // In your DashboardUser component, update the "Your Next Meeting" card section:
<motion.div
  className="bg-white rounded-xl shadow-md p-6 border border-gray-100 md:col-span-1 lg:col-span-1"
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
  ) : upcomingBookings.length > 0 ? (
    upcomingBookings.slice(0, 1).map((booking) => (
      <div key={booking.id}>
        <p className="text-gray-700 text-lg font-medium mb-1">
          {booking.room} - {formatDate(booking.date)}
        </p>
        <p className="text-gray-600 text-md mb-2">
          <FiClock className="inline-block mr-1 text-gray-500" />
          {formatTime(booking.time)} - {formatTime(booking.end_time)}
        </p>
        <p className="text-sm text-indigo-700 font-semibold">
          {getCountdown(booking)}
        </p>
        <div className="mt-4">
          <a
            href={createGoogleCalendarLink(booking)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <FiCalendar className="mr-2" /> Add to Google Calendar
          </a>
        </div>
      </div>
    ))
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
        </div>

        {/* All Approved Bookings Section (User Specific) - Below the new grid */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8 max-w-4xl mx-auto md:mx-0">
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
          className="bg-gradient-to-r from-green-600 to-green-500 rounded-xl shadow-lg overflow-hidden max-w-4xl mx-auto md:mx-0"
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