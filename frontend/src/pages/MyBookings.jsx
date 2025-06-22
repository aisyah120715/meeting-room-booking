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

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-medium text-red-800">Something went wrong</h3>
          <p className="mt-2 text-red-600">{this.state.error?.message || "Unknown error"}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reload Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Standard business hours
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

  // Format time for display (e.g., "8:00am")
  const formatTimeForDisplay = useCallback((timeStr) => {
    if (!timeStr) return "";
    
    // Handle already formatted times
    if (timeStr.includes('am') || timeStr.includes('pm')) {
      return timeStr.toLowerCase().replace(/\s/g, '');
    }

    // Handle 24-hour format
    const [hours, minutes] = timeStr.split(':');
    const hourNum = parseInt(hours, 10);
    const period = hourNum >= 12 ? 'pm' : 'am';
    const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
    return `${displayHour}:${minutes}${period}`;
  }, []);

  // Format date from ISO string to display (e.g., "Sat, Jun 22")
  const formatDate = useCallback((isoDate) => {
    try {
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return "Invalid Date";
      
      const options = { weekday: "short", month: "short", day: "numeric" };
      return date.toLocaleDateString("en-US", options);
    } catch (error) {
      console.error("Date formatting error:", error);
      return "Invalid Date";
    }
  }, []);

  // Convert time string to minutes for comparison
  const timeToMinutes = useCallback((timeStr) => {
    if (!timeStr) return 0;
    
    // Extract time and period
    const timePart = timeStr.split(/(am|pm)/i)[0];
    const period = timeStr.toLowerCase().includes('pm') ? 'pm' : 'am';
    
    const [hours, minutes] = timePart.split(':').map(Number);
    let total = hours * 60 + minutes;
    if (period === 'pm' && hours !== 12) total += 12 * 60;
    if (period === 'am' && hours === 12) total -= 12 * 60;
    return total;
  }, []);

  // Check if a specific time is booked
  const isTimeSlotBooked = useCallback((checkTime) => {
    const checkMinutes = timeToMinutes(checkTime);
    return bookedSlots.some((booked) => {
      const bookedStart = timeToMinutes(booked.start);
      const bookedEnd = timeToMinutes(booked.end);
      return checkMinutes >= bookedStart && checkMinutes < bookedEnd;
    });
  }, [bookedSlots, timeToMinutes]);

  // Check if a time range is available
  const isTimeRangeAvailable = useCallback((startTime, endTime) => {
    if (!startTime || !endTime) return true;
    
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    if (startMinutes >= endMinutes) return false;
    
    return !bookedSlots.some((booked) => {
      const bookedStart = timeToMinutes(booked.start);
      const bookedEnd = timeToMinutes(booked.end);
      
      return (
        (startMinutes >= bookedStart && startMinutes < bookedEnd) ||
        (endMinutes > bookedStart && endMinutes <= bookedEnd) ||
        (startMinutes <= bookedStart && endMinutes >= bookedEnd)
      );
    });
  }, [bookedSlots, timeToMinutes]);

  // Fetch user bookings with improved error handling
  const fetchBookings = useCallback(async () => {
    if (loadingAuth || !user?.email) {
      setIsLoadingBookings(false);
      return;
    }
    
    setIsLoadingBookings(true);
    setStatusMsg("");
    setStatusType("");
    
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }
      
      const response = await axios.get(
        `${API_URL}/api/booking/user-bookings?email=${user.email}`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000 // 10 second timeout
        }
      );
      
      const allBookings = Array.isArray(response.data) ? response.data : [];
      const now = new Date();
      const todayMidnight = new Date(now);
      todayMidnight.setHours(0, 0, 0, 0);

      const upcoming = [];
      const past = [];

      allBookings.forEach((booking) => {
        try {
          if (!booking.date || !booking.time || !booking.end_time) {
            console.warn("Incomplete booking data:", booking);
            past.push(booking);
            return;
          }

          const bookingDate = new Date(booking.date);
          bookingDate.setHours(0, 0, 0, 0);
          
          if (isNaN(bookingDate.getTime())) {
            console.warn("Invalid booking date:", booking);
            past.push(booking);
            return;
          }

          if (bookingDate > todayMidnight) {
            upcoming.push(booking);
          } else if (bookingDate < todayMidnight) {
            past.push(booking);
          } else {
            // For today's bookings, check end time
            const bookingEndTime = timeToMinutes(formatTimeForDisplay(booking.end_time));
            const currentTime = now.getHours() * 60 + now.getMinutes();
            
            if (bookingEndTime > currentTime) {
              upcoming.push(booking);
            } else {
              past.push(booking);
            }
          }
        } catch (error) {
          console.error("Error processing booking:", error, booking);
          past.push(booking);
        }
      });

      // Sort bookings
      upcoming.sort((a, b) => {
        try {
          const dateA = new Date(`${a.date}T${a.time}`);
          const dateB = new Date(`${b.date}T${b.time}`);
          return dateA.getTime() - dateB.getTime();
        } catch (error) {
          console.error("Sorting error:", error);
          return 0;
        }
      });

      past.sort((a, b) => {
        try {
          const dateA = new Date(`${a.date}T${a.time}`);
          const dateB = new Date(`${b.date}T${b.time}`);
          return dateB.getTime() - dateA.getTime();
        } catch (error) {
          console.error("Sorting error:", error);
          return 0;
        }
      });

      setBookings(allBookings);
      setUpcomingBookings(upcoming);
      setPastBookings(past);
    } catch (error) {
      console.error("Failed to load bookings:", error);
      setStatusType("error");
      setStatusMsg(error.response?.data?.message || 
                  error.message || 
                  "Failed to load bookings. Please try again.");
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout();
        navigate("/login");
      }
    } finally {
      setIsLoadingBookings(false);
    }
  }, [user, loadingAuth, API_URL, logout, navigate, timeToMinutes, formatTimeForDisplay]);

  // Fetch booked time slots with improved error handling
  const fetchBookedSlots = useCallback(async (date, room, ignoreError = false) => {
    if (!date || !room) {
      setSlotError("Invalid date or room provided");
      return;
    }
    
    setIsLoadingSlots(true);
    setSlotError(null);
    
    try {
      const token = localStorage.getItem("authToken");
      const res = await axios.get(
        `${API_URL}/api/booking/slots?date=${date}&room=${room}`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        }
      );
      
      // Convert to formatted times
      const formattedSlots = res.data.map(slot => ({
        start: formatTimeForDisplay(slot.time),
        end: formatTimeForDisplay(slot.end_time)
      }));
      setBookedSlots(Array.isArray(formattedSlots) ? formattedSlots : []);
    } catch (error) {
      console.error("Failed to load booked slots:", error);
      setBookedSlots([]);
      if (!ignoreError) {
        setSlotError(error.response?.data?.message || 
                   "Failed to load booked time slots. Please try again.");
      }
    } finally {
      setIsLoadingSlots(false);
    }
  }, [API_URL, formatTimeForDisplay]);

  // Cancel a booking with improved error handling
  const handleCancel = useCallback(async (id) => {
    if (!id || !user?.email) {
      setStatusType("error");
      setStatusMsg("Invalid booking or user information");
      return;
    }
    
    setStatusMsg("");
    setStatusType("");
    
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }
      
      await axios.post(
        `${API_URL}/api/booking/cancel`,
        { id, email: user.email },
        { 
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );
      
      setStatusType("success");
      setStatusMsg("Booking cancelled successfully!");
      await fetchBookings(); // Wait for refresh
    } catch (error) {
      console.error("Failed to cancel booking:", error);
      setStatusType("error");
      setStatusMsg(error.response?.data?.message || 
                 "Failed to cancel booking. Please try again.");
    }
  }, [user, API_URL, fetchBookings]);

  // Start editing a booking with validation
  const handleEdit = useCallback((booking) => {
    if (booking.status === 'approved') {
      setStatusType("error");
      setStatusMsg("Approved bookings cannot be edited.");
      return;
    }
    
    if (booking.status === 'cancelled') {
      setStatusType("error");
      setStatusMsg("Cancelled bookings cannot be edited.");
      return;
    }

    setEditingId(booking.id);
    setNewStartTime(formatTimeForDisplay(booking.time));
    setNewEndTime(formatTimeForDisplay(booking.end_time));
    setSelectedBooking(booking);
    
    fetchBookedSlots(booking.date, booking.room, true);
  }, [fetchBookedSlots, formatTimeForDisplay]);

  // Save edited booking with validation
  const saveEdit = useCallback(async () => {
    if (!newStartTime || !newEndTime || !editingId || !selectedBooking) {
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

    // Only validate against booked slots for pending bookings
    if (selectedBooking?.status === 'pending') {
      if (!isTimeRangeAvailable(newStartTime, newEndTime)) {
        setStatusType("error");
        setStatusMsg("Selected time slot conflicts with an existing booking.");
        return;
      }
    }

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const payload = {
        id: editingId,
        newTime: newStartTime,
        newEndTime: newEndTime,
        email: user.email,
      };

      await axios.post(`${API_URL}/api/booking/edit`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      setStatusType("success");
      setStatusMsg("Booking updated successfully!");
      setEditingId(null);
      setNewStartTime("");
      setNewEndTime("");
      setSelectedBooking(null);
      await fetchBookings(); // Wait for refresh
    } catch (error) {
      console.error("Failed to edit booking:", error);
      setStatusType("error");
      setStatusMsg(error.response?.data?.message || 
                 "Failed to edit booking. Please try again.");
    }
  }, [
    newStartTime, 
    newEndTime, 
    editingId, 
    selectedBooking, 
    user, 
    API_URL, 
    timeToMinutes, 
    isTimeRangeAvailable, 
    fetchBookings
  ]);

  // Handle logout with proper cleanup
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Fallback in case logout fails
      localStorage.removeItem("authToken");
      navigate("/login");
    }
  }, [logout, navigate]);

  // Render booking cards with error boundaries
  const renderBookingCards = useCallback((bookingsToRender) => {
    if (!Array.isArray(bookingsToRender) || !bookingsToRender.length) {
      return (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
          No bookings to display.
        </div>
      );
    }

    return bookingsToRender.map((b) => (
      <ErrorBoundary key={b.id}>
        <motion.div
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
                    {b.room || "Unknown Room"}
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
                {b.status ? b.status.charAt(0).toUpperCase() + b.status.slice(1) : "Unknown"}
              </span>
            </div>

            {editingId === b.id && (
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
                        setNewEndTime("");
                      }}
                    >
                      <option value="">Select start time</option>
                      {HOURS.map((h) => {
                        const isBooked = isTimeSlotBooked(h) && h !== formatTimeForDisplay(b.time);
                        return (
                          <option
                            key={h}
                            value={h}
                            disabled={isBooked}
                            className={isBooked ? 'text-gray-400 bg-gray-100' : ''}
                          >
                            {h}
                            {isBooked && " (Booked)"}
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
                      {HOURS.map((h) => {
                        const startMin = timeToMinutes(newStartTime);
                        const endMin = timeToMinutes(h);
                        const isAfterStart = endMin > startMin;
                        const isCurrentEnd = h === formatTimeForDisplay(b.end_time);
                        const isAvailable = isAfterStart && 
                          (selectedBooking?.status !== 'pending' || 
                           isTimeRangeAvailable(newStartTime, h) ||
                           isCurrentEnd);

                        let disabledReason = "";
                        if (!isAfterStart) disabledReason = " (Before start)";
                        else if (!isAvailable) disabledReason = " (Unavailable)";

                        return (
                          <option
                            key={h}
                            value={h}
                            disabled={!isAvailable}
                            className={!isAvailable ? 'text-gray-400 bg-gray-100' : ''}
                          >
                            {h}
                            {disabledReason}
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
                      setStatusMsg("");
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
            )}

            {editingId !== b.id && (
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  onClick={() => handleEdit(b)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center ${
                    b.status === 'approved' || b.status === 'cancelled'
                      ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  } transition-colors`}
                  disabled={b.status === 'approved' || b.status === 'cancelled'}
                >
                  <FiEdit2 className="mr-2" />
                  Edit
                </button>
                <button
                  onClick={() => handleCancel(b.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center ${
                    b.status === 'cancelled'
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700"
                  } transition-colors`}
                  disabled={b.status === 'cancelled'}
                >
                  <FiX className="mr-2" />
                  Cancel Booking
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </ErrorBoundary>
    ));
  }, [
    editingId,
    newStartTime,
    newEndTime,
    isLoadingSlots,
    slotError,
    saveEdit,
    handleEdit,
    handleCancel,
    formatDate,
    formatTimeForDisplay,
    timeToMinutes,
    isTimeSlotBooked,
    isTimeRangeAvailable,
    selectedBooking
  ]);

  // Load bookings on component mount
  useEffect(() => {
    if (!loadingAuth && user?.email) {
      fetchBookings();
    } else if (!loadingAuth && !user) {
      setIsLoadingBookings(false);
    }
  }, [loadingAuth, user, fetchBookings]);

  return (
    <ErrorBoundary>
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
          ) : bookings.length === 0 ? (
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
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}