import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  FiCalendar,
  FiBookOpen,
  FiHome,
  FiLogOut,
  FiUser,
  FiClock,
  FiCheckCircle,
  FiX,
  FiEdit2,
  FiChevronRight,
  FiPlus,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

// Standard business hours (ensure these match your backend's format or are convertible)
const HOURS = [
  "8:00am",
  "9:00am",
  "10:00am",
  "11:00am",
  "12:00pm",
  "1:00pm",
  "2:00pm",
  "3:00pm",
  "4:00pm",
];

export default function MyBookings() {
  const { user, logout, loadingAuth } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [pastBookings, setPastBookings] = useState([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState(""); // "success" | "error"
  const [editingId, setEditingId] = useState(null);
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [bookedSlots, setBookedSlots] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState(null);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);

  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_API_URL;

  // --- Helper Functions (Memoized with useCallback) ---

  // Helper to convert 'HH:MM AM/PM' to 'HH:MM:00' (24-hour) for internal Date constructor use
  const timeAmPmTo24hrISO = useCallback((timeAmPm) => {
    if (!timeAmPm) return "00:00:00";
    const cleanedTime = timeAmPm.toLowerCase().replace(/\s/g, '');
    const [time, period] = cleanedTime.split(/(am|pm)/);
    let [hours, minutes] = time.split(":").map(Number);

    if (period === "pm" && hours !== 12) {
      hours += 12;
    } else if (period === "am" && hours === 12) {
      hours = 0;
    }
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  }, []);

  // Helper to convert DB's 24-hour time ('HH:MM:SS' or 'HH:MM') to 'HH:MM' for Date constructor
  const time24hrToIso = useCallback((time24hr) => {
    if (!time24hr) return "00:00";
    return time24hr.slice(0, 5); // Take first 5 chars "HH:MM"
  }, []);

  // This function converts DB's 24-hour time ('HH:MM:SS' or 'HH:MM') to your display format (e.g., "8:00am")
  const formatTimeForDisplay = useCallback((time24) => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const period = hour >= 12 ? "pm" : "am";
    hour = hour % 12;
    hour = hour === 0 ? 12 : hour; // Convert 0 (midnight) to 12 AM
    return `${hour}:${minuteStr}${period}`;
  }, []);

  // This function formats date from ISO string to display (e.g., "Sat, Jun 22")
  const formatDate = useCallback((isoDate) => {
    if (!isoDate) return "Invalid Date";
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return "Invalid Date";
    const options = { weekday: "short", month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  }, []);

  // This function converts your 'hours' array time (e.g., '8:00am') to numerical minutes for comparison
  const timeToMinutes = useCallback((timeStr) => {
    if (!timeStr) return 0;
    const cleanedTime = timeStr.toLowerCase().replace(/\s/g, '');
    const timePart = cleanedTime.split(/(am|pm)/)[0];
    const period = cleanedTime.includes("pm") ? "pm" : "am";

    let [hours, minutes] = timePart.split(":").map(Number);
    let total = hours * 60 + minutes;
    if (period === "pm" && hours !== 12) total += 12 * 60;
    if (period === "am" && hours === 12) total -= 12 * 60;
    return total;
  }, []);

  // --- Fetching Data ---

  const fetchBookings = useCallback(async () => {
  if (loadingAuth || !user?.email) {
    setIsLoadingBookings(false);
    return;
  }
  setIsLoadingBookings(true);
  setStatusMsg("");
  setStatusType(""); // Clear status messages
  try {
    const token = localStorage.getItem("authToken");
    if (!token) {
      throw new Error("Authentication token not found.");
    }
    const response = await axios.get(
      `${API_URL}/api/booking/user-bookings?email=${user.email}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const allBookings = response.data;
    const now = new Date(); // Current date and time
    
    // Create today's date at midnight for comparison
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    const upcoming = [];
    const past = [];

    allBookings.forEach((booking) => {
      // Parse booking date and time
      const bookingDate = new Date(`${booking.date}T${time24hrToIso(booking.time)}`);
      
      if (isNaN(bookingDate.getTime())) {
        console.warn("Invalid booking date encountered:", booking);
        past.push(booking); // Fallback to past if date is invalid
        return;
      }

      // Compare booking date/time with current time
      if (bookingDate >= now) {
        upcoming.push(booking);
      } else {
        past.push(booking);
      }
    });

    // Sort upcoming by earliest start time first
    upcoming.sort((a, b) => {
      const dateA = new Date(`${a.date}T${time24hrToIso(a.time)}`);
      const dateB = new Date(`${b.date}T${time24hrToIso(b.time)}`);
      if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
      return dateA.getTime() - dateB.getTime();
    });

    // Sort past by latest start time first
    past.sort((a, b) => {
      const dateA = new Date(`${a.date}T${time24hrToIso(a.time)}`);
      const dateB = new Date(`${b.date}T${time24hrToIso(b.time)}`);
      if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
      return dateB.getTime() - dateA.getTime();
    });

    setBookings(allBookings);
    setUpcomingBookings(upcoming);
    setPastBookings(past);
    setStatusType("");
    setStatusMsg("");
  } catch (error) {
    console.error("Failed to load bookings:", error);
    setStatusType("error");
    setStatusMsg(error.response?.data?.message || "Failed to load bookings.");
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      logout();
      navigate("/login");
    }
  } finally {
    setIsLoadingBookings(false);
  }
}, [user, loadingAuth, logout, navigate, time24hrToIso]);

  const fetchBookedSlots = useCallback(async (date, room) => {
    setIsLoadingSlots(true);
    setSlotError(null);
    try {
      const token = localStorage.getItem("authToken");
      const res = await axios.get(
        `${API_URL}/api/booking/slots?date=${date}&room=${room}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setBookedSlots(res.data);
    } catch (error) {
      console.error("Failed to load booked time slots:", error);
      setBookedSlots([]);
      setSlotError("Failed to load booked time slots.");
    } finally {
      setIsLoadingSlots(false);
    }
  }, [API_URL]); // Dependencies for useCallback

  useEffect(() => {
    if (!loadingAuth && user?.email) {
      fetchBookings();
    } else if (!loadingAuth && !user) {
      setIsLoadingBookings(false);
    }
  }, [loadingAuth, user, fetchBookings]);

  // --- Handlers ---

  const handleCancel = useCallback(async (id) => {
    setStatusMsg("");
    setStatusType("");
    try {
      const token = localStorage.getItem("authToken");
      await axios.post(
        `${API_URL}/api/booking/cancel`,
        { id, email: user.email },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setStatusType("success");
      setStatusMsg("Booking cancelled successfully!");
      fetchBookings();
    } catch (error) {
      console.error("Failed to cancel booking:", error);
      setStatusType("error");
      setStatusMsg(error.response?.data?.message || "Failed to cancel booking.");
    }
  }, [user, API_URL, fetchBookings]);

  const handleEdit = useCallback((booking) => {
    setNewStartTime("");
    setNewEndTime("");
    setStatusMsg("");
    setStatusType("");

    const bookingEndDateTime = new Date(`${booking.date}T${time24hrToIso(booking.end_time)}`);
    const now = new Date();
    if (isNaN(bookingEndDateTime.getTime())) {
      setStatusType("error");
      setStatusMsg("Invalid booking date/time. Cannot edit.");
      return;
    }
    // Check if the booking has already fully ended
    if (bookingEndDateTime <= now) {
      setStatusType("error");
      setStatusMsg("Past bookings cannot be edited.");
      return;
    }

    if (booking.status === "approved") {
      setStatusType("error");
      setStatusMsg("Approved bookings cannot be edited.");
      return;
    }
    if (booking.status === "cancelled") {
        setStatusType("error");
        setStatusMsg("Cancelled bookings cannot be edited.");
        return;
    }

    setEditingId(booking.id);
    setNewStartTime(formatTimeForDisplay(booking.time));
    setNewEndTime(formatTimeForDisplay(booking.end_time));
    setSelectedBooking(booking);

    fetchBookedSlots(booking.date, booking.room);
  }, [fetchBookedSlots, formatTimeForDisplay, time24hrToIso]);

  // isRangeBooked: Checks for conflicts with *all* other bookings for the same room and date
  // (both the user's other bookings and general booked slots from backend)
  const isRangeBooked = useCallback((start, end, currentBookingId) => {
    const startIndex = HOURS.indexOf(start);
    const endIndex = HOURS.indexOf(end);

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
      return true; // Invalid range implies a conflict
    }

    // Slots requested by the user, exclusive of the end time slot itself
    const newRequestedSlots = HOURS.slice(startIndex, endIndex);

    // Filter `bookings` to only include relevant conflicts (same room, same date, not the current booking, not cancelled)
    const relevantBookings = bookings.filter(b =>
      b.room === selectedBooking?.room &&
      b.date === selectedBooking?.date &&
      b.id !== currentBookingId && // Exclude the current booking being edited
      b.status !== "cancelled" // Ignore cancelled bookings
    );

    // Check for conflicts with other bookings
    const conflictFound = relevantBookings.some(existingBooking => {
      const existingStartTimeDisplay = formatTimeForDisplay(existingBooking.time);
      const existingEndTimeDisplay = formatTimeForDisplay(existingBooking.end_time);

      const existingStartIndex = HOURS.indexOf(existingStartTimeDisplay);
      const existingEndIndex = HOURS.indexOf(existingEndTimeDisplay);

      if (existingStartIndex === -1 || existingEndIndex === -1 || existingStartIndex >= existingEndIndex) {
        console.warn("Invalid existing booking time format, skipping conflict check for this booking:", existingBooking);
        return false;
      }

      const existingOccupiedSlots = HOURS.slice(existingStartIndex, existingEndIndex);

      // Check for overlap: does any requested slot exist in existing occupied slots?
      return newRequestedSlots.some(slot => existingOccupiedSlots.includes(slot));
    });

    // Additionally, check for conflicts with general booked slots from the backend (if any that are not user's current original booking)
    const originalBookingStartIndex = HOURS.indexOf(formatTimeForDisplay(selectedBooking.time));
    const originalBookingEndIndex = HOURS.indexOf(formatTimeForDisplay(selectedBooking.end_time));
    const originalBookingSlots = HOURS.slice(originalBookingStartIndex, originalBookingEndIndex);

    const generalConflict = newRequestedSlots.some(slot => {
        // A slot is conflicting if it's in `bookedSlots` AND it's NOT part of the original booking
        // This ensures the user can pick their original slot even if it's in `bookedSlots` (because it's their own)
        return bookedSlots.includes(slot) && !originalBookingSlots.includes(slot);
    });

    return conflictFound || generalConflict;
  }, [bookings, selectedBooking, bookedSlots, formatTimeForDisplay]);

  const saveEdit = useCallback(async () => {
    setStatusMsg("");
    setStatusType("");

    if (!newStartTime || !newEndTime) {
      setStatusType("error");
      setStatusMsg("Please select both start and end time.");
      return;
    }

    const startMin = timeToMinutes(newStartTime);
    const endMin = timeToMinutes(newEndTime);

    if (startMin >= endMin) {
      setStatusType("error");
      setStatusMsg("End time must be after start time.");
      return;
    }

    // Frontend validation before sending to backend
    if (isRangeBooked(newStartTime, newEndTime, editingId)) {
      setStatusType("error");
      setStatusMsg("Selected time slot conflicts with an existing booking or is unavailable.");
      return;
    }

    const payload = {
      id: editingId,
      newTime: timeAmPmTo24hrISO(newStartTime), // Convert to 24-hour ISO format for backend
      newEndTime: timeAmPmTo24hrISO(newEndTime), // Convert to 24-hour ISO format for backend
      date: selectedBooking.date,
      room: selectedBooking.room,
      userEmail: user.email,
    };

    try {
      const token = localStorage.getItem("authToken");
      await axios.post(`${API_URL}/api/booking/edit`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setStatusType("success");
      setStatusMsg("Booking updated successfully! Please note: new bookings might require Admin Approval.");
      setEditingId(null);
      setNewStartTime("");
      setNewEndTime("");
      setSelectedBooking(null);
      fetchBookings(); // Re-fetch all bookings
    } catch (error) {
      console.error("Failed to edit booking:", error);
      setStatusType("error");
      setStatusMsg(error.response?.data?.error || "Failed to edit booking. Please try again.");
    }
  }, [newStartTime, newEndTime, editingId, selectedBooking, user, API_URL, timeToMinutes, isRangeBooked, timeAmPmTo24hrISO, fetchBookings]);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  // --- Render Function ---

  const renderBookingCards = useCallback((bookingsToRender) => {
    if (!bookingsToRender.length) {
      return (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
          No bookings to display.
        </div>
      );
    }
    return bookingsToRender.map((b) => (
      <motion.div
        key={b.id}
        className="bg-white rounded-xl shadow-sm overflow-hidden"
        whileHover={{ y: -2 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center">
              <div className="p-3 bg-blue-50 rounded-lg mr-4 text-blue-600">
                <FiClock className="text-lg" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">
                  {b.room}
                </h3>
                <p className="text-gray-600 mt-1">
                  {formatDate(b.date)} • {formatTimeForDisplay(b.time)} -{" "}
                  {formatTimeForDisplay(b.end_time)}
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                b.status === "approved"
                  ? "bg-green-100 text-green-800"
                  : b.status === "cancelled"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
            </span>
          </div>

          {editingId === b.id ? (
            <div className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
                    value={newStartTime}
                    onChange={(e) => {
                      setNewStartTime(e.target.value);
                      setNewEndTime(""); // Reset end time when start time changes
                    }}
                  >
                    <option value="">Select start time</option>
                    {HOURS.map((h) => {
                      const isBooked = bookedSlots.includes(h);
                      const isCurrentStart = h === formatTimeForDisplay(b.time);

                      // Check if this time slot (h) on the booking's date is in the past
                      const timeToCheck = new Date(`${b.date}T${timeAmPmTo24hrISO(h)}`);
                      const isPast = timeToCheck <= new Date();

                      return (
                        <option
                          key={h}
                          value={h}
                          // Disable if it's booked and not the current start time, OR if it's in the past
                          disabled={(isBooked && !isCurrentStart) || isPast}
                          className={((isBooked && !isCurrentStart) || isPast) ? "text-gray-400" : ""}
                        >
                          {formatTimeForDisplay(h)}
                          {isBooked && !isCurrentStart && " (Booked)"}
                          {isPast && " (Past)"}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    disabled={!newStartTime}
                  >
                    <option value="">Select end time</option>
                    {HOURS.map((h, index) => {
                      const startTimeIndex = HOURS.indexOf(newStartTime);
                      const isAfterStart = startTimeIndex !== -1 && index > startTimeIndex;
                      if (!isAfterStart) return null; // Only show times after the selected start time

                      const isCurrentEnd = h === formatTimeForDisplay(b.end_time);

                      // Check if the _entire range_ from newStartTime to h is available
                      const potentialNewRange = HOURS.slice(startTimeIndex, index); // End time is exclusive for slots
                      const isRangeAvailable = potentialNewRange.every(slot => {
                        const isSlotBooked = bookedSlots.includes(slot);
                        // Check if the slot is part of the original booking's duration
                        const originalBookingStartIndex = HOURS.indexOf(formatTimeForDisplay(b.time));
                        const originalBookingEndIndex = HOURS.indexOf(formatTimeForDisplay(b.end_time));
                        const isSlotPartOfOriginalBooking = (
                            HOURS.indexOf(slot) >= originalBookingStartIndex &&
                            HOURS.indexOf(slot) < originalBookingEndIndex
                        );
                        return !isSlotBooked || isSlotPartOfOriginalBooking;
                      });

                      // Check if this time slot (h) on the booking's date is in the past
                      const timeToCheck = new Date(`${b.date}T${timeAmPmTo24hrISO(h)}`);
                      const isPast = timeToCheck <= new Date();

                      return (
                        <option
                          key={h}
                          value={h}
                          // Disable if any part of the new range is unavailable AND it's not the current booking's end time, OR if in the past
                          disabled={(!isRangeAvailable && !isCurrentEnd) || isPast}
                          className={((!isRangeAvailable && !isCurrentEnd) || isPast) ? "text-gray-400" : ""}
                        >
                          {formatTimeForDisplay(h)}
                          {(!isRangeAvailable && !isCurrentEnd) && " (Unavailable)"}
                          {isPast && " (Past)"}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {isLoadingSlots && (
                <div className="mt-2 text-sm text-gray-500 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                  Loading available times...
                </div>
              )}
              {slotError && (
                <div className="mt-2 text-sm text-red-500">{slotError}</div>
              )}

              <div className="mt-4 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setEditingId(null);
                    setNewStartTime("");
                    setNewEndTime("");
                    setSelectedBooking(null);
                    setStatusMsg(""); // Clear status on cancel
                    setStatusType("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors flex items-center"
                >
                  <FiCheckCircle className="mr-2" />
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => handleEdit(b)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center ${
                  // Disable if approved OR if the booking's end time is in the past OR if cancelled
                  b.status === "approved" || new Date(`${b.date}T${time24hrToIso(b.end_time)}`) <= new Date() || b.status === "cancelled"
                    ? "bg-gray-300 text-gray cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                } transition-colors`}
                disabled={b.status === "approved" || new Date(`${b.date}T${time24hrToIso(b.end_time)}`) <= new Date() || b.status === "cancelled"}
              >
                <FiEdit2 className="mr-2" />
                Edit
              </button>
              <button
                onClick={() => handleCancel(b.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center ${
                  // Disable if cancelled OR if the booking's end time is in the past
                  b.status === "cancelled" || new Date(`${b.date}T${time24hrToIso(b.end_time)}`) <= new Date()
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700"
                } transition-colors`}
                disabled={b.status === "cancelled" || new Date(`${b.date}T${time24hrToIso(b.end_time)}`) <= new Date()}
              >
                <FiX className="mr-2" />
                Cancel Booking
              </button>
            </div>
          )}
        </div>
      </motion.div>
    ));
  }, [editingId, newStartTime, newEndTime, bookedSlots, isLoadingSlots, slotError, saveEdit, handleEdit, handleCancel, formatDate, formatTimeForDisplay, timeAmPmTo24hrISO, time24hrToIso]);

  // --- Main Render ---
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
            className="flex items-center p-3 text-green-100 hover:bg-green-800 rounded-lg transition-all"
          >
            <FiHome className="mr-3 text-lg" />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/my-bookings"
            className="flex items-center p-3 text-white bg-green-800 rounded-lg transition-all hover:bg-green-900"
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
            className="flex items-center w-full p-3 text-green-100 hover:bg-green-800 rounded-lg transition-all mt-2"
            onClick={handleLogout}
          >
            <FiLogOut className="mr-3 text-lg" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <header className="bg-white shadow-sm p-6 mb-6 rounded-lg">
          <h1 className="text-2xl font-bold text-gray-800">My Bookings</h1>
          <p className="text-gray-600">
            View and manage your active and upcoming bookings
          </p>
        </header>

        {statusMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-lg ${
              statusType === "success"
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            {statusMsg}
          </motion.div>
        )}

        {isLoadingBookings ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
            <p className="ml-3 text-gray-700">Loading your bookings...</p>
          </div>
        ) : (bookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-2xl mx-auto">
            <div className="mx-auto h-16 w-16 text-gray-400 mb-4">
              <FiCalendar className="w-full h-full" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              No bookings yet
            </h3>
            <p className="mt-1 text-gray-500 mb-6">
              You haven't made any bookings yet.
            </p>
            <Link
              to="/calendar"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              <FiPlus className="mr-2" />
              Book a Room
            </Link>
          </div>
        ) : (
          <div className="space-y-8 max-w-4xl">
            {/* Upcoming Bookings Section */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <FiChevronRight className="text-green-600 mr-2" /> Upcoming
                Bookings ({upcomingBookings.length})
              </h2>
              <div className="grid grid-cols-1 gap-6">
                {renderBookingCards(upcomingBookings)}
              </div>
            </div>

            {/* Past Bookings Section */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <FiChevronRight className="text-blue-600 mr-2" /> Past Bookings
                ({pastBookings.length})
              </h2>
              <div className="grid grid-cols-1 gap-6">
                {renderBookingCards(pastBookings)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}