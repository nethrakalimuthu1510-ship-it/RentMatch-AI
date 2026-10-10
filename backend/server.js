const express = require("express");
const cors = require("cors");
const db = require("./db");
const { computeMatch } = require("./matching");
 
const app = express();
const PORT = process.env.PORT || 3001;
 
// Allow the frontend (a different origin) to call this API
app.use(cors());
// Parse JSON request bodies
app.use(express.json());
 
// Log every incoming request (method and URL) so activity is visible in the terminal
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleTimeString()}  ${req.method} ${req.url}`);
  next();
});
 
// Convert a database row into the shape the frontend expects.
// The database stores facilities as comma-separated text, so split it into an array.
function formatProperty(row) {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    landmark: row.landmark,
    lat: row.lat,
    lng: row.lng,
    distanceKm: row.distance_km,
    travelTimeMin: row.travel_time_min,
    rent: row.rent,
    deposit: row.deposit,
    sharing: row.sharing,
    furnished: row.furnished,
    facilities: row.facilities ? row.facilities.split(",") : [],
    foodPolicy: row.food_policy,
    owner: row.owner,
    contact: row.contact,
    availableFrom: row.available_from,
    note: row.note
  };
}
 
// GET /api/health - confirms the server is running
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});
 
// GET /api/properties - returns all properties
app.get("/api/properties", (req, res, next) => {
  try {
    const rows = db.prepare("SELECT * FROM properties").all();
    res.json(rows.map(formatProperty));
  } catch (err) {
    next(err);
  }
});
 
// GET /api/properties/:id - returns one property, or 404 if it doesn't exist
app.get("/api/properties/:id", (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM properties WHERE id = ?").get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: "Property not found" });
    }
    res.json(formatProperty(row));
  } catch (err) {
    next(err);
  }
});
 
// POST /api/match - scores and ranks all properties against the user's requirements.
// Body example: { "budget": 8000, "maxDistance": 3, "maxTravelTime": 25,
//                 "maxDeposit": 25000, "sharing": 2, "furnished": "Furnished",
//                 "facilities": ["Wi-Fi"] }
app.post("/api/match", (req, res, next) => {
  try {
    const body = req.body || {};
 
    // Validate: these fields must be positive numbers, otherwise return 400
    const required = ["budget", "maxDistance", "maxTravelTime", "maxDeposit", "sharing"];
    const invalid = required.filter((k) => typeof body[k] !== "number" || body[k] <= 0);
    if (invalid.length) {
      return res.status(400).json({ error: "Missing or invalid fields", fields: invalid });
    }
 
    // Fill in defaults for the optional fields
    const requirements = { location: "your location", furnished: "Furnished", facilities: [], ...body };
 
    const rows = db.prepare("SELECT * FROM properties").all();
    const results = rows
      .map(formatProperty)
      .map((property) => ({ property, ...computeMatch(property, requirements) }))
      .sort((a, b) => b.score - a.score); // best match first
 
    res.json(results);
  } catch (err) {
    next(err);
  }
});
 
// Unknown routes return a clear 404 instead of an HTML error page
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});
 
// Central error handler: any error passed to next(err) ends up here
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});
 
app.listen(PORT, () => {
  console.log(`RentMatch API running on http://localhost:${PORT}`);
});