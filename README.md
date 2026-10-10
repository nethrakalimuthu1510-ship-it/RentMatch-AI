RentMatch AI

RentMatch AI helps students and professionals find rental homes. It ranks properties by budget, distance, travel time, deposit, facilities, furnishing and sharing, and explains every match score.

Project structure
RentMatch-AI-main/
├── index.html, compare.html, shortlist.html   Frontend pages
├── style.css, script.js                       Frontend styling and logic
└── backend/
    ├── server.js          Express API (routes, validation, error handling)
    ├── db.js              SQLite connection and table schema
    ├── seed.js            Loads the 8 sample properties into the database
    ├── matching.js        Scoring engine (pure functions, unit tested)
    └── matching.test.js   Unit tests
Running the backend
cd backend
npm install
node seed.js        # creates and fills rentmatch.db
node server.js      # starts the API on http://localhost:3001
API endpoints

Base URL: http://localhost:3001

Method	Path	Description
GET	/api/health	Checks that the server is running
GET	/api/properties	Returns all properties
GET	/api/properties/:id	Returns one property by id
POST	/api/match	Scores and ranks all properties for the given requirements
GET /api/health

Response 200:

json
{ "status": "ok" }
GET /api/properties

Response 200: an array of property objects.

json
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
GET /api/properties/:id

Response 200: one property object (same shape as above). Response 404 if the id does not exist:

json
{ "error": "Property not found" }
POST /api/match

Request body (JSON):

Field	Type	Required	Meaning
budget	number	yes	Maximum monthly rent in ₹
maxDistance	number	yes	Maximum distance in km
maxTravelTime	number	yes	Maximum travel time in minutes
maxDeposit	number	yes	Maximum deposit in ₹
sharing	number	yes	Preferred number of people sharing
furnished	string	no	"Furnished", "Semi-furnished" or "Unfurnished"
facilities	string[]	no	Required facilities

Example request:

json
{
  "budget": 8000, "maxDistance": 3, "maxTravelTime": 25,
  "maxDeposit": 25000, "sharing": 2, "furnished": "Furnished",
  "facilities": ["Wi-Fi", "Washing machine", "Attached bathroom"]
}

Response 200: an array sorted by score, best match first. Each item has the property, a score from 0 to 100, and a breakdown explaining each criterion.

json
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

Response 400 if a required field is missing or is not a positive number:

json
{ "error": "Missing or invalid fields", "fields": ["budget"] }
Database schema

SQLite database backend/rentmatch.db, one table:

properties

Column	Type	Notes
id	TEXT	Primary key, e.g. "sunny-veda"
name	TEXT	Required
area	TEXT	Required
landmark	TEXT	Reference point for distance
lat, lng	REAL	Required coordinates
distance_km	REAL	Stored distance to the landmark
travel_time_min	INTEGER	Stored travel time
rent	INTEGER	Required, ₹ per month
deposit	INTEGER	Required, ₹
sharing	INTEGER	Required, people per room
furnished	TEXT	Required
facilities	TEXT	Comma-separated, e.g. "Wi-Fi,Washing machine"
food_policy	TEXT	"Any" or "Veg only"
owner, contact	TEXT	Owner details
available_from	TEXT	Date as YYYY-MM-DD
note	TEXT	Warnings such as missing listing information
Matching score

Each property is scored out of 100: Budget 25, Distance 20, Travel time 15, Deposit 15, Facilities 15, Furnishing 5, Sharing 5. Budget, distance, travel time and deposit give partial marks when a property is slightly over the limit, and 0 when far over.

Testing

Unit tests for the matching engine use Node's built-in test runner:

cd backend
node --test

The 9 tests cover a perfect match, partial and failed budget scores, partial facility matches, exact-coordinate distance, a score that never goes below 0, the Haversine distance formula, and the minimum travel time.

Error handling
Input validation: POST /api/match returns 400 with the list of invalid fields instead of crashing.
Not found: an unknown property id or an unknown route returns a JSON 404.
Error boundary: every route passes unexpected errors to one central error handler in server.js. It logs the real error on the server and returns a generic 500 response, so internal details are never exposed to the client.