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
  const [bookedSlots, setBookedSlots] = useState([]); // This should ideally be objects with start and end times
  const [confirmationMsg, setConfirmationMsg] = useState("");
  const [status, setStatus] = useState(""); // success | error
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
    if (period.toLowerCase() === "am" && hour === 12) hour = 0; // 12am is 0 hours
    return hour * 60; // Assuming 00 minutes for simplicity, adjust if needed for actual minutes
  };

  // Fetch booked slots (full booking objects for better validation)
  useEffect(() => {
    if (selectedDate && room) {
      axios
        .get(`${API_URL}/api/booking/slots?date=${selectedDate}&room=${room}`)
        .then((res) => {
          // Assuming res.data will return an array of objects like {time: "08:00:00", end_time: "09:00:00"}
          // We need to store full ranges, not just start times, for accurate overlap checking
          const formattedBookedSlots = res.data.map((slot) => ({
            start: formatTimeForDisplay(slot.time),
            end: formatTimeForDisplay(slot.end_time),
          }));
          setBookedSlots(formattedBookedSlots);
        })
        .catch(() => setBookedSlots([]));
    }
  }, [selectedDate, room]);

  // Helper to format 24hr time from backend to am/pm for display
  const formatTimeForDisplay = (time24) => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "pm" : "am";
    hour = hour % 12;
    hour = hour === 0 ? 12 : hour; // Convert 0 to 12 for 12 AM
    return `${hour}:${minuteStr}${ampm}`;
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

    // Check for any booked slots that overlap with the selected range
    if (isRangeBooked(startTime, endTime)) {
      setStatus("error");
      setConfirmationMsg(
        "Selected time range overlaps with an existing booking."
      );
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

    axios
      .post(`${API_URL}/api/booking/create`, payload)
      .then(() => {
        setStatus("success");
        setConfirmationMsg(
          "Booking confirmed! A confirmation email has been sent."
        );
        // Refresh booked slots after successful booking
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
        // Reset time selections after successful booking
        setStartTime("");
        setEndTime("");
      })
      .catch((err) => {
        console.error("❌ Booking error:", err);
        setStatus("error");
        // More specific error handling could be done based on err.response.data
        if (err.response && err.response.data && err.response.data.message) {
          setConfirmationMsg(err.response.data.message);
        } else {
          setConfirmationMsg("Booking failed. Please try again.");
        }
      });
  };

  // --- Helper Functions for Time Slot Logic ---

  // Check if a specific time (e.g., "9:00am") falls within any booked range
  const isTimeSlotWithinBookedRange = (checkTime) => {
    const checkMinutes = timeToMinutes(checkTime);
    return bookedSlots.some((booked) => {
      const bookedStartMinutes = timeToMinutes(booked.start);
      const bookedEndMinutes = timeToMinutes(booked.end);
      // A slot is "booked" if its start time is equal to checkTime
      // OR if checkTime falls strictly between the start and end of a booked slot
      return (
        checkMinutes >= bookedStartMinutes && checkMinutes < bookedEndMinutes
      );
    });
  };

  // Helper function to check if a potential booking range (start to end) overlaps with any existing bookings
  const isRangeBooked = (selectedStart, selectedEnd) => {
    const selectedStartMinutes = timeToMinutes(selectedStart);
    const selectedEndMinutes = timeToMinutes(selectedEnd);

    // Iterate through all currently booked slots for the selected date/room
    return bookedSlots.some((booked) => {
      const bookedStartMinutes = timeToMinutes(booked.start);
      const bookedEndMinutes = timeToMinutes(booked.end);

      // Check for overlap:
      // Case 1: New booking starts during an existing booking
      // Case 2: New booking ends during an existing booking
      // Case 3: Existing booking is entirely within the new booking
      // Case 4: New booking is entirely within an existing booking
      return (
        (selectedStartMinutes < bookedEndMinutes &&
          selectedEndMinutes > bookedStartMinutes)
      );
    });
  };

  // Format time for display in dropdowns
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    // Ensure "am" or "pm" is capitalized consistently for display
    const [time, period] = timeStr.split(/(am|pm)/i);
    return `${time.trim()}${period ? period.toUpperCase() : ""}`;
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
                  disabled={!selectedDate || !room} // Disable if no date or room selected
                >
                  <option value="">-- Select --</option>
                  {hours.map((h) => (
                    <option
                      key={h}
                      value={h}
                      disabled={isTimeSlotWithinBookedRange(h)}
                      className={
                        isTimeSlotWithinBookedRange(h) ? "text-gray-400" : ""
                      }
                    >
                      {formatTime(h)}{" "}
                      {isTimeSlotWithinBookedRange(h) ? "(Booked)" : ""}
                    </option>
                  ))}
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
                  disabled={!startTime} // Disable until start time is chosen
                >
                  <option value="">-- Select --</option>
                  {hours.map((h) => {
                    const isAfterStart =
                      startTime && timeToMinutes(h) > timeToMinutes(startTime);
                    const isRangeCurrentlyBooked = isRangeBooked(
                      startTime,
                      h
                    ); // Check for overlap with proposed end time

                    return (
                      <option
                        key={h}
                        value={h}
                        disabled={!isAfterStart || isRangeCurrentlyBooked}
                        className={
                          !isAfterStart || isRangeCurrentlyBooked
                            ? "text-gray-400"
                            : ""
                        }
                      >
                        {formatTime(h)}{" "}
                        {!isAfterStart
                          ? "(Before start)"
                          : isRangeCurrentlyBooked
                          ? "(Unavailable)"
                          : ""}
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
}
