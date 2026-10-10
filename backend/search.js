// search.js - filtering and sorting logic for the Search page (GET /api/search).
// Kept separate from server.js so it can be unit tested without a database.

// Sort orders the client may request with ?sort=
const SORT_OPTIONS = ["rent_asc", "rent_desc", "deposit_asc", "distance_asc"];

// Turns the raw query string values (always text) into a clean filters object.
// Returns { filters, errors } where errors lists the names of invalid fields,
// so the server can answer 400 instead of silently ignoring bad input.
function parseSearchQuery(query) {
  const filters = {};
  const errors = [];

  // Numeric filters must be positive numbers
  for (const key of ["maxRent", "maxDeposit", "sharing"]) {
    if (query[key] !== undefined && query[key] !== "") {
      const value = Number(query[key]);
      if (!Number.isFinite(value) || value <= 0) {
        errors.push(key);
      } else {
        filters[key] = value;
      }
    }
  }

  // Text filters
  if (query.area) filters.area = String(query.area).trim().toLowerCase();
  if (query.furnished) filters.furnished = String(query.furnished).trim();
  if (query.foodPolicy) filters.foodPolicy = String(query.foodPolicy).trim();

  // Facilities arrive as a comma-separated list, e.g. "Wi-Fi,Washing machine"
  if (query.facilities) {
    filters.facilities = String(query.facilities)
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);
  }

  // Sort order must be one of the supported options
  if (query.sort) {
    if (SORT_OPTIONS.includes(query.sort)) {
      filters.sort = query.sort;
    } else {
      errors.push("sort");
    }
  }

  return { filters, errors };
}

// Keeps only the properties that satisfy every filter that was provided,
// then sorts them if a sort order was requested. Does not change the input array.
function filterProperties(properties, filters) {
  const results = properties.filter((p) => {
    if (filters.maxRent !== undefined && p.rent > filters.maxRent) return false;
    if (filters.maxDeposit !== undefined && p.deposit > filters.maxDeposit) return false;
    if (filters.sharing !== undefined && p.sharing !== filters.sharing) return false;
    // Area text matches either the area or the property name, ignoring case
    if (
      filters.area &&
      !p.area.toLowerCase().includes(filters.area) &&
      !p.name.toLowerCase().includes(filters.area)
    ) {
      return false;
    }
    if (filters.furnished && p.furnished !== filters.furnished) return false;
    if (filters.foodPolicy && p.foodPolicy !== filters.foodPolicy) return false;
    // Every requested facility must be present
    if (filters.facilities && !filters.facilities.every((f) => p.facilities.includes(f))) {
      return false;
    }
    return true;
  });

  const sorters = {
    rent_asc: (a, b) => a.rent - b.rent,
    rent_desc: (a, b) => b.rent - a.rent,
    deposit_asc: (a, b) => a.deposit - b.deposit,
    distance_asc: (a, b) => a.distanceKm - b.distanceKm
  };
  return filters.sort ? [...results].sort(sorters[filters.sort]) : results;
}

module.exports = { SORT_OPTIONS, parseSearchQuery, filterProperties };