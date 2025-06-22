import React, { useEffect, useState } from "react";
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
  FiXCircle,
  FiEdit2,
  FiX,
  FiChevronRight,
  FiPlus,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function MyBookings() {
  const { user, setUser } = useAuth(); // Added setUser for logout
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

  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_API_URL;

  // Standard business hours (ensure these match your backend's format or are convertible)
  const hours = [
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

  useEffect(() => {
    if (user?.email) fetchBookings();
  }, [user]);

  const fetchBookings = () => {
    axios
      .get(`${API_URL}/api/booking/user-bookings?email=${user.email}`)
      .then((res) => {
        const allBookings = res.data;
        const now = new Date(); // Current date and time (e.g., June 22, 2025, 10:16 PM)

        const upcoming = [];
        const past = [];

        allBookings.forEach((booking) => {
          // IMPORTANT: Construct Date objects with both date AND time for accurate comparison
          // Assuming booking.date is 'YYYY-MM-DD' and booking.end_time is 'HH:MM' (24-hour format from backend)
          const bookingEndDateTime = new Date(`${booking.date}T${time24hrToIso(booking.end_time)}`);

          // Compare the booking's end time with the current time
          if (bookingEndDateTime > now) { // If the booking's end time is in the future
            upcoming.push(booking);
          } else { // If the booking's end time is in the past or exactly now
            past.push(booking);
          }
        });

        // Sort upcoming bookings by date and time ascending
        upcoming.sort((a, b) => {
          const dateA = new Date(`${a.date}T${time24hrToIso(a.time)}`);
          const dateB = new Date(`${b.date}T${time24hrToIso(b.time)}`);
          return dateA - dateB;
        });

        // Sort past bookings by date and time descending
        past.sort((a, b) => {
          const dateA = new Date(`${a.date}T${time24hrToIso(a.time)}`);
          const dateB = new Date(`${b.date}T${time24hrToIso(b.time)}`);
          return dateB - dateA;
        });

        setBookings(allBookings); // Keep all bookings for edit/cancel logic
        setUpcomingBookings(upcoming);
        setPastBookings(past);
      })
      .catch((error) => {
        console.error("Failed to load bookings:", error);
        setStatusType("error");
        setStatusMsg("Failed to load bookings.");
      });
  };

  // Helper to convert 'HH:MM AM/PM' to 'HH:MM:00' (24-hour) for Date constructor
  const timeAmPmTo24hr = (timeAmPm) => {
    if (!timeAmPm) return "00:00:00";
    const [time, period] = timeAmPm.split(/(am|pm)/i);
    let [hours, minutes] = time.split(":").map(Number);
    const lowerPeriod = period?.toLowerCase();

    if (lowerPeriod === "pm" && hours !== 12) {
        hours += 12;
    } else if (lowerPeriod === "am" && hours === 12) {
        hours = 0; // 12 AM is 00 hours
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  };

  // Helper to convert 'HH:MM:SS' (from DB) to 'HH:MM' for Date constructor
  // Or directly to HH:MM if DB is already HH:MM
  const time24hrToIso = (time24hr) => {
    if (!time24hr) return "00:00";
    // Assuming backend time is HH:MM:SS or HH:MM. We need HH:MM for Date constructor with T
    return time24hr.slice(0, 5); // Take first 5 chars "HH:MM"
  }


  const fetchBookedSlots = (date, room) => {
    setIsLoadingSlots(true);
    setSlotError(null);
    axios
      .get(`${API_URL}/api/booking/slots?date=${date}&room=${room}`)
      .then((res) => {
        // The backend `getSlotRange` returns slots like "8:00am", "9:00am".
        // Ensure this matches the `hours` array directly.
        setBookedSlots(res.data);
      })
      .catch((error) => {
        console.error("Failed to load booked time slots:", error);
        setBookedSlots([]);
        setSlotError("Failed to load booked time slots");
      })
      .finally(() => setIsLoadingSlots(false));
  };

  // This function converts DB's 24-hour time to your display format (e.g., "8:00am")
  const formatTimeForDisplay = (time24) => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const period = hour >= 12 ? "pm" : "am";
    hour = hour % 12;
    hour = hour === 0 ? 12 : hour; // Convert 0 (midnight) to 12 AM
    return `${hour}:${minuteStr}${period}`;
  };

  const handleCancel = (id) => {
    axios
      .post(`${API_URL}/api/booking/cancel`, { id, email: user.email })
      .then(() => {
        setStatusType("success");
        setStatusMsg("Booking cancelled successfully!");
        fetchBookings();
      })
      .catch((error) => {
        console.error("Failed to cancel booking:", error);
        setStatusType("error");
        setStatusMsg("Failed to cancel booking.");
      });
  };

  const handleEdit = (booking) => {
    // Check if the booking's end time has already passed
    const bookingEndDateTime = new Date(`${booking.date}T${time24hrToIso(booking.end_time)}`);
    const now = new Date();
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

    setEditingId(booking.id);
    setNewStartTime(formatTimeForDisplay(booking.time));
    setNewEndTime(formatTimeForDisplay(booking.end_time));
    setSelectedBooking(booking);

    // Always fetch booked slots for the chosen date and room when editing
    fetchBookedSlots(booking.date, booking.room);
  };

  const isRangeBooked = (start, end, currentBookingId) => {
    const startIndex = hours.indexOf(start);
    const endIndex = hours.indexOf(end);

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
      return true; // Invalid range, consider it booked to prevent errors
    }

    // Get all slots covered by the *new* requested range
    const newRequestedSlots = hours.slice(startIndex, endIndex); // Exclusive end for slots

    // Now, iterate through ALL current user's bookings (except the one being edited)
    // to check for conflicts, regardless of their status (pending/approved)
    const conflictFound = bookings.some((booking) => {
      // Exclude the current booking being edited
      if (booking.id === currentBookingId) return false;

      // Only check against bookings for the same room and date that are NOT cancelled
      if (
        booking.room !== selectedBooking.room ||
        booking.date !== selectedBooking.date ||
        booking.status === "cancelled"
      ) {
        return false;
      }

      // Convert backend 24-hour times to your `hours` array format for comparison
      const existingBookingStart = formatTimeForDisplay(booking.time);
      const existingBookingEnd = formatTimeForDisplay(booking.end_time);

      const existingStartIndex = hours.indexOf(existingBookingStart);
      const existingEndIndex = hours.indexOf(existingBookingEnd);

      if (existingStartIndex === -1 || existingEndIndex === -1) {
          console.warn("Invalid existing booking time format:", booking.time, booking.end_time);
          return false; // Skip if existing booking times are malformed
      }

      const existingOccupiedSlots = hours.slice(existingStartIndex, existingEndIndex);

      // Check if any slot in the new requested range overlaps with existing occupied slots
      return newRequestedSlots.some(slot => existingOccupiedSlots.includes(slot));
    });

    // Additionally, check against the `bookedSlots` fetched from the backend,
    // which represent all booked slots for that room and date (regardless of user).
    // This is crucial for preventing conflicts with other users' bookings.
    const conflictWithOtherBookings = newRequestedSlots.some(slot => bookedSlots.includes(slot));

    return conflictFound || conflictWithOtherBookings;
  };


  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;

    // This helper now assumes the input `timeStr` is already in "H:MMam/pm" format
    const timePart = timeStr.split(/(am|pm)/i)[0];
    const period = timeStr.toLowerCase().includes("pm") ? "pm" : "am";

    const [hours, minutes] = timePart.split(":").map(Number);
    let total = hours * 60 + minutes;
    if (period === "pm" && hours !== 12) total += 12 * 60;
    if (period === "am" && hours === 12) total -= 12 * 60;
    return total;
  };

  const saveEdit = () => {
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

    // Pass the actual booking object's date and room for backend check
    const payload = {
      id: editingId,
      newTime: newStartTime, // Send in the format the backend expects (e.g., "8:00am")
      newEndTime: newEndTime, // Send in the format the backend expects
      date: selectedBooking.date, // Pass original booking date
      room: selectedBooking.room, // Pass original booking room
      userEmail: user.email, // Pass user email for backend validation
    };

    // Frontend validation before sending to backend
    if (isRangeBooked(newStartTime, newEndTime, editingId)) {
      setStatusType("error");
      setStatusMsg("Selected time slot conflicts with an existing booking.");
      return;
    }

    axios
      .post(`${API_URL}/api/booking/edit`, payload)
      .then(() => {
        setStatusType("success");
        setStatusMsg("Booking updated successfully! Pending Admin Approval.");
        setEditingId(null);
        setNewStartTime("");
        setNewEndTime("");
        setSelectedBooking(null); // Clear selected booking
        fetchBookings(); // Re-fetch all bookings
      })
      .catch((error) => {
        console.error("Failed to edit booking:", error);
        setStatusType("error");
        // Check if the error response has a specific message from backend
        if (error.response && error.response.data && error.response.data.error) {
            setStatusMsg(error.response.data.error);
        } else {
            setStatusMsg("Failed to edit booking. Please try again.");
        }
      });
  };

  const formatDate = (isoDate) => {
    const date = new Date(isoDate);
    // Ensure the date is interpreted as local time or explicitly convert
    // For consistency, often best to parse as UTC and then display as local
    const options = { weekday: "short", month: "short", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  // This function formats time from your 'hours' array (e.g., '8:00am') to display
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    // Assuming timeStr is already in "H:MMam/pm" format from the `hours` array or `formatTimeForDisplay`
    // Ensure consistent casing for AM/PM if needed, e.g., "8:00AM" vs "8:00am"
    const [time, period] = timeStr.split(/(am|pm)/i);
    return `${time}${period?.toUpperCase() || ''}`; // Ensure uppercase AM/PM
  };

  const handleLogout = () => {
    setUser(null); // Clear user from context
    localStorage.removeItem("authToken"); // Remove token if used
    navigate("/login");
  };


  // Helper function to render booking cards
  const renderBookingCards = (bookingsToRender) => {
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
                    {hours.map((h) => {
                      // isDisabled checks if this hour slot (h) is part of a booked range *not* including the current booking
                      const isBooked = bookedSlots.includes(h);
                      const isCurrentStart = h === formatTimeForDisplay(b.time);

                      return (
                        <option
                          key={h}
                          value={h}
                          disabled={isBooked && !isCurrentStart} // Disable if booked and not the current booking's start
                          className={
                            isBooked && !isCurrentStart
                              ? "text-gray-400"
                              : ""
                          }
                        >
                          {formatTime(h)}
                          {isBooked && !isCurrentStart && " (Booked)"}
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
                    {hours.map((h, index) => {
                      const startTimeIndex = hours.indexOf(newStartTime);
                      const isAfterStart = startTimeIndex !== -1 && index > startTimeIndex;
                      if (!isAfterStart) return null; // Only show times after the selected start time

                      const isCurrentEnd = h === formatTimeForDisplay(b.end_time);

                      // Check if the _entire range_ from newStartTime to h is available
                      const potentialNewRange = hours.slice(startTimeIndex, index + 1); // +1 because slice end is exclusive
                      const isRangeAvailable = potentialNewRange.every(slot => {
                          const isSlotBooked = bookedSlots.includes(slot);
                          const isSlotCurrentBooking = (slot === formatTimeForDisplay(b.time) || slot === formatTimeForDisplay(b.end_time) || (timeToMinutes(slot) > timeToMinutes(formatTimeForDisplay(b.time)) && timeToMinutes(slot) < timeToMinutes(formatTimeForDisplay(b.end_time))));
                          return !isSlotBooked || isSlotCurrentBooking;
                      });

                      return (
                        <option
                          key={h}
                          value={h}
                          disabled={!isRangeAvailable && !isCurrentEnd} // Disable if any part of the new range is unavailable AND it's not the current booking's end time
                          className={
                            (!isRangeAvailable && !isCurrentEnd)
                              ? "text-gray-400"
                              : ""
                          }
                        >
                          {formatTime(h)}
                          {(!isRangeAvailable && !isCurrentEnd) && " (Unavailable)"}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {isLoadingSlots && (
                <div className="mt-2 text-sm text-gray-500">
                  Loading available times...
                </div>
              )}
              {slotError && (
                <div className="mt-2 text-sm text-red-500">{slotError}</div>
              )}

              <div className="mt-4 flex justify-end space-x-3">
                <button
                  onClick={() => setEditingId(null)}
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
                  // Disable if approved OR if the booking's end time is in the past
                  b.status === "approved" || new Date(`${b.date}T${time24hrToIso(b.end_time)}`) <= new Date()
                    ? "bg-gray-300 text-gray cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                } transition-colors`}
                disabled={b.status === "approved" || new Date(`${b.date}T${time24hrToIso(b.end_time)}`) <= new Date()}
              >
                <FiEdit2 className="mr-2" />
                Edit
              </button>
              <button
                onClick={() => handleCancel(b.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center ${
                  b.status === "cancelled"
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700"
                } transition-colors`}
                disabled={b.status === "cancelled"}
              >
                <FiX className="mr-2" />
                Cancel Booking
              </button>
            </div>
          )}
        </div>
      </motion.div>
    ));
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

        {bookings.length === 0 ? (
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
              {upcomingBookings.length > 0 ? (
                <div className="space-y-4">
                  {renderBookingCards(upcomingBookings)}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
                  No upcoming bookings.
                </div>
              )}
            </div>

            {/* Past Bookings Section */}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <FiChevronRight className="text-blue-600 mr-2" /> Past Bookings
                ({pastBookings.length})
              </h2>
              {pastBookings.length > 0 ? (
                <div className="space-y-4">
                  {renderBookingCards(pastBookings)}
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
                  No past bookings.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}