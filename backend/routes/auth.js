const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Register
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";
  db.query(sql, [name, email, hashedPassword, role], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ message: "User registered" });
  });
});

// Login
// Login
router.post("/login", (req, res) => {
  const { identifier, password } = req.body;
  const sql = "SELECT * FROM users WHERE email = ? OR name = ?";

  db.query(sql, [identifier, identifier], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ error: "User not found" });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.id, role: user.role }, "secretkey", { expiresIn: "1h" });

    res.json({
      token,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  });
});



module.exports = router;
