import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import { 
  FiCalendar, 
  FiBookOpen, 
  FiHome,
  FiLogOut,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiPlus
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom"; 

const API_URL = process.env.REACT_APP_API_URL;

export default function BookingCalendar() {
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [room, setRoom] = useState("");
  const [bookedSlots, setBookedSlots] = useState([]);
  const [confirmationMsg, setConfirmationMsg] = useState("");
  const [status, setStatus] = useState(""); // success | error
  const { user } = useAuth();
  const navigate = useNavigate();


  const today = new Date().toISOString().split("T")[0];

  const hours = [
    "8:00am", "9:00am", "10:00am", "11:00am",
    "12:00pm", "1:00pm", "2:00pm", "3:00pm", "4:00pm"
  ];

  const rooms = [
    "Meeting Room A", "Meeting Room B", "Meeting Room C",
    "Meeting Room D", "Meeting Room E"
  ];

  // Fetch booked slots when date or room changes
  useEffect(() => {
     fetch(`${API_URL}/api/rooms`)
    if (selectedDate && room) {
      axios
        .get(`${API_URL}/api/booking/slots?date=${selectedDate}&room=${room}`)
        .then((res) => {
          setBookedSlots(res.data);
        })
        .catch(() => setBookedSlots([]));
    }
  }, [selectedDate, room]);

  const confirmBooking = () => {
    if (!startTime || !endTime || !room || !selectedDate) {
      setStatus("error");
      setConfirmationMsg("Please select date, time range and meeting room.");
      return;
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      setStatus("error");
      setConfirmationMsg("End time must be after start time.");
      return;
    }

    // Get all time slots that fall within the selected range
    const selectedStartIndex = hours.indexOf(startTime);
    const selectedEndIndex = hours.indexOf(endTime);
    
    if (selectedStartIndex === -1 || selectedEndIndex === -1) {
      setStatus("error");
      setConfirmationMsg("Invalid time selection.");
      return;
    }

    // Check for any booked slots that overlap with the selected range
    const isOverlapping = bookedSlots.some(slot => {
      const slotIndex = hours.indexOf(slot);
      return (
        (slotIndex >= selectedStartIndex && slotIndex < selectedEndIndex) ||
        (slotIndex === selectedStartIndex && bookedSlots.includes(slot))
      );
    });

    if (isOverlapping) {
      setStatus("error");
      setConfirmationMsg("Selected time range overlaps with existing booking.");
      return;
    }

    const payload = {
      date: selectedDate,
      startTime,
      endTime,
      room,
      userEmail: user?.email,
      userName: user?.name
    };

    axios.post(`${API_URL}/api/booking/create`, payload)
      .then(() => {
        setStatus("success");
        setConfirmationMsg("Booking confirmed! A confirmation email has been sent.");
        // Refresh booked slots
        axios.get(`${API_URL}/api/booking/slots?date=${selectedDate}&room=${room}`)
          .then((res) => setBookedSlots(res.data));
      })
      .catch((err) => {
        console.error("❌ Booking error:", err);
        setStatus("error");
        setConfirmationMsg("Booking failed. Please try again.");
      });
  };

  // Helper function to check if a time slot is available for start time
  const isStartTimeAvailable = (time) => {
    const timeIndex = hours.indexOf(time);
    return !bookedSlots.includes(time) || 
           (timeIndex > 0 && bookedSlots.includes(hours[timeIndex - 1]));
  };

  // Helper function to get available end times
  const getAvailableEndTimes = () => {
    if (!startTime) return hours;
    
    const startIndex = hours.indexOf(startTime);
    return hours.filter((time, index) => {
      const timeIndex = hours.indexOf(time);
      return (
        timeIndex > startIndex && 
        !bookedSlots.includes(time) &&
        !isRangeBooked(startTime, time)
      );
    });
  };

  // Helper function to check if a range is booked
  const isRangeBooked = (start, end) => {
    const startIndex = hours.indexOf(start);
    const endIndex = hours.indexOf(end);
    return hours.slice(startIndex, endIndex).some(time => bookedSlots.includes(time));
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [time, period] = timeStr.split(/(am|pm)/i);
    return `${time} ${period?.toUpperCase()}`;
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-poppins">
      {/* Sidebar - Matching MyBookings theme */}
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
            className="flex items-center p-3 text-green-100 hover:bg-green-800 rounded-lg transition-all"
          >
            <FiBookOpen className="mr-3 text-lg" />
            <span>My Bookings</span>
          </Link>
          <Link 
            to="/calendar" 
            className="flex items-center p-3 text-white bg-green-800 rounded-lg transition-all hover:bg-green-900"
          >
            <FiCalendar className="mr-3 text-lg" />
            <span>New Booking</span>
          </Link>
        </nav>
        
        <div className="mt-auto pt-4 border-t border-green-800">
          <div className="px-4 py-3 bg-green-800 rounded-lg">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-green-200">{user?.email}</p>
          </div>
       <button 
    className="flex items-center w-full p-3 text-green-100 hover:bg-green-800 rounded-lg transition-all mt-2"
    onClick={() => navigate("/login")} // Add this onClick handler
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
            <FiCalendar className="inline-block mr-2" />
            Book a Meeting Room
          </h1>
          <p className="text-gray-600">Select a date, time and room for your meeting</p>
        </header>

        {confirmationMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-lg ${
              status === "success" 
                ? "bg-green-100 text-green-800 border border-green-200" 
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            <div className="flex items-center">
              {status === "success" ? (
                <FiCheckCircle className="mr-2" />
              ) : (
                <FiXCircle className="mr-2" />
              )}
              <span>{confirmationMsg}</span>
            </div>
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm p-6 max-w-2xl mx-auto"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select a Date</label>
              <input
                type="date"
                min={today}
                value={selectedDate}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2 border"
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setStartTime("");
                  setEndTime("");
                  setConfirmationMsg("");
                  setStatus("");
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Room</label>
              <select
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2 border"
                value={room}
                onChange={(e) => {
                  setRoom(e.target.value);
                  setStartTime("");
                  setEndTime("");
                  setConfirmationMsg("");
                  setStatus("");
                }}
              >
                <option value="">-- Select Room --</option>
                {rooms.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
               <select
  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2 border"
  value={startTime}
  onChange={(e) => {
    setStartTime(e.target.value);
    setEndTime("");
  }}
>
  <option value="">-- Select --</option>
  {hours.map((h) => {
    const isBooked = bookedSlots.includes(h);
    return (
      <option 
        key={h} 
        value={h} 
        disabled={isBooked}
        className={isBooked ? "text-gray-400 bg-gray-100" : ""}
      >
        {formatTime(h)} {isBooked && "(Booked)"}
      </option>
    );
  })}
</select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <select
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2 border"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={!startTime}
                >
                  <option value="">-- Select --</option>
                  {hours.map((h) => {
                    const isAfterStart = startTime && timeToMinutes(h) > timeToMinutes(startTime);
                    const isAvailable = !bookedSlots.includes(h) && !isRangeBooked(startTime, h);
                    
                    return (
                      <option 
                        key={h} 
                        value={h} 
                        disabled={!isAfterStart || !isAvailable}
                        className={!isAfterStart || !isAvailable ? "text-gray-400" : ""}
                      >
                        {formatTime(h)} {!isAvailable ? "(Unavailable)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <button
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg shadow-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mt-4"
              onClick={confirmBooking}
            >
              <FiPlus className="inline-block mr-2" />
              Confirm Booking
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );

  // Helper function to convert time to minutes
  function timeToMinutes(time) {
    if (!time) return 0;
    const [hourStr, period] = time.replace(/:\d+/, "").split(/(am|pm)/);
    let hour = parseInt(hourStr);
    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    return hour * 60;
  }
}