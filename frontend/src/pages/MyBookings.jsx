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
  FiPlus
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
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

  // Standard business hours
  const hours = [
    "8:00am", "9:00am", "10:00am", "11:00am",
    "12:00pm", "1:00pm", "2:00pm", "3:00pm", "4:00pm"
  ];

  useEffect(() => {
    if (user?.email) fetchBookings();
  }, [user]);

  const fetchBookings = () => {
    axios
      .get(`${API_URL}/api/booking/user-bookings?email=${user.email}`)
      .then((res) => setBookings(res.data))
      .catch(() => {
        setStatusType("error");
        setStatusMsg("Failed to load bookings.");
      });
  };

  const fetchBookedSlots = (date, room) => {
    setIsLoadingSlots(true);
    setSlotError(null);
    axios
      .get(`${API_URL}/api/booking/slots?date=${date}&room=${room}`)
      .then((res) => {
        const formattedSlots = res.data.map(slot => formatTimeForDisplay(slot));
        setBookedSlots(formattedSlots);
      })
      .catch(() => {
        setBookedSlots([]);
        setSlotError("Failed to load booked time slots");
      })
      .finally(() => setIsLoadingSlots(false));
  };

  const formatTimeForDisplay = (timeStr) => {
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
  };

  const handleCancel = (id) => {
    axios
      .post(`${API_URL}/api/booking/cancel`, { id, email: user.email })
      .then(() => {
        setStatusType("success");
        setStatusMsg("Booking cancelled successfully!");
        fetchBookings();
      })
      .catch(() => {
        setStatusType("error");
        setStatusMsg("Failed to cancel booking.");
      });
  };

  const handleEdit = (booking) => {
    if (booking.status === 'approved') {
      setStatusType("error");
      setStatusMsg("Approved bookings cannot be edited.");
      return;
    }
    
    setEditingId(booking.id);
    setNewStartTime(formatTimeForDisplay(booking.time));
    setNewEndTime(formatTimeForDisplay(booking.end_time));
    setSelectedBooking(booking);
    
    if (booking.status === 'pending') {
      fetchBookedSlots(booking.date, booking.room);
    } else {
      setBookedSlots([]);
    }
  };

  const isRangeBooked = (start, end, currentBookingId) => {
    const startMin = timeToMinutes(start);
    const endMin = timeToMinutes(end);
    
    return bookings.some(booking => {
      if (booking.id === currentBookingId) return false;
      
      const bookingStart = timeToMinutes(formatTimeForDisplay(booking.time));
      const bookingEnd = timeToMinutes(formatTimeForDisplay(booking.end_time));
      
      return (
        (startMin >= bookingStart && startMin < bookingEnd) ||
        (endMin > bookingStart && endMin <= bookingEnd) ||
        (startMin <= bookingStart && endMin >= bookingEnd)
      );
    });
  };

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    
    // Extract time and period
    const timePart = timeStr.split(/(am|pm)/i)[0];
    const period = timeStr.toLowerCase().includes('pm') ? 'pm' : 'am';
    
    const [hours, minutes] = timePart.split(':').map(Number);
    let total = hours * 60 + minutes;
    if (period === 'pm' && hours !== 12) total += 12 * 60;
    if (period === 'am' && hours === 12) total -= 12 * 60;
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

    // Only validate against booked slots for pending bookings
    if (selectedBooking?.status === 'pending') {
      if (isRangeBooked(newStartTime, newEndTime, editingId)) {
        setStatusType("error");
        setStatusMsg("Selected time slot overlaps with existing booking.");
        return;
      }
    }

    const payload = {
      id: editingId,
      newStartTime,
      newEndTime,
      email: user.email,
    };

    axios
      .post(`${API_URL}/api/booking/edit`, payload)
      .then(() => {
        setStatusType("success");
        setStatusMsg("Booking updated successfully!");
        setEditingId(null);
        setNewStartTime("");
        setNewEndTime("");
        fetchBookings();
      })
      .catch(() => {
        setStatusType("error");
        setStatusMsg("Failed to edit booking.");
      });
  };

  const formatDate = (isoDate) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    // Format already formatted times consistently
    if (timeStr.includes('am') || timeStr.includes('pm')) {
      const [time, period] = timeStr.split(/(am|pm)/i);
      return `${time}${period?.toUpperCase()}`;
    }
    return timeStr;
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
              <p className="text-xs text-green-200">{user?.email || "user@example.com"}</p>
            </div>
          </div>
          
          <button 
            className="flex items-center w-full p-3 text-green-100 hover:bg-green-800 rounded-lg transition-all mt-2"
            onClick={() => navigate("/login")}
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
          <p className="text-gray-600">View and manage your active and upcoming bookings</p>
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
            <h3 className="text-lg font-medium text-gray-900">No bookings yet</h3>
            <p className="mt-1 text-gray-500 mb-6">You haven't made any bookings yet.</p>
            <Link
              to="/calendar"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              <FiPlus className="mr-2" />
              Book a Room
            </Link>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl">
            {bookings.map((b) => (
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
                        <h3 className="text-lg font-semibold text-gray-800">{b.room}</h3>
                        <p className="text-gray-600 mt-1">
                          {formatDate(b.date)} • {formatTime(b.time)} - {formatTime(b.end_time)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      b.status === 'approved' ? 'bg-green-100 text-green-800' : 
                      b.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </span>
                  </div>

                  {editingId === b.id ? (
                    <div className="mt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                          <select
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
                            value={newStartTime}
                            onChange={(e) => {
                              setNewStartTime(e.target.value);
                              setNewEndTime("");
                            }}
                          >
                            <option value="">Select start time</option>
                            {hours.map((h) => {
                              const isBooked = bookings.some(booking => {
                                if (booking.id === b.id) return false;
                                
                                const bookingStart = formatTimeForDisplay(booking.time);
                                const bookingEnd = formatTimeForDisplay(booking.end_time);
                                const timeMin = timeToMinutes(h);
                                const bookingStartMin = timeToMinutes(bookingStart);
                                const bookingEndMin = timeToMinutes(bookingEnd);
                                
                                return timeMin >= bookingStartMin && timeMin < bookingEndMin;
                              });
                              
                              const isCurrentTime = h === formatTimeForDisplay(b.time);
                              
                              return (
                                <option 
                                  key={h} 
                                  value={h}
                                  disabled={isBooked && !isCurrentTime}
                                  className={isBooked && !isCurrentTime ? 'text-gray-400' : ''}
                                >
                                  {formatTime(h)} 
                                  {isBooked && !isCurrentTime && " (Booked)"}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                          <select
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
                            value={newEndTime}
                            onChange={(e) => setNewEndTime(e.target.value)}
                            disabled={!newStartTime}
                          >
                            <option value="">Select end time</option>
                            {hours.map((h) => {
                              const isAfterStart = newStartTime && timeToMinutes(h) > timeToMinutes(newStartTime);
                              const isBooked = bookings.some(booking => {
                                if (booking.id === b.id) return false;
                                
                                const bookingStart = formatTimeForDisplay(booking.time);
                                const bookingEnd = formatTimeForDisplay(booking.end_time);
                                const timeMin = timeToMinutes(h);
                                const bookingStartMin = timeToMinutes(bookingStart);
                                const bookingEndMin = timeToMinutes(bookingEnd);
                                
                                return timeMin >= bookingStartMin && timeMin < bookingEndMin;
                              });
                              const isRangeAvailable = !isRangeBooked(newStartTime, h, b.id);
                              const isCurrentTime = h === formatTimeForDisplay(b.end_time);
                              
                              return (
                                <option 
                                  key={h} 
                                  value={h}
                                  disabled={(!isAfterStart || (isBooked && !isCurrentTime) || !isRangeAvailable)}
                                  className={(!isAfterStart || (isBooked && !isCurrentTime) || !isRangeAvailable) ? 'text-gray-400' : ''}
                                >
                                  {formatTime(h)} 
                                  {(!isAfterStart && " (Before start)") ||
                                   (isBooked && !isCurrentTime && " (Booked)") ||
                                   (!isRangeAvailable && " (Unavailable)")}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                      
                      {isLoadingSlots && (
                        <div className="mt-2 text-sm text-gray-500">Loading available times...</div>
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
                          b.status === 'approved' 
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        } transition-colors`}
                        disabled={b.status === 'approved'}
                      >
                        <FiEdit2 className="mr-2" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleCancel(b.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center ${
                          b.status === 'cancelled' 
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-red-600 hover:bg-red-700'
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}