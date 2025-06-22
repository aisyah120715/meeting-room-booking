const express = require("express");
const router = express.Router();
const db = require("../db"); // Assuming this is your database connection
const sendEmail = require("../utils/mailer"); // Assuming this is your email utility

// Time slots from 8:00am to 4:00pm
const hours = [
  "8:00am", "9:00am", "10:00am", "11:00am",
  "12:00pm", "1:00pm", "2:00pm", "3:00pm", "4:00pm"
];

// Helper to get all slots between start and end (inclusive)
const getSlotRange = (start, end) => {
  const startIndex = hours.indexOf(start);
  const endIndex = hours.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return [];
  return hours.slice(startIndex, endIndex + 1);
};

// GET: Unavailable time slots for a date and room
router.get("/slots", (req, res) => {
  const { date, room } = req.query;
  if (!date || !room) return res.status(400).json({ error: "Missing date or room" });

  const sql = `SELECT time, end_time FROM bookings WHERE date = ? AND room = ? AND status != 'cancelled'`;
  db.query(sql, [date, room], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const booked = new Set();
    results.forEach(({ time, end_time }) => {
      getSlotRange(time, end_time).forEach((slot) => booked.add(slot));
    });

    res.json([...booked]);
  });
});

// POST: Create a new booking
router.post("/create", (req, res) => {
  const { date, startTime, endTime, room, userEmail, userName } = req.body;
  if (!date || !startTime || !endTime || !room || !userEmail || !userName)
    return res.status(400).json({ error: "Missing required fields" });

  // Basic validation to prevent booking in the past
  const bookingDateTime = new Date(`${date}T${startTime}`);
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
      const existingSlots = getSlotRange(existingBooking.time, existingBooking.end_time);
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
    db.query(sqlInsert, [date, startTime, endTime, userEmail, userName, room], async (err) => {
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
            bookingDetails = `<p>Details: ${room} on ${date} from ${time} to ${end_time}</p>`;
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
  const { id, newTime, newEndTime, room, date, userEmail } = req.body;
  if (!id || !newTime || !newEndTime || !room || !date || !userEmail)
    return res.status(400).json({ error: "Missing parameters" });

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
      const bookedSlots = getSlotRange(booking.time, booking.end_time);
      if (newSlots.some((s) => bookedSlots.includes(s))) {
        conflict = true;
        break;
      }
    }

    if (conflict) {
      return res.status(409).json({ error: "The new time slot conflicts with an existing booking." });
    }

    const updateSql = `UPDATE bookings SET time = ?, end_time = ?, status = 'pending' WHERE id = ? AND user_email = ?`;
    db.query(updateSql, [newTime, newEndTime, id, userEmail], async (updateErr) => {
      if (updateErr) {
        console.error("Error updating booking:", updateErr);
        return res.status(500).json({ error: updateErr.message });
      }

      try {
        await sendEmail(
          userEmail,
          "Meeting Room Booking Edited",
          `<p>Your booking for ${room} on ${date} has been updated to <strong>${newTime} - ${newEndTime}</strong>. It is now pending approval.</p>`
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