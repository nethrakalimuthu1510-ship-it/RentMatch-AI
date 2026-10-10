const db = require("./db");

// Same 8 properties that were hardcoded in the frontend script.js
const properties = [
  ["sunny-veda", "Sunny Veda Residency", "MG Road", 12.9757, 77.6069, 2.1, 15, 8000, 20000, 2, "Furnished", "Wi-Fi,Washing machine,Attached bathroom", "Any", "R. Menon", "98450 12345", "2026-06-01", ""],
  ["orchid-nest", "Orchid Nest", "Langford Town", 12.9581, 77.6068, 2.4, 17, 7600, 18000, 2, "Furnished", "Wi-Fi,Washing machine,Attached bathroom", "Veg only", "S. Iyer", "97400 23456", "2026-06-05", ""],
  ["maple-residency", "Maple Residency", "Shivaji Nagar", 12.9857, 77.6057, 1.8, 12, 7500, 20000, 2, "Furnished", "Wi-Fi,Attached bathroom", "Any", "K. Das", "96200 34567", "2026-06-01", "Washing machine shared on the floor, not in-room"],
  ["verdant-court", "Verdant Court", "Cunningham Road", 12.9865, 77.5946, 2.7, 19, 9200, 25000, 2, "Furnished", "Wi-Fi,Washing machine,Attached bathroom", "Any", "P. Fernandes", "99860 45678", "2026-06-10", ""],
  ["saffron-house", "Saffron House", "Brigade Road", 12.9716, 77.607, 0.9, 8, 8400, 22000, 1, "Semi-furnished", "Wi-Fi,Attached bathroom", "Any", "N. Rao", "90080 56789", "2026-06-01", "Electricity billed separately, average unknown"],
  ["juniper-lane", "Juniper Lane", "Richmond Town", 12.9611, 77.6006, 3.4, 24, 6800, 12000, 3, "Unfurnished", "Wi-Fi", "Any", "A. Bhat", "94480 67890", "2026-06-15", ""],
  ["lotus-manor", "Lotus Manor", "Frazer Town", 12.9944, 77.6106, 4.6, 30, 7200, 15000, 2, "Semi-furnished", "Wi-Fi,Washing machine", "Veg only", "T. George", "98860 78901", "2026-06-08", ""],
  ["birchwood-pg", "Birchwood PG", "Indiranagar", 12.9719, 77.6412, 5.2, 35, 9800, 30000, 1, "Furnished", "Wi-Fi,Washing machine,Attached bathroom", "Any", "M. Sequeira", "97690 89012", "2026-06-01", ""]
];

// INSERT OR REPLACE lets you run this script again safely
const insert = db.prepare(`
  INSERT OR REPLACE INTO properties
  (id, name, area, landmark, lat, lng, distance_km, travel_time_min, rent, deposit,
   sharing, furnished, facilities, food_policy, owner, contact, available_from, note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const p of properties) {
  const [id, name, area, lat, lng, ...rest] = p;
  insert.run(id, name, area, "St. Joseph's College", lat, lng, ...rest);
}

const count = db.prepare("SELECT COUNT(*) AS n FROM properties").get().n;
console.log(`Seeded database. Properties in table: ${count}`);