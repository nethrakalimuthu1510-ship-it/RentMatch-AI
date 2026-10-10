// search.test.js - unit tests for the search filters.
const { test } = require("node:test");
const assert = require("node:assert");
const { parseSearchQuery, filterProperties } = require("./search");

// Three sample properties with clearly different values
const sample = [
  { id: "a", name: "Alpha House", area: "MG Road", rent: 8000, deposit: 20000, sharing: 2,
    furnished: "Furnished", foodPolicy: "Any", distanceKm: 2,
    facilities: ["Wi-Fi", "Washing machine"] },
  { id: "b", name: "Beta Lodge", area: "Richmond Town", rent: 6000, deposit: 10000, sharing: 3,
    furnished: "Unfurnished", foodPolicy: "Veg only", distanceKm: 4,
    facilities: ["Wi-Fi"] },
  { id: "c", name: "Gamma PG", area: "Indiranagar", rent: 9500, deposit: 30000, sharing: 1,
    furnished: "Furnished", foodPolicy: "Any", distanceKm: 5,
    facilities: ["Wi-Fi", "Washing machine", "Attached bathroom"] }
];

const ids = (list) => list.map((p) => p.id);

test("no filters returns every property", () => {
  assert.deepStrictEqual(ids(filterProperties(sample, {})), ["a", "b", "c"]);
});

test("maxRent keeps only properties at or below that rent", () => {
  assert.deepStrictEqual(ids(filterProperties(sample, { maxRent: 8000 })), ["a", "b"]);
});

test("sharing keeps only exact matches", () => {
  assert.deepStrictEqual(ids(filterProperties(sample, { sharing: 2 })), ["a"]);
});

test("area search ignores case and also matches the property name", () => {
  assert.deepStrictEqual(ids(filterProperties(sample, { area: "richmond" })), ["b"]);
  assert.deepStrictEqual(ids(filterProperties(sample, { area: "gamma" })), ["c"]);
});

test("facilities filter requires every listed facility", () => {
  const result = filterProperties(sample, { facilities: ["Wi-Fi", "Washing machine"] });
  assert.deepStrictEqual(ids(result), ["a", "c"]);
});

test("filters combine: all of them must match", () => {
  const result = filterProperties(sample, { maxRent: 9000, furnished: "Furnished" });
  assert.deepStrictEqual(ids(result), ["a"]);
});

test("sorting by rent ascending orders cheapest first without changing the input", () => {
  const result = filterProperties(sample, { sort: "rent_asc" });
  assert.deepStrictEqual(ids(result), ["b", "a", "c"]);
  assert.deepStrictEqual(ids(sample), ["a", "b", "c"]);
});

test("parseSearchQuery converts text values into typed filters", () => {
  const { filters, errors } = parseSearchQuery({
    maxRent: "8000", facilities: "Wi-Fi, Washing machine", sort: "rent_asc", area: " MG "
  });
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(filters.maxRent, 8000);
  assert.deepStrictEqual(filters.facilities, ["Wi-Fi", "Washing machine"]);
  assert.strictEqual(filters.sort, "rent_asc");
  assert.strictEqual(filters.area, "mg");
});

test("parseSearchQuery reports invalid numbers and unknown sort orders", () => {
  const { errors } = parseSearchQuery({ maxRent: "abc", sharing: "-1", sort: "random" });
  assert.deepStrictEqual(errors.sort(), ["maxRent", "sharing", "sort"]);
});