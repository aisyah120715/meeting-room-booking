const express = require("express");
const router = express.Router();
const db = require("../db");
const sendEmail = require("../utils/mailer");

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

  const sql = `
    INSERT INTO bookings (date, time, end_time, user_email, user_name, room, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `;
  db.query(sql, [date, startTime, endTime, userEmail, userName, room], async (err) => {
    if (err) return res.status(500).json({ error: err.message });

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

    res.json({ message: "Booking created" });
  });
});

// GET: User's bookings
router.get("/user-bookings", (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Missing email" });

  const sql = `SELECT * FROM bookings WHERE user_email = ?`;
  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST: Cancel a booking
router.post("/cancel", async (req, res) => {
  const { id, email } = req.body;
  if (!id || !email) return res.status(400).json({ error: "Missing booking ID or email" });

  const sql = `DELETE FROM bookings WHERE id = ? AND user_email = ?`;
  db.query(sql, [id, email], async (err) => {
    if (err) return res.status(500).json({ error: err.message });

    await sendEmail(email, "Booking Cancelled", `<p>Your booking has been cancelled.</p>`);
    res.json({ message: "Cancelled" });
  });
});

// POST: Edit a booking
router.post("/edit", async (req, res) => {
  const { id, newTime, email } = req.body;
  if (!id || !newTime || !email)
    return res.status(400).json({ error: "Missing parameters" });

  // Get the existing end_time to validate full range
  const getSql = `SELECT end_time FROM bookings WHERE id = ? AND user_email = ?`;
  db.query(getSql, [id, email], (err, result) => {
    if (err || result.length === 0)
      return res.status(500).json({ error: "Could not retrieve booking." });

    const endTime = result[0].end_time;
    const newSlots = getSlotRange(newTime, endTime);

    const checkSql = `
      SELECT time, end_time FROM bookings 
      WHERE id != ? AND status != 'cancelled'
    `;
    db.query(checkSql, [id], (checkErr, existingBookings) => {
      if (checkErr) return res.status(500).json({ error: checkErr.message });

      let conflict = false;
      for (const booking of existingBookings) {
        const bookedSlots = getSlotRange(booking.time, booking.end_time);
        if (bookedSlots.some((s) => newSlots.includes(s))) {
          conflict = true;
          break;
        }
      }

      if (conflict) {
        return res.status(409).json({ error: "Time slot already booked." });
      }

      // Proceed to update
      const updateSql = `UPDATE bookings SET time = ?, status = 'pending' WHERE id = ? AND user_email = ?`;
      db.query(updateSql, [newTime, id, email], async (updateErr) => {
        if (updateErr) return res.status(500).json({ error: updateErr.message });

        await sendEmail(
          email,
          "Booking Edited",
          `<p>Your booking has been updated to <strong>${newTime}</strong>. It is now pending approval.</p>`
        );
        res.json({ message: "Edited" });
      });
    });
  });
});

router.get('/approved', (req, res) => {
  const sql = `SELECT id, date, time, user_email, user_name, status, created_at, room, end_time 
               FROM bookings WHERE status = 'approved' ORDER BY date, time`;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to fetch approved bookings' });
    }
    res.json(results);
  });
});

module.exports = router;
