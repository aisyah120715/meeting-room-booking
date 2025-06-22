import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  FiCalendar,
  FiBookOpen,
  FiHome,
  FiLogOut,
  FiCheckCircle,
  FiXCircle,
  FiPlus,
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
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];

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

  const rooms = [
    "Meeting Room A",
    "Meeting Room B",
    "Meeting Room C",
    "Meeting Room D",
    "Meeting Room E",
  ];

  // Helper function to convert time (e.g., "9:00am") to minutes from midnight
  const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [time, period] = timeStr.replace(/:\d+/, "").split(/(am|pm)/i);
    let hour = parseInt(time, 10);
    if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
    if (period.toLowerCase() === "am" && hour === 12) hour = 0;
    return hour * 60;
  };

  // Check if a specific time is booked
  const isTimeSlotBooked = (checkTime) => {
    const checkMinutes = timeToMinutes(checkTime);
    return bookedSlots.some((booked) => {
      const bookedStart = timeToMinutes(booked.start);
      const bookedEnd = timeToMinutes(booked.end);
      return checkMinutes >= bookedStart && checkMinutes < bookedEnd;
    });
  };

  // Check if a time range is available
  const isTimeRangeAvailable = (startTime, endTime) => {
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
  };

  // Fetch booked slots
  useEffect(() => {
    if (selectedDate && room) {
      setIsLoading(true);
      axios
        .get(`${API_URL}/api/booking/slots?date=${selectedDate}&room=${room}`)
        .then((res) => {
          const formattedBookedSlots = res.data.map((slot) => ({
            start: formatTimeForDisplay(slot.time),
            end: formatTimeForDisplay(slot.end_time),
          }));
          setBookedSlots(formattedBookedSlots);
        })
        .catch(() => setBookedSlots([]))
        .finally(() => setIsLoading(false));
    } else {
      setBookedSlots([]);
    }
  }, [selectedDate, room]);

  // Helper to format 24hr time from backend to am/pm for display
  const formatTimeForDisplay = (time24) => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "pm" : "am";
    hour = hour % 12;
    hour = hour === 0 ? 12 : hour;
    return `${hour}:${minuteStr}${ampm}`;
  };

  // Format time for display in dropdowns
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [time, period] = timeStr.split(/(am|pm)/i);
    return `${time.trim()}${period ? period.toUpperCase() : ""}`;
  };

  const confirmBooking = () => {
    if (!startTime || !endTime || !room || !selectedDate) {
      setStatus("error");
      setConfirmationMsg("Please select date, time range, and meeting room.");
      return;
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      setStatus("error");
      setConfirmationMsg("End time must be after start time.");
      return;
    }

    if (!isTimeRangeAvailable(startTime, endTime)) {
      setStatus("error");
      setConfirmationMsg("Selected time range overlaps with an existing booking.");
      return;
    }

    const payload = {
      date: selectedDate,
      startTime,
      endTime,
      room,
      userEmail: user?.email,
      userName: user?.name,
    };

    setIsLoading(true);
    axios
      .post(`${API_URL}/api/booking/create`, payload)
      .then(() => {
        setStatus("success");
        setConfirmationMsg("Booking confirmed! A confirmation email has been sent.");
        
        // Refresh booked slots
        axios
          .get(`${API_URL}/api/booking/slots?date=${selectedDate}&room=${room}`)
          .then((res) => {
            const formattedBookedSlots = res.data.map((slot) => ({
              start: formatTimeForDisplay(slot.time),
              end: formatTimeForDisplay(slot.end_time),
            }));
            setBookedSlots(formattedBookedSlots);
          })
          .catch(() => setBookedSlots([]));
        
        setStartTime("");
        setEndTime("");
      })
      .catch((err) => {
        console.error("❌ Booking error:", err);
        setStatus("error");
        setConfirmationMsg(
          err.response?.data?.message || "Booking failed. Please try again."
        );
      })
      .finally(() => setIsLoading(false));
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-poppins">
      {/* Sidebar */}
      <div className="w-64 bg-gradient-to-b from-green-700 to-green-600 shadow-xl hidden md:flex flex-col p-6 text-white">
        <div className="flex items-center mb-10">
          <FiBookOpen className="text-2xl mr-2" />
          <h2 className="text-xl font-semibold">Meeting Scheduler</h2>
        </div>
        <nav className="flex-1">
          <Link
            to="/dashboard"
            className="flex items-center py-3 px-4 rounded-lg hover:bg-green-800 transition-colors mb-2"
          >
            <FiHome className="mr-3" />
            Dashboard
          </Link>
          <Link
            to="/bookings"
            className="flex items-center py-3 px-4 rounded-lg bg-green-800 transition-colors mb-2"
          >
            <FiCalendar className="mr-3" />
            Book a Room
          </Link>
        </nav>
        <div className="mt-auto">
          <button
            onClick={() => {
              // Handle logout
              navigate("/login");
            }}
            className="flex items-center w-full py-3 px-4 rounded-lg hover:bg-green-800 transition-colors"
          >
            <FiLogOut className="mr-3" />
            Logout
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
          <p className="text-gray-600">
            Select a date, time, and room for your meeting
          </p>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select a Date
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meeting Room
              </label>
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
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <select
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2 border"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setEndTime("");
                  }}
                  disabled={!selectedDate || !room || isLoading}
                >
                  <option value="">-- Select --</option>
                  {hours.map((h) => {
                    const isBooked = isTimeSlotBooked(h);
                    return (
                      <option
                        key={h}
                        value={h}
                        disabled={isBooked}
                        className={isBooked ? "text-gray-400" : ""}
                      >
                        {formatTime(h)}{isBooked ? " (Booked)" : ""}
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
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2 border"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={!startTime || isLoading}
                >
                  <option value="">-- Select --</option>
                  {hours.map((h) => {
                    const isAfterStart = startTime && timeToMinutes(h) > timeToMinutes(startTime);
                    const isAvailable = isAfterStart && isTimeRangeAvailable(startTime, h);
                    
                    return (
                      <option
                        key={h}
                        value={h}
                        disabled={!isAvailable}
                        className={!isAvailable ? "text-gray-400" : ""}
                      >
                        {formatTime(h)}{!isAfterStart ? " (Before start)" : !isAvailable ? " (Unavailable)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <button
              className={`w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg shadow-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 mt-4 ${
                isLoading ? "opacity-70 cursor-not-allowed" : ""
              }`}
              onClick={confirmBooking}
              disabled={isLoading}
            >
              {isLoading ? (
                "Processing..."
              ) : (
                <>
                  <FiPlus className="inline-block mr-2" />
                  Confirm Booking
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}