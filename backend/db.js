const { DatabaseSync } = require("node:sqlite");
const path = require("path");

// The database is a single file stored next to this script
const db = new DatabaseSync(path.join(__dirname, "rentmatch.db"));

// Schema: one row per rental property.
// facilities is stored as comma-separated text, e.g. "Wi-Fi,Washing machine"
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