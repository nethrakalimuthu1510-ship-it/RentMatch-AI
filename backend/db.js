const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Original database bundled with the project
const sourcePath = path.join(__dirname, "rentmatch.db");

// Writable temporary database location on Vercel
const dbPath = path.join(os.tmpdir(), "rentmatch.db");

// Copy the original database to /tmp if it does not already exist
if (!fs.existsSync(dbPath)) {
    if (!fs.existsSync(sourcePath)) {
        throw new Error("rentmatch.db not found in backend folder");
    }

    fs.copyFileSync(sourcePath, dbPath);
}

// Open the writable database
const db = new DatabaseSync(dbPath);

// Ensure the properties table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    area             TEXT NOT NULL,
    landmark         TEXT,
    lat              REAL NOT NULL,
    lng              REAL NOT NULL,
    distance_km      REAL,
    travel_time_min  INTEGER,
    rent             INTEGER NOT NULL,
    deposit          INTEGER NOT NULL,
    sharing          INTEGER NOT NULL,
    furnished        TEXT NOT NULL,
    facilities       TEXT,
    food_policy      TEXT,
    owner            TEXT,
    contact          TEXT,
    available_from   TEXT,
    note             TEXT
  )
`);

module.exports = db;