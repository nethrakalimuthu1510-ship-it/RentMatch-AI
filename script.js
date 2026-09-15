/* ============================================================
   RentMatch AI — shared logic
   Loaded by index.html, compare.html and shortlist.html.
   Each page only renders the sections whose elements exist,
   so one file can safely run on all three pages.
============================================================ */

/* ---------- Property data ---------- */
/* In a real app this would come from a backend / API.
   For this project it's a hardcoded dataset. */
const PROPERTIES = [
  {
    id: "sunny-veda",
    lat: 12.9757,
    lng: 77.6069,
    name: "Sunny Veda Residency",
    area: "MG Road",
    distanceKm: 2.1,
    travelTimeMin: 15,
    landmark: "St. Joseph's College",
    rent: 8000,
    deposit: 20000,
    sharing: 2,
    furnished: "Furnished",
    facilities: ["Wi-Fi", "Washing machine", "Attached bathroom"],
    foodPolicy: "Any",
    owner: "R. Menon",
    contact: "98450 12345",
    availableFrom: "2026-06-01",
    note: ""
  },
  {
    id: "orchid-nest",
    lat: 12.9581,
    lng: 77.6068,
    name: "Orchid Nest",
    area: "Langford Town",
    distanceKm: 2.4,
    travelTimeMin: 17,
    landmark: "St. Joseph's College",
    rent: 7600,
    deposit: 18000,
    sharing: 2,
    furnished: "Furnished",
    facilities: ["Wi-Fi", "Washing machine", "Attached bathroom"],
    foodPolicy: "Veg only",
    owner: "S. Iyer",
    contact: "97400 23456",
    availableFrom: "2026-06-05",
    note: ""
  },
  {
    id: "maple-residency",
    lat: 12.9857,
    lng: 77.6057,
    name: "Maple Residency",
    area: "Shivaji Nagar",
    distanceKm: 1.8,
    travelTimeMin: 12,
    landmark: "St. Joseph's College",
    rent: 7500,
    deposit: 20000,
    sharing: 2,
    furnished: "Furnished",
    facilities: ["Wi-Fi", "Attached bathroom"],
    foodPolicy: "Any",
    owner: "K. Das",
    contact: "96200 34567",
    availableFrom: "2026-06-01",
    note: "Washing machine shared on the floor, not in-room"
  },
  {
    id: "verdant-court",
    lat: 12.9865,
    lng: 77.5946,
    name: "Verdant Court",
    area: "Cunningham Road",
    distanceKm: 2.7,
    travelTimeMin: 19,
    landmark: "St. Joseph's College",
    rent: 9200,
    deposit: 25000,
    sharing: 2,
    furnished: "Furnished",
    facilities: ["Wi-Fi", "Washing machine", "Attached bathroom"],
    foodPolicy: "Any",
    owner: "P. Fernandes",
    contact: "99860 45678",
    availableFrom: "2026-06-10",
    note: ""
  },
  {
    id: "saffron-house",
    lat: 12.9716,
    lng: 77.607,
    name: "Saffron House",
    area: "Brigade Road",
    distanceKm: 0.9,
    travelTimeMin: 8,
    landmark: "St. Joseph's College",
    rent: 8400,
    deposit: 22000,
    sharing: 1,
    furnished: "Semi-furnished",
    facilities: ["Wi-Fi", "Attached bathroom"],
    foodPolicy: "Any",
    owner: "N. Rao",
    contact: "90080 56789",
    availableFrom: "2026-06-01",
    note: "Electricity billed separately, average unknown"
  },
  {
    id: "juniper-lane",
    lat: 12.9611,
    lng: 77.6006,
    name: "Juniper Lane",
    area: "Richmond Town",
    distanceKm: 3.4,
    travelTimeMin: 24,
    landmark: "St. Joseph's College",
    rent: 6800,
    deposit: 12000,
    sharing: 3,
    furnished: "Unfurnished",
    facilities: ["Wi-Fi"],
    foodPolicy: "Any",
    owner: "A. Bhat",
    contact: "94480 67890",
    availableFrom: "2026-06-15",
    note: ""
  },
  {
    id: "lotus-manor",
    lat: 12.9944,
    lng: 77.6106,
    name: "Lotus Manor",
    area: "Frazer Town",
    distanceKm: 4.6,
    travelTimeMin: 30,
    landmark: "St. Joseph's College",
    rent: 7200,
    deposit: 15000,
    sharing: 2,
    furnished: "Semi-furnished",
    facilities: ["Wi-Fi", "Washing machine"],
    foodPolicy: "Veg only",
    owner: "T. George",
    contact: "98860 78901",
    availableFrom: "2026-06-08",
    note: ""
  },
  {
    id: "birchwood-pg",
    lat: 12.9719,
    lng: 77.6412,
    name: "Birchwood PG",
    area: "Indiranagar",
    distanceKm: 5.2,
    travelTimeMin: 35,
    landmark: "St. Joseph's College",
    rent: 9800,
    deposit: 30000,
    sharing: 1,
    furnished: "Furnished",
    facilities: ["Wi-Fi", "Washing machine", "Attached bathroom"],
    foodPolicy: "Any",
    owner: "M. Sequeira",
    contact: "97690 89012",
    availableFrom: "2026-06-01",
    note: ""
  }
];

const ALL_FACILITIES = ["Wi-Fi", "Washing machine", "Attached bathroom"];

/* ---------- Real distance calculation ---------- */
/* Haversine formula: straight-line ("as the crow flies") distance
   in km between two lat/lng points. This is the standard way to
   compute distance client-side without a paid maps API. Actual
   road distance will usually be a bit longer than this number. */
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Rough travel-time estimate from straight-line distance, assuming
// ~18 km/h effective city speed (accounts for traffic/stops), with
// a small fixed overhead for getting in/out of the building.
function estimateTravelTimeMin(distanceKm) {
  return Math.max(5, Math.round((distanceKm / 18) * 60 + 4));
}

// Returns the distance/time to use for a property: real, computed
// values if the user has set an exact location, otherwise the
// dataset's mock values.
function getDistanceAndTime(property, req) {
  if (req.locationLat != null && req.locationLng != null) {
    const distanceKm = haversineDistanceKm(req.locationLat, req.locationLng, property.lat, property.lng);
    return {
      distanceKm: Math.round(distanceKm * 10) / 10,
      travelTimeMin: estimateTravelTimeMin(distanceKm),
      exact: true
    };
  }
  return { distanceKm: property.distanceKm, travelTimeMin: property.travelTimeMin, exact: false };
}

const DEFAULT_REQUIREMENTS = {
  location: "",
  locationLat: null,
  locationLng: null,
  budget: 8000,
  maxDistance: 3,
  maxTravelTime: 25,
  maxDeposit: 25000,
  sharing: 2,
  furnished: "Furnished",
  facilities: ["Wi-Fi", "Washing machine", "Attached bathroom"],
  foodPolicy: "Any"
};

/* ---------- localStorage helpers ---------- */
const STORAGE_KEYS = {
  requirements: "rentmatch_requirements"
};

function hasSavedRequirements() {
  return localStorage.getItem(STORAGE_KEYS.requirements) !== null;
}

function getRequirements() {
  const raw = localStorage.getItem(STORAGE_KEYS.requirements);
  if (!raw) return { ...DEFAULT_REQUIREMENTS };
  try {
    return { ...DEFAULT_REQUIREMENTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_REQUIREMENTS };
  }
}

function saveRequirements(req) {
  localStorage.setItem(STORAGE_KEYS.requirements, JSON.stringify(req));
}

/* ---------- Matching engine ---------- */
/* Weights: Budget 25, Distance 20, Travel time 15, Deposit 15,
   Facilities 15, Furnishing 5, Sharing 5 = 100 */
function computeMatch(property, req) {
  const breakdown = [];
  let score = 0;
  const { distanceKm, travelTimeMin } = getDistanceAndTime(property, req);

  // Budget (25)
  let budgetPts = 0;
  let budgetStatus = "fail";
  if (property.rent <= req.budget) {
    budgetPts = 25;
    budgetStatus = "pass";
  } else {
    const overPct = (property.rent - req.budget) / req.budget;
    if (overPct <= 0.15) {
      budgetPts = 15;
      budgetStatus = "partial";
    } else {
      budgetPts = Math.max(0, 25 - Math.round(overPct * 60));
      budgetStatus = "fail";
    }
  }
  score += budgetPts;
  breakdown.push({
    label: "Budget",
    status: budgetStatus,
    text: `\u20b9${property.rent.toLocaleString("en-IN")} vs your \u20b9${req.budget.toLocaleString("en-IN")} budget`
  });

  // Distance (20)
  let distPts = 0;
  let distStatus = "fail";
  if (distanceKm <= req.maxDistance) {
    distPts = 20;
    distStatus = "pass";
  } else {
    const overKm = distanceKm - req.maxDistance;
    if (overKm <= 1) {
      distPts = 12;
      distStatus = "partial";
    } else {
      distPts = Math.max(0, 20 - Math.round(overKm * 8));
      distStatus = "fail";
    }
  }
  score += distPts;
  breakdown.push({
    label: "Distance",
    status: distStatus,
    text: `${distanceKm} km vs your ${req.maxDistance} km limit`
  });

  // Travel time (15)
  let timePts = 0;
  let timeStatus = "fail";
  if (travelTimeMin <= req.maxTravelTime) {
    timePts = 15;
    timeStatus = "pass";
  } else {
    const overMin = travelTimeMin - req.maxTravelTime;
    if (overMin <= 5) {
      timePts = 9;
      timeStatus = "partial";
    } else {
      timePts = Math.max(0, 15 - Math.round(overMin * 0.6));
      timeStatus = "fail";
    }
  }
  score += timePts;
  breakdown.push({
    label: "Travel time",
    status: timeStatus,
    text: `${travelTimeMin} min to ${req.location}`
  });

  // Deposit (15)
  let depPts = 0;
  let depStatus = "fail";
  if (property.deposit <= req.maxDeposit) {
    depPts = 15;
    depStatus = "pass";
  } else {
    const overPct = (property.deposit - req.maxDeposit) / req.maxDeposit;
    if (overPct <= 0.15) {
      depPts = 9;
      depStatus = "partial";
    } else {
      depPts = Math.max(0, 15 - Math.round(overPct * 40));
      depStatus = "fail";
    }
  }
  score += depPts;
  breakdown.push({
    label: "Deposit",
    status: depStatus,
    text: `\u20b9${property.deposit.toLocaleString("en-IN")} vs your \u20b9${req.maxDeposit.toLocaleString("en-IN")} limit`
  });

  // Facilities (15)
  const wanted = req.facilities.length ? req.facilities : ALL_FACILITIES;
  const matched = wanted.filter((f) => property.facilities.includes(f));
  const facPts = Math.round((matched.length / wanted.length) * 15);
  score += facPts;
  breakdown.push({
    label: "Facilities",
    status: matched.length === wanted.length ? "pass" : matched.length > 0 ? "partial" : "fail",
    text: `${matched.length} of ${wanted.length} required facilities available`
  });

  // Furnishing (5)
  const furnMatch = property.furnished === req.furnished;
  score += furnMatch ? 5 : 0;
  breakdown.push({
    label: "Furnishing",
    status: furnMatch ? "pass" : "fail",
    text: `${property.furnished} vs preferred ${req.furnished}`
  });

  // Sharing (5)
  const sharingDiff = Math.abs(property.sharing - req.sharing);
  let sharingPts = 0;
  let sharingStatus = "fail";
  if (sharingDiff === 0) {
    sharingPts = 5;
    sharingStatus = "pass";
  } else if (sharingDiff === 1) {
    sharingPts = 2;
    sharingStatus = "partial";
  }
  score += sharingPts;
  breakdown.push({
    label: "Sharing",
    status: sharingStatus,
    text: `${property.sharing} sharing vs your preference of ${req.sharing}`
  });

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    breakdown,
    distanceKm,
    travelTimeMin,
    exact: req.locationLat != null && req.locationLng != null
  };
}

function estMonthlyCost(property) {
  // Simple estimate: rent + a flat maintenance/electricity guess.
  return property.rent + 950;
}

function statusIcon(status) {
  if (status === "pass") return "\u2713";
  if (status === "partial") return "~";
  return "\u2717";
}

/* ---------- Nav highlighting ---------- */
function highlightNav() {
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.getAttribute("data-nav") === path) {
      link.classList.add("nav-active");
    }
  });
}

/* ============================================================
   INDEX PAGE — requirements form + ranked property list
============================================================ */
let currentCoords = { lat: null, lng: null };

function initIndexPage() {
  const listEl = document.getElementById("property-list");
  if (!listEl) return; // not on this page

  const saved = hasSavedRequirements();
  const req = getRequirements();

  if (saved) {
    currentCoords = { lat: req.locationLat, lng: req.locationLng };
    fillRequirementForm(req);
    renderSummary(req);
    renderAll(req);
    document.getElementById("req-panel").removeAttribute("open");
  } else {
    // Leave the form blank so the user fills it in themselves.
    renderBlankSummary();
    renderEmptyPrompt();
  }

  document.getElementById("requirements-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const newReq = readRequirementForm();
    saveRequirements(newReq);
    renderSummary(newReq);
    renderAll(newReq);
    document.getElementById("req-panel").removeAttribute("open");
  });

  document.getElementById("edit-requirements").addEventListener("click", () => {
    document.getElementById("req-panel").setAttribute("open", "");
  });

  // Typing a new place name invalidates any coordinates found earlier.
  document.getElementById("location").addEventListener("input", () => {
    currentCoords = { lat: null, lng: null };
    setLocationStatus("Click \u201cFind on map\u201d or \u201cUse my location\u201d for exact distances.", "");
  });

  document.getElementById("locate-address").addEventListener("click", async () => {
    const query = document.getElementById("location").value.trim();
    if (!query) {
      setLocationStatus("Type a place name first, then click Find on map.", "error");
      return;
    }
    setLocationStatus("Looking up that location\u2026", "");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const results = await res.json();
      if (!results.length) {
        setLocationStatus("Couldn't find that place. Try a more specific address.", "error");
        return;
      }
      currentCoords = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
      setLocationStatus(`\u2713 Located: ${results[0].display_name}`, "ready");
    } catch {
      setLocationStatus("Location lookup failed. Check your connection and try again.", "error");
    }
  });

  document.getElementById("use-current-location").addEventListener("click", () => {
    if (!navigator.geolocation) {
      setLocationStatus("Your browser doesn't support location access.", "error");
      return;
    }
    setLocationStatus("Getting your current location\u2026", "");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        currentCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setLocationStatus("\u2713 Using your current location", "ready");
        // Best-effort reverse geocode so the text field shows a readable name.
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentCoords.lat}&lon=${currentCoords.lng}`;
          const res = await fetch(url);
          const result = await res.json();
          if (result && result.display_name) {
            document.getElementById("location").value = result.display_name;
            setLocationStatus(`\u2713 Using your current location: ${result.display_name}`, "ready");
          }
        } catch {
          /* Reverse geocoding is a nice-to-have; ignore failures. */
        }
      },
      () => {
        setLocationStatus("Couldn't access your location. Check browser permissions.", "error");
      }
    );
  });
}

function setLocationStatus(message, kind) {
  const el = document.getElementById("location-status");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("is-ready", kind === "ready");
  el.classList.toggle("is-error", kind === "error");
}

function fillRequirementForm(req) {
  document.getElementById("location").value = req.location;
  if (req.locationLat != null) {
    setLocationStatus("\u2713 Using a saved exact location", "ready");
  } else {
    setLocationStatus("Click \u201cFind on map\u201d or \u201cUse my location\u201d for exact distances.", "");
  }
  document.getElementById("budget").value = req.budget;
  document.getElementById("maxDistance").value = req.maxDistance;
  document.getElementById("maxTravelTime").value = req.maxTravelTime;
  document.getElementById("maxDeposit").value = req.maxDeposit;
  document.getElementById("sharing").value = req.sharing;
  document.getElementById("furnished").value = req.furnished;
  document.getElementById("foodPolicy").value = req.foodPolicy;
  ALL_FACILITIES.forEach((f) => {
    const cb = document.querySelector(`input[name="facilities"][value="${f}"]`);
    if (cb) cb.checked = req.facilities.includes(f);
  });
}

function renderBlankSummary() {
  document.getElementById("req-summary").innerHTML =
    `<span>Fill in your requirements below to see matches</span>`;
}

function renderEmptyPrompt() {
  document.getElementById("ai-picks").innerHTML = "";
  document.getElementById("property-list").innerHTML = `
    <div class="empty-state">
      <p>Enter your budget, distance, and preferences above, then save requirements to see your ranked matches.</p>
    </div>`;
}

function readRequirementForm() {
  const facilities = Array.from(
    document.querySelectorAll('input[name="facilities"]:checked')
  ).map((cb) => cb.value);
  return {
    location: document.getElementById("location").value.trim(),
    locationLat: currentCoords.lat,
    locationLng: currentCoords.lng,
    budget: Number(document.getElementById("budget").value) || 0,
    maxDistance: Number(document.getElementById("maxDistance").value) || 0,
    maxTravelTime: Number(document.getElementById("maxTravelTime").value) || 0,
    maxDeposit: Number(document.getElementById("maxDeposit").value) || 0,
    sharing: Number(document.getElementById("sharing").value) || 1,
    furnished: document.getElementById("furnished").value,
    foodPolicy: document.getElementById("foodPolicy").value,
    facilities
  };
}

function renderSummary(req) {
  const el = document.getElementById("req-summary");
  el.innerHTML = `
    <span>Near ${req.location}</span>
    <span>Budget \u20b9${req.budget.toLocaleString("en-IN")}/mo</span>
    <span>Max ${req.maxDistance} km</span>
    <span>Max ${req.maxTravelTime} min</span>
    <span>${req.sharing} sharing</span>
    <span>${req.furnished}</span>
    <span>Deposit \u2264 \u20b9${req.maxDeposit.toLocaleString("en-IN")}</span>
  `;
  const heading = document.getElementById("area-heading");
  if (heading) heading.textContent = `Matches near ${req.location}`;
}

function renderAll(req) {
  const ranked = PROPERTIES.map((p) => ({ property: p, ...computeMatch(p, req) })).sort(
    (a, b) => b.score - a.score
  );
  renderPicks(ranked, req);
  renderPropertyList(ranked, req);
}

function renderPicks(ranked, req) {
  const picksEl = document.getElementById("ai-picks");
  if (!picksEl) return;

  const bestMatch = ranked[0];
  const bestBudget = [...ranked].sort((a, b) => a.property.rent - b.property.rent)[0];
  const closest = [...ranked].sort((a, b) => a.property.distanceKm - b.property.distanceKm)[0];
  const bestFacilities = [...ranked].sort(
    (a, b) => b.property.facilities.length - a.property.facilities.length
  )[0];
  const lowestDeposit = [...ranked].sort((a, b) => a.property.deposit - b.property.deposit)[0];

  const picks = [
    ["Best match for you", bestMatch],
    ["Best budget option", bestBudget],
    ["Closest option", closest],
    ["Best facilities", bestFacilities],
    ["Lowest deposit", lowestDeposit]
  ];

  picksEl.innerHTML = picks
    .map(
      ([label, r]) => `
      <a class="pick-chip" href="#${r.property.id}">
        <span class="pick-label">${label}</span>
        <span class="pick-name">${r.property.name} \u00b7 ${r.score}%</span>
      </a>`
    )
    .join("");
}

function renderPropertyList(ranked, req) {
  const listEl = document.getElementById("property-list");

  listEl.innerHTML = ranked
    .map(({ property: p, score, breakdown, distanceKm, travelTimeMin, exact }) => {
      return `
      <article class="card" id="${p.id}">
        <div class="card-top">
          <div>
            <h3>${p.name}</h3>
            <p class="muted">\ud83d\udccd ${distanceKm} km \u00b7 ${travelTimeMin} min to ${req.location}${exact ? " (from your location)" : " \u2014 approximate"} \u00b7 Owner: ${p.owner}</p>
            <p class="muted">\ud83d\udcde ${p.contact}</p>
          </div>
          <div class="score score-${scoreTier(score)}">
            <span class="score-num">${score}%</span>
            <span class="score-label">AI Match</span>
          </div>
        </div>

        <div class="card-facts">
          <span>\u20b9${p.rent.toLocaleString("en-IN")}/mo</span>
          <span>\ud83d\udecf ${p.sharing} sharing</span>
          <span>\ud83e\ude91 ${p.furnished}</span>
          <span>Deposit \u20b9${p.deposit.toLocaleString("en-IN")}</span>
        </div>

        <details class="why">
          <summary>Why this score</summary>
          <ul>
            ${breakdown
              .map(
                (b) =>
                  `<li class="reason reason-${b.status}"><span>${statusIcon(b.status)}</span> ${b.label} \u2014 ${b.text}</li>`
              )
              .join("")}
          </ul>
        </details>

        ${p.note ? `<p class="info-check">\u26a0 ${p.note}</p>` : ""}
      </article>`;
    })
    .join("");
}

function scoreTier(score) {
  if (score >= 90) return "great";
  if (score >= 70) return "good";
  return "fair";
}

/* ============================================================
   COMPARE PAGE
============================================================ */
const COMPARE_TOP_N = 3;

function initComparePage() {
  const container = document.getElementById("compare-table");
  if (!container) return;

  render();

  function render() {
    if (!hasSavedRequirements()) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Fill in your requirements on the Home page first — the top matches will be compared here automatically.</p>
          <a class="btn" href="index.html">Set requirements</a>
        </div>`;
      return;
    }

    const req = getRequirements();
    const ranked = PROPERTIES.map((p) => ({ property: p, ...computeMatch(p, req) })).sort(
      (a, b) => b.score - a.score
    );
    const top = ranked.slice(0, COMPARE_TOP_N);
    const properties = top.map((r) => r.property);

    const rows = [
      { label: "AI Match", value: (p) => `${computeMatch(p, req).score}%` },
      { label: "Rent", value: (p) => `\u20b9${p.rent.toLocaleString("en-IN")}/mo` },
      { label: "Deposit", value: (p) => `\u20b9${p.deposit.toLocaleString("en-IN")}` },
      { label: "Est. monthly cost", value: (p) => `\u20b9${estMonthlyCost(p).toLocaleString("en-IN")}` },
      { label: "Distance", value: (p) => `${getDistanceAndTime(p, req).distanceKm} km` },
      { label: "Travel time", value: (p) => `${getDistanceAndTime(p, req).travelTimeMin} min` },
      { label: "Sharing", value: (p) => `${p.sharing} sharing` },
      { label: "Furnishing", value: (p) => p.furnished },
      { label: "Facilities", value: (p) => p.facilities.join(", ") || "\u2014" },
      { label: "Food policy", value: (p) => p.foodPolicy },
      { label: "Available from", value: (p) => formatDate(p.availableFrom) },
      { label: "Owner", value: (p) => p.owner },
      { label: "Contact", value: (p) => p.contact },
      { label: "Info check", value: (p) => p.note || "No gaps flagged" }
    ];

    container.innerHTML = `
      <p class="muted compare-note">Showing your top ${properties.length} matches, ranked by AI Match %.${
        req.locationLat != null
          ? " Distance and travel time are calculated from your set location."
          : " Distance and travel time are approximate — set an exact location on Home for real figures."
      }</p>
      <table class="compare-grid">
        <thead>
          <tr>
            <th></th>
            ${properties.map((p) => `<th>${p.name}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
            <tr>
              <th scope="row">${row.label}</th>
              ${properties.map((p) => `<td>${row.value(p)}</td>`).join("")}
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ============================================================
   SHORTLIST PAGE
============================================================ */
const SHORTLIST_SCORE_THRESHOLD = 80;
const SHORTLIST_MAX = 5;
const SHORTLIST_FALLBACK_N = 3;

function initShortlistPage() {
  const container = document.getElementById("shortlist-list");
  if (!container) return;

  render();

  function render() {
    if (!hasSavedRequirements()) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Fill in your requirements on the Home page first — your best matches will be shortlisted here automatically.</p>
          <a class="btn" href="index.html">Set requirements</a>
        </div>`;
      return;
    }

    const req = getRequirements();
    const ranked = PROPERTIES.map((p) => ({ property: p, ...computeMatch(p, req) })).sort(
      (a, b) => b.score - a.score
    );

    let picked = ranked.filter((r) => r.score >= SHORTLIST_SCORE_THRESHOLD).slice(0, SHORTLIST_MAX);
    let note = `Properties scoring ${SHORTLIST_SCORE_THRESHOLD}% or higher, ranked by AI Match %.`;
    if (!picked.length) {
      picked = ranked.slice(0, SHORTLIST_FALLBACK_N);
      note = `Nothing hit ${SHORTLIST_SCORE_THRESHOLD}% yet, so here are your closest matches.`;
    }

    container.innerHTML =
      `<p class="muted compare-note">${note}</p>` +
      picked
        .map(({ property: p, score, distanceKm, travelTimeMin }) => `
        <article class="card">
          <div class="card-top">
            <div>
              <h3>${p.name}</h3>
              <p class="muted">\ud83d\udccd ${p.area} \u00b7 ${distanceKm} km \u00b7 ${travelTimeMin} min to ${req.location}</p>
              <p class="muted">\ud83d\udcde ${p.owner} \u00b7 ${p.contact}</p>
            </div>
            <div class="score score-${scoreTier(score)}">
              <span class="score-num">${score}%</span>
              <span class="score-label">AI Match</span>
            </div>
          </div>
          <div class="card-facts">
            <span>\u20b9${p.rent.toLocaleString("en-IN")}/mo</span>
            <span>\ud83d\udecf ${p.sharing} sharing</span>
            <span>\ud83e\ude91 ${p.furnished}</span>
            <span>Deposit \u20b9${p.deposit.toLocaleString("en-IN")}</span>
          </div>
        </article>`)
        .join("");
  }
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  highlightNav();
  initIndexPage();
  initComparePage();
  initShortlistPage();
});