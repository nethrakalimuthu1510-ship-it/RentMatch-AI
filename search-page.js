/* ============================================================
   search-page.js - Search page.
   Sends the filter values to the backend (GET /api/search) and
   renders the properties that come back. Runs only on search.html.
============================================================ */

// Address of the backend API (start it with: node server.js in the backend folder)
const SEARCH_API = "http://localhost:3001";

// Escapes text before it is placed into HTML, so listing data can never inject markup.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

// Formats a number as rupees, e.g. 8000 -> ₹8,000
function rupees(amount) {
  return `\u20b9${Number(amount).toLocaleString("en-IN")}`;
}

// Reads the form and builds the query string for /api/search.
// Empty fields are left out so they do not filter anything.
function buildSearchQuery() {
  const params = new URLSearchParams();
  ["area", "maxRent", "maxDeposit", "sharing", "furnished", "foodPolicy", "sort"].forEach((id) => {
    const value = document.getElementById(id).value.trim();
    if (value) params.set(id, value);
  });
  const facilities = Array.from(document.querySelectorAll('input[name="facilities"]:checked'))
    .map((box) => box.value);
  if (facilities.length) params.set("facilities", facilities.join(","));
  return params.toString();
}

// Shows a message under the form. Pass kind "error" for red text.
function setSearchStatus(message, kind) {
  const el = document.getElementById("search-status");
  el.textContent = message;
  el.className = "location-status" + (kind === "error" ? " is-error" : "");
}

// Calls the API with the current filters and renders the results.
// Handles three failure cases: invalid filters (400), other server errors,
// and the server not running at all.
async function runSearch() {
  const results = document.getElementById("search-results");
  setSearchStatus("Searching...", "");
  try {
    const response = await fetch(`${SEARCH_API}/api/search?${buildSearchQuery()}`);
    if (response.status === 400) {
      const body = await response.json();
      setSearchStatus(`Please check these filters: ${body.fields.join(", ")}`, "error");
      results.innerHTML = "";
      return;
    }
    if (!response.ok) throw new Error(`API responded with ${response.status}`);
    const properties = await response.json();
    setSearchStatus("", "");
    renderSearchResults(properties);
  } catch (err) {
    console.warn("Search failed:", err.message);
    setSearchStatus("Could not reach the server. Start it with: node server.js (in the backend folder).", "error");
    results.innerHTML = "";
  }
}

// Draws one card per property, or an empty-state message when nothing matches.
function renderSearchResults(properties) {
  const results = document.getElementById("search-results");
  document.getElementById("result-count").textContent =
    `${properties.length} ${properties.length === 1 ? "property" : "properties"} found.`;

  if (!properties.length) {
    results.innerHTML = `
      <div class="empty-state">
        <p>No properties match these filters. Try raising the rent limit or clearing some filters.</p>
      </div>`;
    return;
  }

  results.innerHTML = properties.map((p) => `
    <article class="card">
      <div class="card-top">
        <div>
          <h3>${escapeHtml(p.name)}</h3>
          <p class="muted">\ud83d\udccd ${escapeHtml(p.area)} \u00b7 Owner: ${escapeHtml(p.owner)}</p>
          <p class="muted">\ud83d\udcde ${escapeHtml(p.contact)} \u00b7 Available from ${escapeHtml(p.availableFrom)}</p>
        </div>
      </div>
      <div class="card-facts">
        <span>${rupees(p.rent)}/mo</span>
        <span>${p.sharing} sharing</span>
        <span>${escapeHtml(p.furnished)}</span>
        <span>Deposit ${rupees(p.deposit)}</span>
        <span>${escapeHtml(p.foodPolicy)} food</span>
      </div>
      <p class="muted">Facilities: ${p.facilities.length ? p.facilities.map(escapeHtml).join(", ") : "None listed"}</p>
      ${p.note ? `<p class="info-check">\u26a0 ${escapeHtml(p.note)}</p>` : ""}
    </article>`).join("");
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("search-form");
  if (!form) return; // not the search page

  form.addEventListener("submit", (event) => {
    event.preventDefault(); // stay on the page, search through the API instead
    runSearch();
  });
  // After "Clear filters" resets the inputs, show the full list again
  form.addEventListener("reset", () => setTimeout(runSearch, 0));

  runSearch(); // show every property on first load
});
