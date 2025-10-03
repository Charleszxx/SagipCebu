const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: "10mb" })); // for JSON with base64 images
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Database setup
const dbFile = path.join(__dirname, "pins.db");
const db = new sqlite3.Database(dbFile);

// Initialize table
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS pins (
      id TEXT PRIMARY KEY,
      name TEXT,
      contact TEXT,
      address TEXT,
      supplies TEXT,
      priority TEXT,
      notes TEXT,
      photo TEXT,
      status TEXT,
      verified INTEGER,
      lat REAL,
      lng REAL,
      created INTEGER
    )
  `);
});

// 📌 Get all pins
app.get("/api/pins", (req, res) => {
  db.all("SELECT * FROM pins", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    // Convert verified back to boolean & supplies to array
    const pins = rows.map(r => ({
      ...r,
      verified: !!r.verified,
      supplies: r.supplies ? r.supplies.split("|") : []
    }));
    res.json(pins);
  });
});

// Admin login endpoint
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Incorrect password" });
  }
});

// 📌 Add a pin
app.post("/api/pins", (req, res) => {
  const {
    id, name, contact, address, supplies,
    priority, notes, photo, status,
    verified, lat, lng, created
  } = req.body;

  const sql = `
    INSERT INTO pins
    (id, name, contact, address, supplies, priority, notes, photo, status, verified, lat, lng, created)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [
    id, name, contact, address,
    (supplies || []).join("|"),
    priority, notes, photo,
    status, verified ? 1 : 0,
    lat, lng, created
  ], err => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// 📌 Update pin (status or verified)
app.put("/api/pins/:id", (req, res) => {
  const { id } = req.params;
  const fields = [];
  const values = [];

  if (req.body.status !== undefined) {
    fields.push("status = ?");
    values.push(req.body.status);
  }
  if (req.body.verified !== undefined) {
    fields.push("verified = ?");
    values.push(req.body.verified ? 1 : 0);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  values.push(id);

  const sql = `UPDATE pins SET ${fields.join(", ")} WHERE id = ?`;

  db.run(sql, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

// 📌 Delete a pin
app.delete("/api/pins/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM pins WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deleted: this.changes });
  });
});

// 📌 Clear all pins (for demo reset)
app.delete("/api/pins", (req, res) => {
  db.run("DELETE FROM pins", [], err => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Health check
app.get("/", (req, res) => {
  res.send("SagipCebu API is running ✅");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
