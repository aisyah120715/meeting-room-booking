const express = require("express");
const router = express.Router();
const db = require("../db");
const sendEmail = require("../utils/mailer");

// Time slots from 8:00am to 4:00pm
const hours = [
  "8:00am", "9:00am", "10:00am", "11:00am",
  "12:00pm", "1:00pm", "2:00pm", "3:00pm", "4:00pm"
];

// Helper function to convert database time (HH:MM:SS) to frontend format (H:MMam/pm)
function formatTimeForDisplay(time24) {
  if (!time24) return "";
  const [hourStr, minuteStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  hour = hour % 12;
  hour = hour === 0 ? 12 : hour;
  return `${hour}:${minuteStr}${ampm}`;
}

// Helper to convert frontend time (H:MMam/pm) to 24-hour format (HH:MM:SS)
function convertTo24Hour(timeStr) {
  if (!timeStr) return "";
  const [time, period] = timeStr.split(/(am|pm)/i);
  let [hours, minutes] = time.split(':').map(Number);

  if (period && period.toLowerCase() === 'pm' && hours !== 12) {
    hours += 12;
  } else if (period && period.toLowerCase() === 'am' && hours === 12) {
    hours = 0; // Midnight (12 AM) is 00 hours
  }

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
}


// Helper to get all *occupied* single-hour slots between start and end times (e.g., 8:00am to 10:00am -> ["8:00am", "9:00am"])
// This assumes slots are hourly and the end time means the *start* of the next available slot.
const getSlotRange = (startTimeStr, endTimeStr) => {
  // Convert to 24-hour for Date object creation
  const start24 = convertTo24Hour(startTimeStr);
  const end24 = convertTo24Hour(endTimeStr);

  const startTime = new Date(`2000-01-01T${start24}`);
  const endTime = new Date(`2000-01-01T${end24}`);

  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime()) || startTime >= endTime) {
    console.warn("Invalid time range for getSlotRange:", startTimeStr, endTimeStr);
    return [];
  }

  const slots = [];
  let current = new Date(startTime);

  // Loop while the current time is strictly less than the end time
  // This means a booking from 8:00 to 9:00 will include the "8:00" slot.
  // The 9:00 slot is then considered free.
  while (current < endTime) {
    const hours = current.getHours();
    const minutes = current.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    slots.push(`${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`);
    current.setHours(current.getHours() + 1); // Move to the next hour
  }

  return slots;
};


// GET: Unavailable time slots for a date and room
router.get("/slots", (req, res) => {
  const { date, room } = req.query;
  if (!date || !room) return res.status(400).json({ error: "Missing date or room" });

  const sql = `SELECT time, end_time FROM bookings WHERE date = ? AND room = ? AND status != 'cancelled'`;
  db.query(sql, [date, room], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Directly return the times as stored in DB (24-hour) as frontend expects this for isTimeRangeAvailable
    // The frontend's `formatTimeForDisplay` will convert them for display.
    // The `bookedSlots` state in the frontend expects `start` and `end` in the display format for comparison.
    const formattedBookings = results.map(booking => {
      return {
        start: formatTimeForDisplay(booking.time), // Convert to 12-hour format for frontend's isTimeRangeAvailable
        end: formatTimeForDisplay(booking.end_time) // Convert to 12-hour format for frontend's isTimeRangeAvailable
      };
    });

    res.json(formattedBookings);
  });
});


// POST: Create a new booking
router.post("/create", (req, res) => {
  const { date, startTime, endTime, room, userEmail, userName } = req.body;
  if (!date || !startTime || !endTime || !room || !userEmail || !userName)
    return res.status(400).json({ error: "Missing required fields" });

  // Basic validation to prevent booking in the past
  const bookingDateTime = new Date(`${date}T${convertTo24Hour(startTime)}`);
  const now = new Date();
  if (bookingDateTime < now) {
    return res.status(400).json({ error: "Cannot book a slot in the past." });
  }

  // Check for conflicts before inserting
  const newBookingOccupiedSlots = getSlotRange(startTime, endTime); // Get the single-hour slots the new booking will occupy

  const sqlCheckOverlap = `
    SELECT time, end_time FROM bookings
    WHERE date = ? AND room = ? AND status != 'cancelled'
  `;

  db.query(sqlCheckOverlap, [date, room], (err, existingBookings) => {
    if (err) {
      console.error("Error checking for overlaps:", err);
      return res.status(500).json({ error: err.message });
    }

    let conflict = false;
    for (const existingBooking of existingBookings) {
      // Get the single-hour slots the existing booking occupies
      const existingOccupiedSlots = getSlotRange(
        formatTimeForDisplay(existingBooking.time), // Convert 24-hour DB time to 12-hour for getSlotRange
        formatTimeForDisplay(existingBooking.end_time) // Convert 24-hour DB time to 12-hour for getSlotRange
      );

      // Check if any of the new booking's occupied slots are already occupied
      if (newBookingOccupiedSlots.some(slot => existingOccupiedSlots.includes(slot))) {
        conflict = true;
        break;
      }
    }

    if (conflict) {
      return res.status(409).json({ error: "The requested time slot conflicts with an existing booking." });
    }

    // If no conflict, proceed with insertion
    const sqlInsert = `
      INSERT INTO bookings (date, time, end_time, user_email, user_name, room, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `;

    const time24 = convertTo24Hour(startTime);
    const endTime24 = convertTo24Hour(endTime);

    db.query(sqlInsert, [date, time24, endTime24, userEmail, userName, room], async (err) => {
      if (err) {
        console.error("Error inserting booking:", err);
        return res.status(500).json({ error: err.message });
      }

      try {
        await sendEmail(
          userEmail,
          "Meeting Room Booking Confirmation",
          `<p>Hi ${userName},</p>
          <p>Your booking for <strong>${room}</strong> on <strong>${date}</strong><br/>
          from <strong>${startTime}</strong> to <strong>${endTime}</strong> is <strong>pending approval</strong>.</p>`
        );
      } catch (mailErr) {
        console.error("Email sending failed:", mailErr.message);
      }

      res.status(201).json({ message: "Booking created and pending approval" });
    });
  });
});

// GET: User's bookings
router.get("/user-bookings", (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Missing email" });

  const sql = `SELECT id, date, time, user_email, user_name, room, end_time, status, created_at FROM bookings WHERE user_email = ? ORDER BY date, time`;
  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST: Cancel a booking
router.post("/cancel", async (req, res) => {
  const { id, email } = req.body;
  if (!id || !email) return res.status(400).json({ error: "Missing booking ID or email" });

  const sql = `UPDATE bookings SET status = 'cancelled' WHERE id = ? AND user_email = ?`;
  db.query(sql, [id, email], async (err) => {
    if (err) return res.status(500).json({ error: err.message });

    const bookingSql = `SELECT room, date, time, end_time FROM bookings WHERE id = ?`;
    db.query(bookingSql, [id], async (bookingErr, bookingResults) => {
      let bookingDetails = "";
      if (!bookingErr && bookingResults.length > 0) {
        const { room, date, time, end_time } = bookingResults[0];
        bookingDetails = `<p>Details: ${room} on ${date} from ${formatTimeForDisplay(time)} to ${formatTimeForDisplay(end_time)}</p>`; // Format times for email
      }
      try {
        await sendEmail(email, "Meeting Room Booking Cancelled", `<p>Your meeting room booking has been cancelled.</p>${bookingDetails}`);
      } catch (mailErr) {
        console.error("Email sending failed:", mailErr.message);
      }
      res.json({ message: "Booking cancelled" });
    });
  });
});

// POST: Edit a booking
router.post("/edit", async (req, res) => {
  // Renamed newTime to newStartTime to match frontend payload
  const { id, newStartTime, newEndTime, room, date, userEmail } = req.body;
  if (!id || !newStartTime || !newEndTime || !room || !date || !userEmail) {
    console.error("Missing parameters for edit:", { id, newStartTime, newEndTime, room, date, userEmail });
    return res.status(400).json({ error: "Missing parameters" });
  }

  // Get the single-hour slots the new booking will occupy
  const newOccupiedSlots = getSlotRange(newStartTime, newEndTime);

  const checkSql = `
    SELECT time, end_time FROM bookings
    WHERE date = ? AND room = ? AND id != ? AND status != 'cancelled'
  `;
  db.query(checkSql, [date, room, id], (checkErr, existingBookings) => {
    if (checkErr) {
      console.error("Error checking for conflicts during edit:", checkErr);
      return res.status(500).json({ error: checkErr.message });
    }

    let conflict = false;
    for (const booking of existingBookings) {
      // Get the single-hour slots the existing booking occupies
      const existingOccupiedSlots = getSlotRange(
        formatTimeForDisplay(booking.time), // Convert 24-hour DB time to 12-hour for getSlotRange
        formatTimeForDisplay(booking.end_time) // Convert 24-hour DB time to 12-hour for getSlotRange
      );

      // Check if any of the new booking's occupied slots overlap with existing occupied slots
      if (newOccupiedSlots.some((s) => existingOccupiedSlots.includes(s))) {
        conflict = true;
        break;
      }
    }

    if (conflict) {
      return res.status(409).json({ error: "The new time slot conflicts with an existing booking." });
    }

    // Convert new start/end times to 24-hour format for DB storage
    const newStartTime24 = convertTo24Hour(newStartTime);
    const newEndTime24 = convertTo24Hour(newEndTime);

    const updateSql = `UPDATE bookings SET time = ?, end_time = ?, status = 'pending' WHERE id = ? AND user_email = ?`;
    db.query(updateSql, [newStartTime24, newEndTime24, id, userEmail], async (updateErr) => {
      if (updateErr) {
        console.error("Error updating booking:", updateErr);
        return res.status(500).json({ error: updateErr.message });
      }

      try {
        await sendEmail(
          userEmail,
          "Meeting Room Booking Edited",
          `<p>Your booking for ${room} on ${date} has been updated to <strong>${newStartTime} - ${newEndTime}</strong>. It is now pending approval.</p>`
        );
      } catch (mailErr) {
        console.error("Email sending failed:", mailErr.message);
      }
      res.json({ message: "Booking updated and pending approval" });
    });
  });
});

// GET: Approved bookings (now filters by userEmail if provided)
router.get('/approved', (req, res) => {
  const { userEmail } = req.query;

  let query = `
    SELECT id, date, time, user_email, user_name, room, end_time, status, created_at
    FROM bookings
    WHERE status = 'approved'
  `;
  const queryParams = [];

  if (userEmail) {
    query += ` AND user_email = ?`;
    queryParams.push(userEmail);
  }

  query += ` ORDER BY date ASC, time ASC`;

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error("Error fetching approved bookings:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});


// --- NEW ENDPOINT FOR ROOM DETAILS ---
// This array represents your room metadata.
// In a production app, this would typically be fetched from a 'rooms' table in your database.
const roomData = [
  { name: "Meeting Room A", capacity: 8, amenities: ["Projector", "Whiteboard", "Video Conferencing"] },
  { name: "Meeting Room B", capacity: 4, amenities: ["Whiteboard"] },
  { name: "Meeting Room C", capacity: 12, amenities: ["Projector", "Video Conferencing", "Sound System"] },
  { name: "Meeting Room D", capacity: 6, amenities: ["Projector"] },
  { name: "Meeting Room E", capacity: 10, amenities: ["Whiteboard", "TV Screen"] }
];

router.get('/rooms', (req, res) => {
  try {
    res.json(roomData); // Send the room details
  } catch (error) {
    console.error("Error fetching room details:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});


module.exports = router;