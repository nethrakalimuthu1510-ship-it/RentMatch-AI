# RentMatch AI

RentMatch AI helps students and professionals find rental homes. It ranks properties by budget, distance, travel time, deposit, facilities, furnishing and sharing, and explains every match score.

## Project structure

```
RentMatch-AI-main/
├── index.html, search.html, compare.html, shortlist.html   Frontend pages
├── style.css, script.js, search-page.js       Frontend styling and logic
└── backend/
    ├── server.js          Express API (routes, validation, error handling)
    ├── db.js              SQLite connection and table schema
    ├── seed.js            Loads the 8 sample properties into the database
    ├── matching.js        Scoring engine (pure functions, unit tested)
    ├── matching.test.js   Unit tests for the scoring engine
    ├── search.js          Search filters and sorting (pure functions, unit tested)
    └── search.test.js     Unit tests for the search filters
```

## Running the backend

```
cd backend
npm install
node seed.js        # creates and fills rentmatch.db
node server.js      # starts the API on http://localhost:3001
```

## API endpoints

Base URL: `http://localhost:3001`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Checks that the server is running |
| GET | `/api/properties` | Returns all properties |
| GET | `/api/properties/:id` | Returns one property by id |
| GET | `/api/search` | Filters properties using query parameters |
| POST | `/api/match` | Scores and ranks all properties for the given requirements |

### GET /api/health

Response `200`:
```json
{ "status": "ok" }
```

### GET /api/properties

Response `200`: an array of property objects.
```json
[
  {
    "id": "sunny-veda",
    "name": "Sunny Veda Residency",
    "area": "MG Road",
    "distanceKm": 2.1,
    "travelTimeMin": 15,
    "rent": 8000,
    "deposit": 20000,
    "sharing": 2,
    "furnished": "Furnished",
    "facilities": ["Wi-Fi", "Washing machine", "Attached bathroom"],
    "foodPolicy": "Any"
  }
]
```

### GET /api/properties/:id

Response `200`: one property object (same shape as above).
Response `404` if the id does not exist:
```json
{ "error": "Property not found" }
```

### GET /api/search

Filters the properties using query parameters. Every parameter is optional, and all the filters you give must match.

| Parameter | Meaning |
|-----------|---------|
| maxRent | Maximum monthly rent in ₹ |
| maxDeposit | Maximum deposit in ₹ |
| sharing | Exact number of people sharing (1, 2 or 3) |
| area | Text found in the area or the property name (not case sensitive) |
| furnished | "Furnished", "Semi-furnished" or "Unfurnished" |
| foodPolicy | "Any" or "Veg only" |
| facilities | Comma-separated list; the property must have all of them |
| sort | `rent_asc`, `rent_desc`, `deposit_asc` or `distance_asc` |

Example request:
```
GET /api/search?maxRent=8000&facilities=Wi-Fi&sort=rent_asc
```

Response `200`: an array of property objects (same shape as `GET /api/properties`), possibly empty.

Response `400` if a number is invalid or the sort order is unknown:
```json
{ "error": "Invalid search filters", "fields": ["maxRent"] }
```

### POST /api/match

Request body (JSON):

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| budget | number | yes | Maximum monthly rent in ₹ |
| maxDistance | number | yes | Maximum distance in km |
| maxTravelTime | number | yes | Maximum travel time in minutes |
| maxDeposit | number | yes | Maximum deposit in ₹ |
| sharing | number | yes | Preferred number of people sharing |
| furnished | string | no | "Furnished", "Semi-furnished" or "Unfurnished" |
| facilities | string[] | no | Required facilities |

Example request:
```json
{
  "budget": 8000, "maxDistance": 3, "maxTravelTime": 25,
  "maxDeposit": 25000, "sharing": 2, "furnished": "Furnished",
  "facilities": ["Wi-Fi", "Washing machine", "Attached bathroom"]
}
```

Response `200`: an array sorted by score, best match first. Each item has the property, a score from 0 to 100, and a breakdown explaining each criterion.
```json
[
  {
    "property": { "id": "sunny-veda", "name": "Sunny Veda Residency" },
    "score": 100,
    "breakdown": [
      { "label": "Budget", "status": "pass", "text": "₹8000 vs your ₹8000 budget" }
    ],
    "distanceKm": 2.1,
    "travelTimeMin": 15
  }
]
```

Response `400` if a required field is missing or is not a positive number:
```json
{ "error": "Missing or invalid fields", "fields": ["budget"] }
```

## Database schema

SQLite database `backend/rentmatch.db`, one table:

**properties**

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | Primary key, e.g. "sunny-veda" |
| name | TEXT | Required |
| area | TEXT | Required |
| landmark | TEXT | Reference point for distance |
| lat, lng | REAL | Required coordinates |
| distance_km | REAL | Stored distance to the landmark |
| travel_time_min | INTEGER | Stored travel time |
| rent | INTEGER | Required, ₹ per month |
| deposit | INTEGER | Required, ₹ |
| sharing | INTEGER | Required, people per room |
| furnished | TEXT | Required |
| facilities | TEXT | Comma-separated, e.g. "Wi-Fi,Washing machine" |
| food_policy | TEXT | "Any" or "Veg only" |
| owner, contact | TEXT | Owner details |
| available_from | TEXT | Date as YYYY-MM-DD |
| note | TEXT | Warnings such as missing listing information |

## Search page

`search.html` and `search-page.js` let users filter the listings directly. The page builds a query from the form and calls `GET /api/search`. It shows a clear message when the filters are invalid or when the server is not running.

## Matching score

Each property is scored out of 100: Budget 25, Distance 20, Travel time 15, Deposit 15, Facilities 15, Furnishing 5, Sharing 5. Budget, distance, travel time and deposit give partial marks when a property is slightly over the limit, and 0 when far over.

## Testing

Unit tests use Node's built-in test runner:

```
cd backend
node --test
```

There are 19 tests. The 10 tests in `matching.test.js` cover a perfect match, partial and failed budget scores, partial facility matches, exact-coordinate distance, the exact-distance flag, a score that never goes below 0, the Haversine distance formula, and the minimum travel time. The 9 tests in `search.test.js` cover each filter, combined filters, sorting without changing the input, and parsing and validating the query values.

## Error handling

- **Input validation:** `POST /api/match` and `GET /api/search` return `400` with the list of invalid fields instead of crashing.
- **Not found:** an unknown property id or an unknown route returns a JSON `404`.
- **Error boundary:** every route passes unexpected errors to one central error handler in `server.js`. It logs the real error on the server and returns a generic `500` response, so internal details are never exposed to the client.
