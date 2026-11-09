// ==================================================
// RENTMATCH AI - BACKEND SERVER
// ==================================================

// Load environment variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./db");

const {
  computeMatch
} = require("./matching");

const {
  parseSearchQuery,
  filterProperties
} = require("./search");

const app = express();
const PORT = process.env.PORT || 3001;


// ==================================================
// MIDDLEWARE
// ==================================================

app.use(cors());
app.use(express.json());

// Log incoming requests
app.use((req, res, next) => {
  console.log(
    `${new Date().toLocaleTimeString()} ${req.method} ${req.url}`
  );

  next();
});


// ==================================================
// FORMAT DATABASE PROPERTY
// ==================================================

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

    facilities: row.facilities
      ? row.facilities.split(",")
      : [],

    foodPolicy: row.food_policy,
    owner: row.owner,
    contact: row.contact,
    availableFrom: row.available_from,
    note: row.note
  };
}


// ==================================================
// HEALTH CHECK
// ==================================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "RentMatch AI backend is running"
  });
});


// ==================================================
// GET ALL PROPERTIES
// ==================================================

app.get("/api/properties", (req, res, next) => {
  try {
    const rows = db.prepare(
      "SELECT * FROM properties"
    ).all();

    res.json(rows.map(formatProperty));

  } catch (err) {
    next(err);
  }
});


// ==================================================
// GET PROPERTY BY ID
// ==================================================

app.get("/api/properties/:id", (req, res, next) => {
  try {
    const row = db.prepare(
      "SELECT * FROM properties WHERE id = ?"
    ).get(req.params.id);

    if (!row) {
      return res.status(404).json({
        error: "Property not found"
      });
    }

    res.json(formatProperty(row));

  } catch (err) {
    next(err);
  }
});


// ==================================================
// SEARCH LOCAL DATABASE PROPERTIES
// ==================================================

app.get("/api/search", (req, res, next) => {
  try {
    const {
      filters,
      errors
    } = parseSearchQuery(req.query);

    if (errors.length) {
      return res.status(400).json({
        error: "Invalid search filters",
        fields: errors
      });
    }

    const properties = db.prepare(
      "SELECT * FROM properties"
    ).all().map(formatProperty);

    res.json(
      filterProperties(properties, filters)
    );

  } catch (err) {
    next(err);
  }
});


// ==================================================
// AI PROPERTY MATCHING
// ==================================================

app.post("/api/match", (req, res, next) => {
  try {
    const body = req.body || {};

    const required = [
      "budget",
      "maxDistance",
      "maxTravelTime",
      "maxDeposit",
      "sharing"
    ];

    const invalid = required.filter(
      (key) =>
        typeof body[key] !== "number" ||
        body[key] <= 0
    );

    if (invalid.length) {
      return res.status(400).json({
        error: "Missing or invalid fields",
        fields: invalid
      });
    }

    const requirements = {
      location: "your location",
      furnished: "Furnished",
      facilities: [],
      ...body
    };

    const rows = db.prepare(
      "SELECT * FROM properties"
    ).all();

    const results = rows
      .map(formatProperty)
      .map((property) => ({
        property,
        ...computeMatch(property, requirements)
      }))
      .sort((a, b) => b.score - a.score);

    res.json(results);

  } catch (err) {
    next(err);
  }
});


// ==================================================
// REAL RENTAL SEARCH - NOBROKER THROUGH API.SH
// ==================================================

const rentalSearchCache = new Map();

const CACHE_DURATION = 10 * 60 * 1000;


// GET /api/external/search

app.get("/api/external/search", async (req, res) => {
  try {

    // Read API key securely
    const apiKey = process.env.APISH_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API key is not configured"
      });
    }

    // Read search parameters
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    const radius = Number(
      req.query.radius || 5
    );

    const maxRent = req.query.maxRent
      ? Number(req.query.maxRent)
      : null;

    const city = req.query.city
      ? String(req.query.city).trim().toLowerCase()
      : null;

    const furnishing = req.query.furnishing
      ? String(req.query.furnishing).trim().toUpperCase()
      : null;


    // Validate coordinates
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return res.status(400).json({
        error: "Valid latitude and longitude are required"
      });
    }


    // Validate radius
    if (
      !Number.isFinite(radius) ||
      radius <= 0 ||
      radius > 50
    ) {
      return res.status(400).json({
        error: "Radius must be between 0 and 50 km"
      });
    }


    // Validate maximum rent
    if (
      maxRent !== null &&
      (!Number.isFinite(maxRent) || maxRent <= 0)
    ) {
      return res.status(400).json({
        error: "Maximum rent must be a positive number"
      });
    }


    // Validate furnishing
    const allowedFurnishing = [
      "FULLY_FURNISHED",
      "SEMI_FURNISHED",
      "NOT_FURNISHED"
    ];

    if (
      furnishing &&
      !allowedFurnishing.includes(furnishing)
    ) {
      return res.status(400).json({
        error: "Invalid furnishing value"
      });
    }


    // Create cache key
    const cacheKey = JSON.stringify({
      lat: lat.toFixed(3),
      lon: lon.toFixed(3),
      radius,
      maxRent,
      city,
      furnishing
    });


    // Check cache
    const cached = rentalSearchCache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.time < CACHE_DURATION
    ) {
      return res.json({
        ...cached.data,
        fromCache: true
      });
    }


    // Build API request
    const url = new URL(
      "https://api.api.sh/nobroker/v1/search"
    );

    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
    url.searchParams.set("radius_km", radius);
    url.searchParams.set("kind", "rent");
    url.searchParams.set("page", "1");

    if (city) {
      url.searchParams.set("city", city);
    }

    if (maxRent !== null) {
      url.searchParams.set("price_max", maxRent);
    }

    if (furnishing) {
      url.searchParams.set("furnishing", furnishing);
    }


    console.log(
      "Searching real NoBroker listings..."
    );


    // Call API.SH
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      signal: AbortSignal.timeout(120000)
    });

    const data = await response.json();


    // Handle errors
    if (!response.ok || data.success === false) {
      console.error(
        "API.SH error:",
        response.status,
        data
      );

      return res.status(
        response.status >= 400 &&
        response.status < 600
          ? response.status
          : 502
      ).json({
        error: "Rental search provider returned an error",
        details:
          data.error ||
          data.message ||
          "Unknown provider error"
      });
    }


    // Prepare result
    const result = {
      source: "NoBroker via API.SH",
      fetchedAt: new Date().toISOString(),
      creditsUsed: data.credits_used ?? null,
      fromCache: false,
      ...data
    };


    // Save cache
    rentalSearchCache.set(cacheKey, {
      time: Date.now(),
      data: result
    });

    res.json(result);

  } catch (error) {

    console.error(
      "External rental search error:",
      error.message
    );

    res.status(502).json({
      error: "Unable to fetch rental listings",

      details:
        error.name === "TimeoutError"
          ? "Rental search request timed out"
          : error.message
    });
  }
});


// ==================================================
// REAL RENTAL SEARCH - 99ACRES THROUGH SCRAPPA
// ==================================================

const acresSearchCache = new Map();

const ACRES_CACHE_DURATION = 10 * 60 * 1000;

const ACRES_RENTAL_SLUG =
  "property-for-rent-in-coimbatore-ffid";


// GET /api/99acres/search

app.get("/api/99acres/search", async (req, res) => {
  try {

    // Read Scrappa API key
    const apiKey = process.env.SCRAPPA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Scrappa API key is not configured"
      });
    }


    // Read page number
    const page = Number(req.query.page || 1);

    if (
      !Number.isInteger(page) ||
      page < 1
    ) {
      return res.status(400).json({
        error: "Page must be a positive integer"
      });
    }


    // Create cache key
    const cacheKey =
      `99acres:${ACRES_RENTAL_SLUG}:${page}`;


    // Check cache
    const cached = acresSearchCache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.time < ACRES_CACHE_DURATION
    ) {
      return res.json({
        ...cached.data,
        fromCache: true
      });
    }


    // Build Scrappa API request
    const url = new URL(
      "https://scrappa.co/api/99acres/v1/search"
    );

    url.searchParams.set(
      "slug",
      ACRES_RENTAL_SLUG
    );

    url.searchParams.set(
      "page",
      String(page)
    );


    console.log(
      `Searching 99acres rental listings - Page ${page}...`
    );


    // Call Scrappa API
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(30000)
    });


    // Read response
    const data = await response.json();


    // Handle provider errors
    if (
      !response.ok ||
      data.success === false
    ) {
      console.error(
        "Scrappa 99acres error:",
        response.status,
        data
      );

      return res.status(
        response.status >= 400 &&
        response.status < 600
          ? response.status
          : 502
      ).json({
        error: "99acres rental search failed",

        details:
          data.error?.message ||
          data.message ||
          "Unknown provider error"
      });
    }


    // Extract properties
    const properties =
      data.data?.properties || [];


    // Prepare response
    const result = {
      success: true,

      source: "99acres via Scrappa",

      fetchedAt: new Date().toISOString(),

      fromCache: false,

      pagination: {
        page: data.data?.page ?? page,

        count:
          data.data?.count ??
          properties.length,

        perPage:
          data.data?.per_page ??
          properties.length,

        totalPages:
          data.data?.total_pages ??
          1,

        hasMore:
          data.data?.has_more ??
          false
      },

      properties: properties.map((property) => {

        const latitude = Number(property.latitude);
        const longitude = Number(property.longitude);

        return {
          id: property.id,

          name:
            property.heading ||
            property.project ||
            "Rental Property",

          project:
            property.project || null,

          locality:
            property.locality || null,

          city:
            property.city || null,

          state:
            property.state || null,

          rent:
            property.price?.min ??
            property.price?.max ??
            null,

          priceLabel:
            property.price?.label || null,

          currency:
            property.price?.currency || "INR",

          bedrooms:
            property.bedrooms ?? null,

          bathrooms:
            property.bathrooms ?? null,

          latitude:
            Number.isFinite(latitude) && latitude !== 0
              ? latitude
              : null,

          longitude:
            Number.isFinite(longitude) && longitude !== 0
              ? longitude
              : null,

          image:
            property.image || null,

          propertyUrl:
            property.url || null,

          description:
            property.description || null,

          transactionType:
            property.transaction_type || null,

          propertyCategory:
            property.property_category || null,

          source: "99acres"
        };
      })
    };


    // Save successful response in cache
    acresSearchCache.set(cacheKey, {
      time: Date.now(),
      data: result
    });


    return res.json(result);

  } catch (error) {

    console.error(
      "99acres rental search error:",
      error.message
    );

    return res.status(502).json({
      error: "Unable to fetch 99acres rental listings",

      details:
        error.name === "TimeoutError"
          ? "Scrappa request timed out"
          : "External rental search is temporarily unavailable"
    });
  }
});


// ==================================================
// UNKNOWN ROUTES
// ==================================================

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});


// ==================================================
// CENTRAL ERROR HANDLER
// ==================================================

app.use((err, req, res, next) => {
  console.error(
    "Server error:",
    err.message
  );

  res.status(500).json({
    error: "Internal server error"
  });
});


// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, () => {
  console.log(
    `RentMatch API running on http://localhost:${PORT}`
  );
});