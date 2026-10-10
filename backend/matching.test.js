// matching.test.js - unit tests for the matching engine.
// Uses Node's built-in test runner, so no extra packages are needed.
const { test } = require("node:test");
const assert = require("node:assert");
const {
  haversineDistanceKm,
  estimateTravelTimeMin,
  computeMatch
} = require("./matching");

// A property and a set of requirements that match each other perfectly
const baseProperty = {
  lat: 12.9757, lng: 77.6069,
  distanceKm: 2.1, travelTimeMin: 15,
  rent: 8000, deposit: 20000, sharing: 2, furnished: "Furnished",
  facilities: ["Wi-Fi", "Washing machine", "Attached bathroom"]
};
const baseReq = {
  location: "MG Road", budget: 8000, maxDistance: 3, maxTravelTime: 25,
  maxDeposit: 25000, sharing: 2, furnished: "Furnished",
  facilities: ["Wi-Fi", "Washing machine", "Attached bathroom"]
};

test("a perfect match scores 100", () => {
  assert.strictEqual(computeMatch(baseProperty, baseReq).score, 100);
});

test("rent far over budget scores 0 for budget and is marked fail", () => {
  const result = computeMatch({ ...baseProperty, rent: 12000 }, baseReq);
  assert.strictEqual(result.score, 75);
  assert.strictEqual(result.breakdown[0].status, "fail");
});

test("rent up to 15% over budget gives partial marks", () => {
  const result = computeMatch({ ...baseProperty, rent: 8800 }, baseReq);
  assert.strictEqual(result.score, 90);
  assert.strictEqual(result.breakdown[0].status, "partial");
});

test("missing one of three facilities gives partial facility marks", () => {
  const property = { ...baseProperty, facilities: ["Wi-Fi", "Washing machine"] };
  const result = computeMatch(property, baseReq);
  assert.strictEqual(result.score, 95);
  assert.strictEqual(result.breakdown[4].status, "partial");
});

test("exact coordinates override the stored distance and time", () => {
  const req = { ...baseReq, locationLat: baseProperty.lat, locationLng: baseProperty.lng };
  const result = computeMatch(baseProperty, req);
  assert.strictEqual(result.distanceKm, 0);
  assert.strictEqual(result.travelTimeMin, 5);
});

test("a very poor match scores 0 and never goes negative", () => {
  const bad = {
    ...baseProperty, rent: 100000, deposit: 1000000, sharing: 3,
    furnished: "Unfurnished", facilities: [], distanceKm: 50, travelTimeMin: 200
  };
  const req = { ...baseReq, sharing: 1 };
  assert.strictEqual(computeMatch(bad, req).score, 0);
});

test("haversine distance between identical points is 0", () => {
  assert.strictEqual(haversineDistanceKm(12.97, 77.6, 12.97, 77.6), 0);
});

test("haversine distance for 1 degree of latitude is about 111 km", () => {
  const km = haversineDistanceKm(12, 77, 13, 77);
  assert.ok(Math.abs(km - 111.19) < 0.1);
});

test("estimated travel time is never below 5 minutes", () => {
  assert.strictEqual(estimateTravelTimeMin(0), 5);
});