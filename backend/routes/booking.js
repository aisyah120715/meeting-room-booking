const express = require("express");
const router = express.Router();
const db = require("../db");
const sendEmail = require("../utils/mailer");

// Time slots from 8:00am to 4:00pm
const hours = [
  "8:00am", "9:00am", "10:00am", "11:00am",
  "12:00pm", "1:00pm", "2:00pm", "3:00pm", "4:00pm"
];

// GET: Unavailable time slots for a date and room
router.get("/slots", (req, res) => {
  const { date, room } = req.query;
  if (!date || !room) return res.status(400).json({ error: "Missing date or room" });

  const sql = `SELECT time, end_time FROM bookings WHERE date = ? AND room = ? AND status != 'cancelled'`;
  db.query(sql, [date, room], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Convert database times to frontend format
    const formattedBookings = results.map(booking => {
      return {
        time: booking.time, // Keep in 24-hour format for backend processing
        end_time: booking.end_time,
        start: formatTimeForDisplay(booking.time),
        end: formatTimeForDisplay(booking.end_time)
      };
    });

    res.json(formattedBookings);
  });
});

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

// Helper to get all slots between start and end (inclusive)
const getSlotRange = (start, end) => {
  const startTime = new Date(`2000-01-01T${convertTo24Hour(start)}`);
  const endTime = new Date(`2000-01-01T${convertTo24Hour(end)}`);
  
  if (startTime > endTime) return [];
  
  const slots = [];
  let current = new Date(startTime);
  
  while (current <= endTime) {
    const hours = current.getHours();
    const minutes = current.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    slots.push(`${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`);
    current.setHours(current.getHours() + 1);
  }
  
  return slots;
};

// Helper to convert frontend time (H:MMam/pm) to 24-hour format (HH:MM:SS)
function convertTo24Hour(timeStr) {
  if (!timeStr) return "";
  const [time, period] = timeStr.split(/(am|pm)/i);
  let [hours, minutes] = time.split(':').map(Number);
  
  if (period.toLowerCase() === 'pm' && hours !== 12) {
    hours += 12;
  } else if (period.toLowerCase() === 'am' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
}

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
  const newBookingSlots = getSlotRange(startTime, endTime);

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
      const existingSlots = getSlotRange(
        formatTimeForDisplay(existingBooking.time),
        formatTimeForDisplay(existingBooking.end_time)
      );
      
      if (newBookingSlots.some(slot => existingSlots.includes(slot))) {
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

// DELETE: Permanently delete a booking
router.delete("/:id", (req, res) => { // Expects ID in the URL, e.g., /api/booking/123
  const { id } = req.params; // Get ID from URL parameters
  const { email } = req.query; // Expect email as a query parameter for verification

  if (!id || !email) {
    return res.status(400).json({ error: "Missing booking ID or user email for deletion" });
  }

  // First, verify that the booking belongs to the user trying to delete it
  const verifySql = `SELECT user_email FROM bookings WHERE id = ?`;
  db.query(verifySql, [id], (verifyErr, results) => {
    if (verifyErr) {
      console.error("Error verifying booking owner:", verifyErr);
      return res.status(500).json({ error: "Database error during verification" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Booking not found." });
    }

    if (results[0].user_email !== email) {
      return res.status(403).json({ error: "Forbidden: You do not have permission to delete this booking." });
    }

    // If verification passes, proceed with deletion
    const deleteSql = `DELETE FROM bookings WHERE id = ? AND user_email = ?`;
    db.query(deleteSql, [id, email], async (deleteErr) => {
      if (deleteErr) {
        console.error("Error deleting booking:", deleteErr);
        return res.status(500).json({ error: deleteErr.message });
      }

      // Optionally send a deletion confirmation email
      try {
        await sendEmail(email, "Meeting Room Booking Deleted", `<p>Your meeting room booking has been permanently deleted.</p>`);
      } catch (mailErr) {
        console.error("Email sending failed after deletion:", mailErr.message);
      }

      res.json({ message: "Booking deleted successfully!" });
    });
  });
});

// POST: Edit a booking
router.post("/edit", async (req, res) => {
  const { id, newTime, newEndTime, email } = req.body; // Changed userEmail to email to match frontend
  if (!id || !newTime || !newEndTime || !email)
    return res.status(400).json({ error: "Missing parameters" });

  // First get the existing booking details to get room and date
  const getBookingSql = `SELECT room, date FROM bookings WHERE id = ? AND user_email = ?`;
  db.query(getBookingSql, [id, email], (getErr, bookingResults) => {
    if (getErr) {
      console.error("Error fetching booking details:", getErr);
      return res.status(500).json({ error: getErr.message });
    }

    if (bookingResults.length === 0) {
      return res.status(404).json({ error: "Booking not found or not authorized" });
    }

    const { room, date } = bookingResults[0];

    // Convert frontend display times to 24-hour format for database
    const newTime24 = convertTo24Hour(newTime);
    const newEndTime24 = convertTo24Hour(newEndTime);

    // Get slots in display format for conflict checking
    const newSlots = getSlotRange(newTime, newEndTime);

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
        const bookedSlots = getSlotRange(
          formatTimeForDisplay(booking.time),
          formatTimeForDisplay(booking.end_time)
        );
        if (newSlots.some((s) => bookedSlots.includes(s))) {
          conflict = true;
          break;
        }
      }

      if (conflict) {
        return res.status(409).json({ error: "The new time slot conflicts with an existing booking." });
      }

      // Update with 24-hour format times
      const updateSql = `UPDATE bookings SET time = ?, end_time = ?, status = 'pending' WHERE id = ? AND user_email = ?`;
      db.query(
        updateSql, 
        [newTime24, newEndTime24, id, email], 
        async (updateErr) => {
          if (updateErr) {
            console.error("Error updating booking:", updateErr);
            return res.status(500).json({ error: updateErr.message });
          }

          try {
            await sendEmail(
              email,
              "Meeting Room Booking Edited",
              `<p>Your booking for ${room} on ${date} has been updated to <strong>${newTime} - ${newEndTime}</strong>. It is now pending approval.</p>`
            );
          } catch (mailErr) {
            console.error("Email sending failed:", mailErr.message);
          }
          res.json({ message: "Booking updated and pending approval" });
        }
      );
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