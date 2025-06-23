const express = require("express");
const router = express.Router();
const db = require("../db");

// Get all bookings
router.get("/bookings", (req, res) => {
  db.query("SELECT * FROM bookings ORDER BY date DESC", (err, rows) => {
    if (err) return res.status(500).send("DB error");
    res.json(rows);
  });
});

router.post('/update-status', (req, res) => {
  const { id, status } = req.body;

  // Validate inputs
  if (!id || !status) {
    return res.status(400).json({ error: "Missing booking ID or status" });
  }

  // Validate status value
  const allowedStatuses = ['pending', 'approved', 'rejected'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  const query = `UPDATE bookings SET status = ? WHERE id = ?`;
  db.query(query, [status, id], (err, result) => {
    if (err) {
      console.error("MySQL update error:", err);
      return res.status(500).json({ error: "Failed to update booking status" });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }
    
    res.json({ message: "Status updated successfully" });
  });
});

// Summary: count bookings per day
router.get("/summary", (req, res) => {
  db.query(
    "SELECT date, COUNT(*) as total FROM bookings GROUP BY date ORDER BY date DESC",
    (err, rows) => {
      if (err) return res.status(500).send("Summary error");
      res.json(rows);
    }
  );
});

// In your admin.js backend route
router.get("/stats", async (req, res) => {
  console.log("Stats endpoint hit"); // Debug log
  
  try {
    // Simple test query first
    const [test] = await db.query("SELECT COUNT(*) as total FROM bookings");
    console.log("Test query result:", test); // Debug log

    // Then full stats query
    const [stats] = await db.query(`
      SELECT 
        COUNT(*) as totalBookings,
        SUM(status = 'approved') as approved,
        SUM(status = 'pending') as pending
      FROM bookings
    `);

    console.log("Stats query result:", stats); // Debug log

    res.json({
      totalBookings: stats.totalBookings || 0,
      approved: stats.approved || 0,
      pending: stats.pending || 0,
      approvedChange: 0, // Implement later
      pendingChange: 0,
      maxDailyBookings: stats.totalBookings || 0, // Simplified
      peakDay: {
        date: new Date().toISOString(),
        total: stats.totalBookings || 0
      }
    });

  } catch (err) {
    console.error("Detailed stats error:", err);
    res.status(500).json({ 
      error: "Stats calculation failed",
      details: err.message 
    });
  }
});

module.exports = router;