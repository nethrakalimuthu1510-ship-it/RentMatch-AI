# RentMatch AI – Smart Rental Matching for Students & Professionals

RentMatch AI is a smart rental property discovery and matching application designed to help students and working professionals find suitable rental homes.

It integrates live rental listings from 99acres through Scrappa and evaluates properties based on users' budgets, preferred locations, travel time, facilities, furnishing and sharing requirements.

## Key Features

- Live rental property search using 99acres through Scrappa.
- Location-based rental discovery.
- Personalized rental matching with scores out of 100.
- Budget and deposit comparison.
- Distance and estimated travel-time calculations.
- Facility and furnishing verification.
- Side-by-side comparison of up to three properties.
- Property shortlist and saved listings.
- Match confidence and eligibility indicators.
- Missing-information alerts.
- REST API backend with SQLite database.
- Automated unit testing.

## Technologies Used

**Frontend**
- HTML5
- CSS3
- JavaScript

**Backend**
- Node.js
- Express.js
- SQLite
- REST API

**External Integration**
- Scrappa API
- 99acres rental listings
- OpenStreetMap Nominatim for location lookup

## Project Structure

```text
RentMatch-AI-main/
├── index.html
├── search.html
├── compare.html
├── shortlist.html
├── style.css
├── script.js
├── search-page.js
└── backend/
    ├── server.js
    ├── db.js
    ├── seed.js
    ├── matching.js
    ├── matching.test.js
    ├── search.js
    ├── search.test.js
    └── package.json
```

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/nethrakalimuthu1510-ship-it/RentMatch-AI.git
cd RentMatch-AI
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create a `.env` file inside the backend folder.

```env
SCRAPPA_API_KEY=your_scrappa_api_key
```

Never upload your actual API key to GitHub.

### 4. Initialize the database

```bash
node seed.js
```

### 5. Start the backend

```bash
node server.js
```

The backend runs locally at:

```text
http://localhost:3001
```

Open `index.html` using a local development server to access the frontend.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Checks backend status |
| GET | `/api/properties` | Retrieves stored properties |
| GET | `/api/properties/:id` | Retrieves a property |
| GET | `/api/search` | Filters stored properties |
| POST | `/api/match` | Calculates personalized match scores |
| GET | `/api/external/search` | External rental search |
| GET | `/api/99acres/search` | Retrieves 99acres rental listings through Scrappa |

### Live 99acres Search

Example:

```text
GET /api/99acres/search?page=1
```

The endpoint retrieves rental listing information through Scrappa and returns property details, source information and pagination metadata.

## Matching System

Properties are evaluated using a weighted scoring system with a maximum score of 100.

| Matching criterion | Weight |
|---|---:|
| Budget | 25 |
| Distance | 20 |
| Travel time | 15 |
| Deposit | 15 |
| Facilities | 15 |
| Furnishing | 5 |
| Sharing | 5 |
| **Total** | **100** |

The application also displays match confidence, eligibility, missing information and individual criterion breakdowns.

## Property Comparison

Users can compare up to three properties side by side.

Comparison details include:
- Monthly rent
- Deposit
- Bedrooms and bathrooms
- Furnishing
- Sharing
- Distance
- Estimated travel time
- Match score
- Confidence
- Eligibility and recommendation

## Shortlist

Users can save rental properties for future reference, remove saved properties and access original listings.

Saved shortlist information is maintained using browser storage.

## Location and Distance

The application supports location lookup and location-based matching.

It uses geographic coordinates and the Haversine formula to calculate straight-line distances when suitable coordinates are available.

Estimated travel time is displayed separately from straight-line distance.

## Database

The backend uses SQLite for structured property storage.

The database contains property information such as:
- Property name
- Area and location
- Coordinates
- Monthly rent
- Deposit
- Bedrooms and bathrooms
- Sharing
- Furnishing
- Facilities
- Availability information

## Testing

The project uses Node.js's built-in test runner.

Run:

```bash
cd backend
npm test
```

Latest verified test result:

```text
Tests: 19
Pass: 19
Fail: 0
```

The automated tests cover matching calculations, budget evaluation, facilities, distance calculations, travel-time estimation, property filtering, sorting and search validation.

## Error Handling

The backend includes:
- Request validation.
- Invalid input responses.
- Property not-found responses.
- Centralized error handling.
- External API error handling.
- API response caching.

## Project Objective

The objective of RentMatch AI is to simplify rental property discovery by combining rental listing information with personalized matching, location evaluation and transparent recommendations.

The application helps students and professionals make more informed rental decisions.