// matching.js - scoring logic for RentMatch AI.
// Weights: Budget 25, Distance 20, Travel time 15, Deposit 15,
// Facilities 15, Furnishing 5, Sharing 5 = 100

const ALL_FACILITIES = ["Wi-Fi", "Washing machine", "Attached bathroom"];

// Straight-line distance in km between two lat/lng points (Haversine formula)
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Rough travel time: ~18 km/h city speed plus 4 minutes fixed overhead
function estimateTravelTimeMin(distanceKm) {
  return Math.max(5, Math.round((distanceKm / 18) * 60 + 4));
}

// Uses real computed values if the user gave exact coordinates,
// otherwise falls back to the values stored for the property.
function getDistanceAndTime(property, req) {
  if (req.locationLat != null && req.locationLng != null) {
    const km = haversineDistanceKm(req.locationLat, req.locationLng, property.lat, property.lng);
    return { distanceKm: Math.round(km * 10) / 10, travelTimeMin: estimateTravelTimeMin(km) };
  }
  return { distanceKm: property.distanceKm, travelTimeMin: property.travelTimeMin };
}

// Scores one property (0-100) against the user's requirements
// and returns a per-criterion breakdown explaining the score.
function computeMatch(property, req) {
  const breakdown = [];
  let score = 0;
  const { distanceKm, travelTimeMin } = getDistanceAndTime(property, req);

  // Budget (25): full marks if within budget, partial if up to 15% over
  let budgetPts = 0, budgetStatus = "fail";
  if (property.rent <= req.budget) {
    budgetPts = 25; budgetStatus = "pass";
  } else {
    const overPct = (property.rent - req.budget) / req.budget;
    if (overPct <= 0.15) { budgetPts = 15; budgetStatus = "partial"; }
    else { budgetPts = Math.max(0, 25 - Math.round(overPct * 60)); }
  }
  score += budgetPts;
  breakdown.push({ label: "Budget", status: budgetStatus,
    text: `\u20b9${property.rent} vs your \u20b9${req.budget} budget` });

  // Distance (20): partial if within 1 km over the limit
  let distPts = 0, distStatus = "fail";
  if (distanceKm <= req.maxDistance) {
    distPts = 20; distStatus = "pass";
  } else {
    const overKm = distanceKm - req.maxDistance;
    if (overKm <= 1) { distPts = 12; distStatus = "partial"; }
    else { distPts = Math.max(0, 20 - Math.round(overKm * 8)); }
  }
  score += distPts;
  breakdown.push({ label: "Distance", status: distStatus,
    text: `${distanceKm} km vs your ${req.maxDistance} km limit` });

  // Travel time (15): partial if within 5 minutes over the limit
  let timePts = 0, timeStatus = "fail";
  if (travelTimeMin <= req.maxTravelTime) {
    timePts = 15; timeStatus = "pass";
  } else {
    const overMin = travelTimeMin - req.maxTravelTime;
    if (overMin <= 5) { timePts = 9; timeStatus = "partial"; }
    else { timePts = Math.max(0, 15 - Math.round(overMin * 0.6)); }
  }
  score += timePts;
  breakdown.push({ label: "Travel time", status: timeStatus,
    text: `${travelTimeMin} min to ${req.location}` });

  // Deposit (15): partial if up to 15% over the limit
  let depPts = 0, depStatus = "fail";
  if (property.deposit <= req.maxDeposit) {
    depPts = 15; depStatus = "pass";
  } else {
    const overPct = (property.deposit - req.maxDeposit) / req.maxDeposit;
    if (overPct <= 0.15) { depPts = 9; depStatus = "partial"; }
    else { depPts = Math.max(0, 15 - Math.round(overPct * 40)); }
  }
  score += depPts;
  breakdown.push({ label: "Deposit", status: depStatus,
    text: `\u20b9${property.deposit} vs your \u20b9${req.maxDeposit} limit` });

  // Facilities (15): proportional to how many required facilities exist
  const wanted = req.facilities && req.facilities.length ? req.facilities : ALL_FACILITIES;
  const matched = wanted.filter((f) => property.facilities.includes(f));
  score += Math.round((matched.length / wanted.length) * 15);
  breakdown.push({
    label: "Facilities",
    status: matched.length === wanted.length ? "pass" : matched.length > 0 ? "partial" : "fail",
    text: `${matched.length} of ${wanted.length} required facilities available`
  });

  // Furnishing (5): exact match only
  const furnMatch = property.furnished === req.furnished;
  score += furnMatch ? 5 : 0;
  breakdown.push({ label: "Furnishing", status: furnMatch ? "pass" : "fail",
    text: `${property.furnished} vs preferred ${req.furnished}` });

  // Sharing (5): full marks for exact match, 2 points if off by one
  const sharingDiff = Math.abs(property.sharing - req.sharing);
  const sharingPts = sharingDiff === 0 ? 5 : sharingDiff === 1 ? 2 : 0;
  score += sharingPts;
  breakdown.push({
    label: "Sharing",
    status: sharingDiff === 0 ? "pass" : sharingDiff === 1 ? "partial" : "fail",
    text: `${property.sharing} sharing vs your preference of ${req.sharing}`
  });

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    breakdown,
    distanceKm,
    travelTimeMin
  };
}

module.exports = { haversineDistanceKm, estimateTravelTimeMin, getDistanceAndTime, computeMatch };