/* ============================================================
   RENTMATCH AI
   TAMIL NADU LIVE RENTAL MATCHING
   99ACRES THROUGH SCRAPPA BACKEND

   Intelligent matching with verified information.
   ============================================================ */

const API_URL = "http://localhost:3001";

const STORAGE_KEYS = {
    requirements: "rentmatch_requirements",
    liveResults: "rentmatch_live_results",
    shortlist: "rentmatch_shortlist",
    compare: "rentmatch_compare"
};

const ALL_FACILITIES = [
    "Wi-Fi",
    "Washing machine",
    "Attached bathroom"
];

const WEIGHTS = {
    budget: 25,
    distance: 20,
    travelTime: 15,
    deposit: 15,
    facilities: 15,
    furnishing: 5,
    sharing: 5
};

const DEFAULT_REQUIREMENTS = {
    country: "India",
    state: "Tamil Nadu",
    district: "",
    location: "",
    locationLat: null,
    locationLng: null,
    budget: 8000,
    maxDistance: 5,
    maxTravelTime: 25,
    maxDeposit: 25000,
    sharing: 2,
    furnished: "Furnished",
    facilities: [],
    food: "Any"
};

let currentCoords = {
    lat: null,
    lng: null
};


/* ============================================================
   1. NUMBER HELPERS
   ============================================================ */

function numberOrNull(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const cleaned = String(value)
        .replace(/[₹,\s]/g, "")
        .trim();

    if (!cleaned) return null;

    const number = Number(cleaned);

    return Number.isFinite(number)
        ? number
        : null;
}

function positiveNumberOrNull(value) {
    const number = numberOrNull(value);

    return number !== null && number > 0
        ? number
        : null;
}

function nonNegativeNumberOrNull(value) {
    const number = numberOrNull(value);

    return number !== null && number >= 0
        ? number
        : null;
}

function validCoordinates(lat, lng) {
    const latitude = numberOrNull(lat);
    const longitude = numberOrNull(lng);

    if (latitude === null || longitude === null) {
        return false;
    }

    return (
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180 &&
        !(latitude === 0 && longitude === 0)
    );
}


/* ============================================================
   2. DISTANCE AND TRAVEL TIME
   ============================================================ */

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
    if (
        !validCoordinates(lat1, lng1) ||
        !validCoordinates(lat2, lng2)
    ) {
        return null;
    }

    const radians = degrees => degrees * Math.PI / 180;

    const earthRadius = 6371;

    const dLat = radians(Number(lat2) - Number(lat1));
    const dLng = radians(Number(lng2) - Number(lng1));

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(radians(Number(lat1))) *
        Math.cos(radians(Number(lat2))) *
        Math.sin(dLng / 2) ** 2;

    return earthRadius * 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );
}

// Estimated time only; not actual road distance or live traffic.
function estimateTravelTimeMin(distanceKm) {
    const distance = numberOrNull(distanceKm);

    if (distance === null || distance < 0) {
        return null;
    }

    return Math.max(
        5,
        Math.round((distance / 18) * 60 + 4)
    );
}

function getDistanceAndTime(property, req) {
    const propertyLat =
        property.latitude ?? property.lat;

    const propertyLng =
        property.longitude ?? property.lng;

    if (
        validCoordinates(req.locationLat, req.locationLng) &&
        validCoordinates(propertyLat, propertyLng)
    ) {
        const distance = haversineDistanceKm(
            req.locationLat,
            req.locationLng,
            propertyLat,
            propertyLng
        );

        if (distance !== null) {
            return {
                distanceKm: Math.round(distance * 10) / 10,
                travelTimeMin: estimateTravelTimeMin(distance),
                distanceMethod: "straight-line",
                travelTimeMethod: "estimated"
            };
        }
    }

    const distanceKm =
        nonNegativeNumberOrNull(property.distanceKm);

    const travelTimeMin =
        positiveNumberOrNull(property.travelTimeMin);

    return {
        distanceKm,
        travelTimeMin,

        distanceMethod:
            distanceKm !== null
                ? "stored-estimate"
                : null,

        travelTimeMethod:
            travelTimeMin !== null
                ? "stored-estimate"
                : null
    };
}


/* ============================================================
   3. LOCAL STORAGE
   ============================================================ */

function readStorage(key, fallback) {
    try {
        const value = localStorage.getItem(key);

        if (!value) return fallback;

        return JSON.parse(value);

    } catch (error) {
        console.error("Storage error:", error);
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

    } catch (error) {
        console.error("Unable to save data:", error);
    }
}

function getSavedRequirements() {
    const saved = readStorage(
        STORAGE_KEYS.requirements,
        null
    );

    return saved && typeof saved === "object"
        ? {
            ...DEFAULT_REQUIREMENTS,
            ...saved
        }
        : { ...DEFAULT_REQUIREMENTS };
}

function saveRequirements(req) {
    writeStorage(STORAGE_KEYS.requirements, req);
}

/*
   Properties saved by an older version of this app have no
   matchScore / confidence / criteria. Showing them directly
   prints "undefined%". Every list read from storage is passed
   through this check, and any property without a valid score
   is scored again with the current engine.
*/

function hasValidScore(property) {
    return Boolean(
        property &&
        typeof property === "object" &&
        Number.isFinite(property.matchScore) &&
        Number.isFinite(property.confidence) &&
        Array.isArray(property.criteria)
    );
}

function ensureScoredList(items) {
    if (!Array.isArray(items)) return [];

    const objects = items.filter(item =>
        item && typeof item === "object"
    );

    if (objects.every(hasValidScore)) {
        return objects;
    }

    const req = getSavedRequirements();

  return objects.map(item =>
    computeLiveMatch(item, req)
);
}

function getSavedLiveResults() {
    const results = readStorage(
        STORAGE_KEYS.liveResults,
        []
    );

    return ensureScoredList(results);
}

function saveLiveResults(properties) {
    writeStorage(STORAGE_KEYS.liveResults, properties);
}

function getShortlist() {
    const items = readStorage(
        STORAGE_KEYS.shortlist,
        []
    );

    return ensureScoredList(items);
}

function saveShortlist(items) {
    writeStorage(STORAGE_KEYS.shortlist, items);
}

function getCompareList() {
    const items = readStorage(
        STORAGE_KEYS.compare,
        []
    );

    return ensureScoredList(items);
}

function saveCompareList(items) {
    writeStorage(STORAGE_KEYS.compare, items);
}


/* ============================================================
   4. DISPLAY HELPERS
   ============================================================ */

function escapeHTML(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]
    );
}

function money(value) {
    const number = nonNegativeNumberOrNull(value);

    if (number === null) {
        return "Not specified";
    }

    return number.toLocaleString("en-IN");
}

function formatINR(value) {
    const number = nonNegativeNumberOrNull(value);

    if (number === null) {
        return "Not specified";
    }

    return "₹" + number.toLocaleString("en-IN");
}

// Never prints "undefined%" or "NaN%".
function formatPercent(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "N/A";
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? Math.round(number) + "%"
        : "N/A";
}

function getElement(...ids) {
    for (const id of ids) {
        const element = document.getElementById(id);

        if (element) return element;
    }

    return null;
}

function setText(ids, value) {
    const element = getElement(...ids);

    if (element) {
        element.textContent = value;
    }
}

function setLocationStatus(message, type = "info") {
    const element = getElement("location-status");

    if (!element) {
        console.log(message);
        return;
    }

    element.textContent = message;
    element.dataset.status = type;

    element.classList.toggle(
        "is-ready",
        type === "success" || type === "ready"
    );

    element.classList.toggle(
        "is-error",
        type === "error"
    );
}


/* ============================================================
   5. LOCATION QUERY
   ============================================================ */

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[_-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getLocationQuery() {
    const country =
        getElement("country")?.value || "India";

    const state =
        getElement("state")?.value || "Tamil Nadu";

    const district =
        getElement("district")?.value || "";

    const locality =
        getElement("location")?.value.trim() || "";

    if (
        normalizeText(country) !== "india" ||
        normalizeText(state) !== "tamil nadu"
    ) {
        throw new Error(
            "Please select India and Tamil Nadu."
        );
    }

    if (!district) {
        throw new Error("Please select your district.");
    }

    if (!locality) {
        throw new Error(
            "Please enter your area or locality."
        );
    }

    return `${locality}, ${district}, Tamil Nadu, India`;
}


/* ============================================================
   6. LOCATION VALIDATION
   ============================================================ */

function validateTamilNaduResult(address) {
    if (!address) return false;

    const country = normalizeText(address.country);
    const state = normalizeText(address.state);

    return (
        country === "india" &&
        (
            state === "tamil nadu" ||
            state === "tamilnadu"
        )
    );
}

function addressMatchesDistrict(address, district) {
    const requested = normalizeText(district);

    const actual = normalizeText(
        address.state_district ||
        address.county ||
        address.city_district ||
        address.city ||
        ""
    );

    if (!requested || !actual) return false;

    return (
        actual === requested ||
        actual.includes(requested) ||
        requested.includes(actual)
    );
}


/* ============================================================
   7. GEOCODING
   ============================================================ */

async function geocodeTamilNaduLocation(query) {
    const url = new URL(
        "https://nominatim.openstreetmap.org/search"
    );

    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", query);
    url.searchParams.set("countrycodes", "in");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "10");

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            "Location service is unavailable. Please try again."
        );
    }

    const results = await response.json();

    if (!Array.isArray(results) || results.length === 0) {
        throw new Error(
            "Location not found. Check your locality and district."
        );
    }

    const district =
        getElement("district")?.value || "";

    const validResults = results.filter(result =>
        validateTamilNaduResult(result.address) &&
        addressMatchesDistrict(result.address, district)
    );

    if (validResults.length === 0) {
        throw new Error(
            "The entered locality could not be confirmed in the selected district."
        );
    }

    const requestedLocality = normalizeText(
        getElement("location")?.value || ""
    );

    const bestResult =
        validResults.find(result =>
            normalizeText(result.display_name)
                .includes(requestedLocality)
        ) || validResults[0];

    const lat = Number(bestResult.lat);
    const lng = Number(bestResult.lon);

    if (!validCoordinates(lat, lng)) {
        throw new Error(
            "Valid location coordinates were not received."
        );
    }

    return {
        lat,
        lng,
        displayName: bestResult.display_name,
        address: bestResult.address
    };
}


/* ============================================================
   8. FIND ON MAP
   ============================================================ */

async function findAddressOnMap(event) {
    if (event) event.preventDefault();

    const button = getElement("locate-address");

    try {
        if (button) button.disabled = true;

        setLocationStatus(
            "Finding your entered location..."
        );

        const query = getLocationQuery();

        const result =
            await geocodeTamilNaduLocation(query);

        currentCoords = {
            lat: result.lat,
            lng: result.lng
        };

        setLocationStatus(
            "Location found successfully.",
            "success"
        );

    } catch (error) {
        currentCoords = {
            lat: null,
            lng: null
        };

        setLocationStatus(error.message, "error");

    } finally {
        if (button) button.disabled = false;
    }
}


/* ============================================================
   9. USE CURRENT LOCATION
   ============================================================ */

function useCurrentLocation(event) {
    if (event) event.preventDefault();

    const button = getElement(
        "use-current-location"
    );

    if (!navigator.geolocation) {
        setLocationStatus(
            "Your browser does not support location access.",
            "error"
        );

        return;
    }

    if (button) button.disabled = true;

    setLocationStatus(
        "Detecting your current location..."
    );

    navigator.geolocation.getCurrentPosition(
        async position => {
            try {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                if (!validCoordinates(lat, lng)) {
                    throw new Error(
                        "Invalid current location coordinates."
                    );
                }

                const url = new URL(
                    "https://nominatim.openstreetmap.org/reverse"
                );

                url.searchParams.set("format", "jsonv2");
                url.searchParams.set("lat", lat);
                url.searchParams.set("lon", lng);
                url.searchParams.set("addressdetails", "1");

                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(
                        "Unable to identify your current location."
                    );
                }

                const result = await response.json();
                const address = result.address || {};

                if (!validateTamilNaduResult(address)) {
                    throw new Error(
                        "Your current location is outside Tamil Nadu."
                    );
                }

                const districtName =
                    address.state_district ||
                    address.county ||
                    address.city_district ||
                    "";

                const districtElement =
                    getElement("district");

                if (districtElement && districtName) {
                    const option = Array.from(
                        districtElement.options
                    ).find(item =>
                        normalizeText(item.value) ===
                        normalizeText(districtName)
                    );

                    if (option) {
                        districtElement.value = option.value;
                    }
                }

                const locality =
                    address.suburb ||
                    address.neighbourhood ||
                    address.village ||
                    address.town ||
                    address.city ||
                    result.name ||
                    "";

                const locationElement =
                    getElement("location");

                if (locationElement && locality) {
                    locationElement.value = locality;
                }

                currentCoords = { lat, lng };

                setLocationStatus(
                    "Your current location was detected successfully.",
                    "success"
                );

            } catch (error) {
                currentCoords = {
                    lat: null,
                    lng: null
                };

                setLocationStatus(error.message, "error");

            } finally {
                if (button) button.disabled = false;
            }
        },

        error => {
            const messages = {
                1: "Location permission denied. Allow location access in your browser.",
                2: "Your current location is unavailable. Check device location settings.",
                3: "Location request timed out. Please try again."
            };

            setLocationStatus(
                messages[error.code] ||
                "Unable to detect your current location.",
                "error"
            );

            if (button) button.disabled = false;
        },

        {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 60000
        }
    );
}


/* ============================================================
   10. RESOLVE TYPED LOCATION
   ============================================================ */

async function resolveTypedLocation(req) {
    if (
        validCoordinates(
            currentCoords.lat,
            currentCoords.lng
        )
    ) {
        req.locationLat = currentCoords.lat;
        req.locationLng = currentCoords.lng;

        return req;
    }

    const query = getLocationQuery();

    const result =
        await geocodeTamilNaduLocation(query);

    currentCoords = {
        lat: result.lat,
        lng: result.lng
    };

    req.locationLat = result.lat;
    req.locationLng = result.lng;

    return req;
}


/* ============================================================
   11. PROPERTY DATA HELPERS
   ============================================================ */

function firstAvailable(...values) {
    for (const value of values) {
        if (
            value !== null &&
            value !== undefined &&
            value !== ""
        ) {
            return value;
        }
    }

    return null;
}

function getDescription(property) {
    return String(
        firstAvailable(
            property.description,
            property.desc,
            property.summary,
            property.propertyDescription,
            property.about,
            ""
        )
    );
}


/* ============================================================
   12. DEPOSIT EXTRACTION
   ============================================================ */

function extractDeposit(property) {
    const directDeposit = firstAvailable(
        property.deposit,
        property.securityDeposit,
        property.security_deposit,
        property.advance,
        property.advanceAmount,
        property.depositAmount
    );

    const directValue =
        positiveNumberOrNull(directDeposit);

    if (directValue !== null) {
        return directValue;
    }

    const description = getDescription(property);

    const patterns = [
        /(?:security\s+)?deposit\s*(?:of|:|is)?\s*₹?\s*([\d,]+)/i,
        /advance\s*(?:of|:|is)?\s*₹?\s*([\d,]+)/i
    ];

    for (const pattern of patterns) {
        const match = description.match(pattern);

        if (match) {
            const amount = Number(
                match[1].replace(/,/g, "")
            );

            if (
                Number.isFinite(amount) &&
                amount > 0
            ) {
                return amount;
            }
        }
    }

    return null;
}


/* ============================================================
   13. FURNISHING EXTRACTION
   ============================================================ */

function extractFurnishing(property) {
    const direct = normalizeText(
        firstAvailable(
            property.furnishing,
            property.furnished,
            property.furnishingStatus,
            property.furnishing_status
        )
    );

    const description = normalizeText(
        getDescription(property) + " " +
        String(property.heading || property.title || "")
    );

    const text = `${direct} ${description}`;

    if (/\bsemi furnished\b/.test(text)) {
        return "Semi-Furnished";
    }

    if (/\bunfurnished\b|\bnot furnished\b/.test(text)) {
        return "Unfurnished";
    }

    if (/\bfurnished\b/.test(text)) {
        return "Furnished";
    }

    return "Unknown";
}


/* ============================================================
   14. FACILITY EXTRACTION
   ============================================================ */

// Each facility has three possible states:
// available, unavailable, or unknown.
// Absence from a listing is NOT proof of unavailability.

function extractFacilities(property) {
    const direct = firstAvailable(
        property.facilities,
        property.amenities,
        property.features,
        property.facility,
        property.amenity
    );

    const description = getDescription(property);

    const heading = String(
        property.heading ||
        property.title ||
        ""
    );

    let sourceText = "";
    let directObject = null;

    if (Array.isArray(direct)) {
        sourceText = direct.join(" ");

    } else if (typeof direct === "string") {
        sourceText = direct;

    } else if (direct && typeof direct === "object") {
        directObject = direct;

        sourceText = Object.entries(direct)
            .map(([key, value]) => `${key} ${value}`)
            .join(" ");
    }

    const text = normalizeText(
        `${sourceText} ${description} ${heading}`
    );

    const definitions = {
        "Wi-Fi": {
            positive: /\bwi[\s-]?fi\b|\bwifi\b/,
            negative: /\b(?:no|without|not available|unavailable)\s+(?:free\s+)?wi[\s-]?fi\b/
        },

        "Washing machine": {
            positive: /\bwashing machine\b/,
            negative: /\b(?:no|without|not available|unavailable)\s+washing machine\b/
        },

        "Attached bathroom": {
            positive: /\battached bathroom\b|\battached bath\b/,
            negative: /\b(?:no|without|not available|unavailable)\s+attached (?:bathroom|bath)\b/
        }
    };

    const facilities = [];
    const facilityStatus = {};

    for (const facility of ALL_FACILITIES) {
        const definition = definitions[facility];

        let status = "unknown";

        if (directObject) {
            const matchingEntry = Object.entries(directObject)
                .find(([key]) =>
                    normalizeText(key) === normalizeText(facility)
                );

            if (matchingEntry) {
                const value = matchingEntry[1];

                if (
                    value === true ||
                    value === 1 ||
                    normalizeText(value) === "yes" ||
                    normalizeText(value) === "available"
                ) {
                    status = "available";
                } else if (
                    value === false ||
                    value === 0 ||
                    normalizeText(value) === "no" ||
                    normalizeText(value) === "unavailable"
                ) {
                    status = "unavailable";
                }
            }
        }

        if (status === "unknown") {
            if (definition.negative.test(text)) {
                status = "unavailable";
            } else if (definition.positive.test(text)) {
                status = "available";
            }
        }

        facilityStatus[facility] = status;

        if (status === "available") {
            facilities.push(facility);
        }
    }

    return {
        facilities,
        facilityStatus,
        facilitiesKnown: Object.values(facilityStatus)
            .every(status => status !== "unknown")
    };
}


/* ============================================================
   15. SHARING EXTRACTION
   ============================================================ */

function extractSharing(property) {
    const direct = firstAvailable(
        property.sharing,
        property.sharingCapacity,
        property.sharing_capacity,
        property.occupancy,
        property.persons
    );

    const directValue =
        positiveNumberOrNull(direct);

    if (directValue !== null) {
        return directValue;
    }

    const text = normalizeText(
        getDescription(property) + " " +
        String(property.heading || property.title || "")
    );

    const match = text.match(/\b([1-9])\s*sharing\b/);

    return match ? Number(match[1]) : null;
}


/* ============================================================
   16. MAP LIVE PROPERTY
   ============================================================ */

function mapLiveProperty(property, index) {
    const rent = positiveNumberOrNull(
        firstAvailable(
            property.rent,
            property.monthlyRent,
            property.monthly_rent,
            property.price,
            property.amount
        )
    );

    const deposit = extractDeposit(property);
    const furnishing = extractFurnishing(property);
    const facilityData = extractFacilities(property);
    const sharing = extractSharing(property);

    const latitude = numberOrNull(
        firstAvailable(
            property.latitude,
            property.lat,
            property.latitudeValue
        )
    );

    const longitude = numberOrNull(
        firstAvailable(
            property.longitude,
            property.lon,
            property.lng,
            property.longitudeValue
        )
    );

    const coordinatesValid =
        validCoordinates(latitude, longitude);

    const bedrooms = positiveNumberOrNull(
        firstAvailable(
            property.bedrooms,
            property.bedroom,
            property.bhk,
            property.bedroomCount
        )
    );

    const bathrooms = positiveNumberOrNull(
        firstAvailable(
            property.bathrooms,
            property.bathroom,
            property.bathroomCount
        )
    );

    const locality = firstAvailable(
        property.locality,
        property.subLocality,
        property.area,
        property.location,
        property.address
    );

    const city = firstAvailable(
        property.city,
        property.cityName,
        "Coimbatore"
    );

    const image = firstAvailable(
        property.image,
        property.imageUrl,
        property.image_url,
        property.photo,
        property.thumbnail,
        Array.isArray(property.images)
            ? property.images[0]
            : null
    );

    const listingUrl = firstAvailable(
        property.url,
        property.propertyUrl,
        property.property_url,
        property.link,
        property.detailUrl,
        property.propertyLink
    );

    const name = firstAvailable(
        property.heading,
        property.title,
        property.projectName,
        property.name,
        locality
            ? `${bedrooms || ""} BHK Property in ${locality}`
            : `Rental Property ${index + 1}`
    );

    const id = firstAvailable(
        property.id,
        property.propertyId,
        property.property_id,
        property.listingId,
        null
    );

    return {
        id: String(
            id !== null
                ? id
                : `99acres-${index + 1}`
        ),

        source: "99acres",

        name: String(name),
        title: String(name),

        locality: String(
            locality || "Location not provided"
        ),

        location: String(
            locality || city || "Location not provided"
        ),

        city: String(city),
        state: "Tamil Nadu",

        rent,
        deposit,
        bedrooms,
        bathrooms,

        latitude:
            coordinatesValid ? latitude : null,

        longitude:
            coordinatesValid ? longitude : null,

        image:
            typeof image === "string" ? image : null,

        url:
            typeof listingUrl === "string"
                ? listingUrl
                : null,

        description: getDescription(property),

        furnished: furnishing,
        sharing,

        facilities: facilityData.facilities,
        facilityStatus: facilityData.facilityStatus,
        facilitiesKnown: facilityData.facilitiesKnown,

        distanceKm: null,
        travelTimeMin: null
    };
}


/* ============================================================
   17. EXTRACT SCRAPPA RESPONSE
   ============================================================ */

function extractPropertiesFromResponse(data) {
    if (!data) return [];

    if (Array.isArray(data)) {
        return data;
    }

    const candidates = [
        data.data?.properties,
        data.data?.results,
        data.data?.listings,
        data.properties,
        data.results,
        data.listings,
        data.data
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return [];
}


/* ============================================================
   18. FETCH LIVE 99ACRES
   ============================================================ */

async function fetchLive99Acres(page = 1) {
    const url = new URL(
        `${API_URL}/api/99acres/search`
    );

    url.searchParams.set("page", String(page));

    const response = await fetch(url);

    if (!response.ok) {
        let message =
            `99acres API request failed (${response.status}).`;

        try {
            const errorData = await response.json();

            message =
                errorData.message ||
                errorData.error ||
                message;

        } catch {
            // Keep the default error message.
        }

        throw new Error(message);
    }

    const data = await response.json();

    if (data.success === false) {
        throw new Error(
            data.message ||
            data.error ||
            "99acres returned an unsuccessful response."
        );
    }

    const rawProperties =
        extractPropertiesFromResponse(data);

    if (rawProperties.length === 0) {
        throw new Error(
            "No rental properties were returned by 99acres."
        );
    }

    const properties = rawProperties
        .map((property, index) =>
            mapLiveProperty(property, index)
        )
        .filter(property =>
            property.rent !== null
        );

    if (properties.length === 0) {
        throw new Error(
            "Listings were received, but valid rental prices were not found."
        );
    }

    return {
        properties,

        total: firstAvailable(
            data.data?.total,
            data.total,
            data.data?.totalResults,
            rawProperties.length
        ),

        page: firstAvailable(
            data.data?.page,
            data.page,
            page
        ),

        hasMore: Boolean(
            firstAvailable(
                data.data?.has_more,
                data.data?.hasMore,
                data.has_more,
                data.hasMore,
                false
            )
        )
    };
}
/* ============================================================
   19. MATCHING CRITERION HELPER
   ============================================================ */

function addMatchCriterion(
    criteria,
    name,
    weight,
    score,
    status,
    details = ""
) {
    criteria.push({
        name,
        weight,
        score: Math.max(0, Math.min(100, score)),
        status,
        details
    });
}


/* ============================================================
   20. FACILITY STATUS HELPER
   ============================================================ */

function getFacilityStatus(property, facility) {
    const statusMap = property.facilityStatus || {};

    const directStatus = statusMap[facility];

    if (
        directStatus === "available" ||
        directStatus === "unavailable"
    ) {
        return directStatus;
    }

    // Older saved results may only contain a facilities array.
    // A listed facility is verified as available.
    // An omitted facility remains unknown.

    const facilities = Array.isArray(property.facilities)
        ? property.facilities
        : [];

    const found = facilities.some(item =>
        normalizeText(item) === normalizeText(facility)
    );

    return found ? "available" : "unknown";
}


/* ============================================================
   21. FURNISHING NORMALIZATION
   ============================================================ */

function normalizeFurnishing(value) {
    const text = normalizeText(value);

    if (
        text.includes("semi furnished") ||
        text.includes("semi-furnished")
    ) {
        return "Semi-Furnished";
    }

    if (
        text.includes("unfurnished") ||
        text.includes("not furnished")
    ) {
        return "Unfurnished";
    }

    if (text.includes("furnished")) {
        return "Furnished";
    }

    return "Unknown";
}


/* ============================================================
   22. COMPUTE LIVE MATCH
   ============================================================ */

function computeLiveMatch(property, req) {
    const criteria = [];

    let earnedPoints = 0;
    let availableWeight = 0;
    let requestedWeight = 0;

    const eligibilityReasons = [];

    const rent = positiveNumberOrNull(property.rent);
    const deposit = nonNegativeNumberOrNull(property.deposit);

    const budget = positiveNumberOrNull(req.budget);
    const maxDeposit = nonNegativeNumberOrNull(
        req.maxDeposit
    );

    const distanceData = getDistanceAndTime(
        property,
        req
    );

    const distanceKm = distanceData.distanceKm;
    const travelTimeMin = distanceData.travelTimeMin;

    let budgetStatus = "unknown";
    let depositStatus = "unknown";

    /* ---------- BUDGET ---------- */

    if (budget !== null) {
        requestedWeight += WEIGHTS.budget;

        if (rent !== null) {
            availableWeight += WEIGHTS.budget;

            if (rent <= budget) {
                budgetStatus = "pass";

                addMatchCriterion(
                    criteria,
                    "Budget",
                    WEIGHTS.budget,
                    100,
                    "pass",
                    `Rent ${formatINR(rent)} is within your budget.`
                );

            } else {
                budgetStatus = "fail";

                addMatchCriterion(
                    criteria,
                    "Budget",
                    WEIGHTS.budget,
                    0,
                    "fail",
                    `Rent ${formatINR(rent)} exceeds your budget of ${formatINR(budget)}.`
                );

                eligibilityReasons.push(
                    "Monthly rent exceeds your budget."
                );
            }

            const budgetCriterion = criteria[
                criteria.length - 1
            ];

            earnedPoints +=
                WEIGHTS.budget *
                budgetCriterion.score / 100;
        }
    }


    /* ---------- DISTANCE ---------- */

    if (positiveNumberOrNull(req.maxDistance) !== null) {
        requestedWeight += WEIGHTS.distance;

        if (distanceKm !== null) {
            availableWeight += WEIGHTS.distance;

            const maxDistance = Number(req.maxDistance);

            let score = 0;
            let status = "fail";

            if (distanceKm <= maxDistance) {
                score = 100;
                status = "pass";

            } else {
                score = Math.max(
                    0,
                    Math.round(
                        (maxDistance / distanceKm) * 100
                    )
                );

                status = "partial";
            }

            addMatchCriterion(
                criteria,
                "Distance",
                WEIGHTS.distance,
                score,
                status,
                `${distanceKm.toFixed(1)} km straight-line distance.`
            );

            earnedPoints +=
                WEIGHTS.distance * score / 100;
        }
    }


    /* ---------- TRAVEL TIME ---------- */

    if (positiveNumberOrNull(req.maxTravelTime) !== null) {
        requestedWeight += WEIGHTS.travelTime;

        if (travelTimeMin !== null) {
            availableWeight += WEIGHTS.travelTime;

            const maxTime = Number(req.maxTravelTime);

            let score = 0;
            let status = "fail";

            if (travelTimeMin <= maxTime) {
                score = 100;
                status = "pass";

            } else {
                score = Math.max(
                    0,
                    Math.round(
                        (maxTime / travelTimeMin) * 100
                    )
                );

                status = "partial";
            }

            addMatchCriterion(
                criteria,
                "Travel time",
                WEIGHTS.travelTime,
                score,
                status,
                `${travelTimeMin} minutes estimated travel time.`
            );

            earnedPoints +=
                WEIGHTS.travelTime * score / 100;
        }
    }


    /* ---------- DEPOSIT ---------- */

    if (maxDeposit !== null) {
        requestedWeight += WEIGHTS.deposit;

        if (deposit !== null) {
            availableWeight += WEIGHTS.deposit;

            let score = 0;
            let status = "fail";

            if (deposit <= maxDeposit) {
                score = 100;
                status = "pass";

            } else {
                score = 0;
                status = "fail";

                eligibilityReasons.push(
                    "Security deposit exceeds your maximum limit."
                );
            }

            depositStatus = status;

            addMatchCriterion(
                criteria,
                "Deposit",
                WEIGHTS.deposit,
                score,
                status,
                `Deposit ${formatINR(deposit)}; your limit is ${formatINR(maxDeposit)}.`
            );

            earnedPoints +=
                WEIGHTS.deposit * score / 100;
        }
    }


    /* ---------- FACILITIES ---------- */

    const requestedFacilities = Array.isArray(req.facilities)
        ? req.facilities
        : [];

    if (requestedFacilities.length > 0) {
        requestedWeight += WEIGHTS.facilities;

        const facilityResults = requestedFacilities.map(
            facility => ({
                facility,
                status: getFacilityStatus(property, facility)
            })
        );

        const verifiedFacilities = facilityResults.filter(
            item => item.status !== "unknown"
        );

        if (verifiedFacilities.length > 0) {
            const verifiedRatio =
                verifiedFacilities.length /
                requestedFacilities.length;

            const effectiveWeight =
                WEIGHTS.facilities * verifiedRatio;

            availableWeight += effectiveWeight;

            const availableCount =
                verifiedFacilities.filter(
                    item => item.status === "available"
                ).length;

            const facilityScore =
                availableCount /
                verifiedFacilities.length * 100;

            const unknownCount =
                requestedFacilities.length -
                verifiedFacilities.length;

            let status = "partial";

            if (
                unknownCount === 0 &&
                availableCount === requestedFacilities.length
            ) {
                status = "pass";

            } else if (availableCount === 0) {
                status = "fail";
            }

            const availableNames =
                verifiedFacilities
                    .filter(item => item.status === "available")
                    .map(item => item.facility);

            const unavailableNames =
                verifiedFacilities
                    .filter(item => item.status === "unavailable")
                    .map(item => item.facility);

            const details = [
                availableNames.length
                    ? `Available: ${availableNames.join(", ")}.`
                    : "",

                unavailableNames.length
                    ? `Unavailable: ${unavailableNames.join(", ")}.`
                    : "",

                unknownCount
                    ? `${unknownCount} facility detail(s) not verified.`
                    : ""
            ].filter(Boolean).join(" ");

            addMatchCriterion(
                criteria,
                "Facilities",
                effectiveWeight,
                facilityScore,
                status,
                details
            );

            earnedPoints +=
                effectiveWeight * facilityScore / 100;
        }
    }


    /* ---------- FURNISHING ---------- */

    const requestedFurnishing =
        normalizeFurnishing(req.furnished);

    const actualFurnishing =
        normalizeFurnishing(property.furnished);

    if (
        requestedFurnishing !== "Unknown" &&
        requestedFurnishing !== "Any"
    ) {
        requestedWeight += WEIGHTS.furnishing;

        if (actualFurnishing !== "Unknown") {
            availableWeight += WEIGHTS.furnishing;

            const score =
                actualFurnishing === requestedFurnishing
                    ? 100
                    : 0;

            const status = score === 100
                ? "pass"
                : "fail";

            addMatchCriterion(
                criteria,
                "Furnishing",
                WEIGHTS.furnishing,
                score,
                status,
                `Requested: ${requestedFurnishing}. Available: ${actualFurnishing}.`
            );

            earnedPoints +=
                WEIGHTS.furnishing * score / 100;
        }
    }


    /* ---------- SHARING ---------- */

    const requestedSharing =
        positiveNumberOrNull(req.sharing);

    const actualSharing =
        positiveNumberOrNull(property.sharing);

    if (requestedSharing !== null) {
        requestedWeight += WEIGHTS.sharing;

        if (actualSharing !== null) {
            availableWeight += WEIGHTS.sharing;

            const score =
                actualSharing === requestedSharing
                    ? 100
                    : 0;

            const status = score === 100
                ? "pass"
                : "fail";

            addMatchCriterion(
                criteria,
                "Sharing",
                WEIGHTS.sharing,
                score,
                status,
                `Requested: ${requestedSharing} sharing. Available: ${actualSharing} sharing.`
            );

            earnedPoints +=
                WEIGHTS.sharing * score / 100;
        }
    }


    /* ---------- FINAL SCORE ---------- */

    const matchScore = availableWeight > 0
        ? Math.round(
            (earnedPoints / availableWeight) * 100
        )
        : 0;

    const confidence = requestedWeight > 0
        ? Math.round(
            (availableWeight / requestedWeight) * 100
        )
        : 0;

    const recommendationEligible =
        budgetStatus !== "fail" &&
        depositStatus !== "fail";

    let recommendationStatus;

    if (!recommendationEligible) {
        recommendationStatus = "Not eligible";

    } else if (confidence < 50) {
        recommendationStatus = "Insufficient information";

    } else if (matchScore >= 85) {
        recommendationStatus = "Excellent match";

    } else if (matchScore >= 70) {
        recommendationStatus = "Good match";

    } else if (matchScore >= 50) {
        recommendationStatus = "Moderate match";

    } else {
        recommendationStatus = "Low match";
    }

    if (
        recommendationEligible &&
        confidence < 50
    ) {
        eligibilityReasons.push(
            "More property information is needed to verify this match."
        );
    }

    return {
        ...property,

        matchScore,
        // Alias kept so any older page reading "score" still works.
        score: matchScore,
        confidence,

        criteria,

        earnedPoints: Math.round(earnedPoints * 100) / 100,

        availableWeight:
            Math.round(availableWeight * 100) / 100,

        requestedWeight,

        budgetStatus,
        depositStatus,

        recommendationEligible,
        recommendationStatus,
        eligibilityReasons,

        distanceKm,
        travelTimeMin,

        distanceMethod: distanceData.distanceMethod,
        travelTimeMethod: distanceData.travelTimeMethod,

        exact: false
    };
}


/* ============================================================
   23. MATCH LABELS
   ============================================================ */

function getMatchLabel(score) {
    if (score >= 85) return "Excellent Match";
    if (score >= 70) return "Good Match";
    if (score >= 50) return "Moderate Match";

    return "Low Match";
}

function getConfidenceLabel(confidence) {
    if (!Number.isFinite(Number(confidence))) {
        return "Confidence unavailable";
    }

    if (confidence >= 80) return "High confidence";
    if (confidence >= 50) return "Medium confidence";

    return "Low confidence";
}


/* ============================================================
   24. RANK LIVE PROPERTIES
   ============================================================ */

function rankLiveProperties(properties, req) {
    if (!Array.isArray(properties)) return [];

    const ranked = properties
        .filter(property =>
            property && typeof property === "object"
        )
        .map(property =>
            computeLiveMatch(property, req)
        );

    ranked.sort((a, b) => {
        // Eligible listings always come first.
        if (
            a.recommendationEligible !==
            b.recommendationEligible
        ) {
            return a.recommendationEligible ? -1 : 1;
        }

        // Higher match score comes first.
        if (b.matchScore !== a.matchScore) {
            return b.matchScore - a.matchScore;
        }

        // Higher confidence comes first.
        if (b.confidence !== a.confidence) {
            return b.confidence - a.confidence;
        }

        // Lower rent is preferred when scores are equal.
        return (
            (a.rent ?? Infinity) -
            (b.rent ?? Infinity)
        );
    });

    return ranked;
}


/* ============================================================
   25. TOP MATCHES
   ============================================================ */

function getTopMatches(properties, limit = 3) {
    if (!Array.isArray(properties)) return [];

    return properties
        .filter(property =>
            property.recommendationEligible === true &&
            property.confidence >= 50
        )
        .slice(0, limit);
}


/* ============================================================
   26. SCORE SUMMARY
   ============================================================ */

function getScoreSummary(properties) {
    if (!Array.isArray(properties) || properties.length === 0) {
        return {
            total: 0,
            eligible: 0,
            overBudget: 0,
            depositExceeded: 0,
            averageScore: 0
        };
    }

    const eligible = properties.filter(property =>
        property.recommendationEligible
    );

    const overBudget = properties.filter(property =>
        property.budgetStatus === "fail"
    );

    const depositExceeded = properties.filter(property =>
        property.depositStatus === "fail"
    );

    const scored = eligible.filter(property =>
        Number.isFinite(property.matchScore)
    );

    const averageScore = scored.length > 0
        ? Math.round(
            scored.reduce(
                (total, property) =>
                    total + property.matchScore,
                0
            ) / scored.length
        )
        : 0;

    return {
        total: properties.length,
        eligible: eligible.length,
        overBudget: overBudget.length,
        depositExceeded: depositExceeded.length,
        averageScore
    };
}


/* ============================================================
   27. READ FORM REQUIREMENTS
   ============================================================ */

function readRequirementsFromForm() {
    const country =
        getElement("country")?.value || "India";

    const state =
        getElement("state")?.value || "Tamil Nadu";

    const district =
        getElement("district")?.value || "";

    const location =
        getElement("location")?.value.trim() || "";

    const budget =
        positiveNumberOrNull(
            getElement("budget")?.value
        );

    const maxDistance =
        positiveNumberOrNull(
            getElement("maxDistance", "max-distance")?.value
        );

    const maxTravelTime =
        positiveNumberOrNull(
            getElement("maxTravelTime", "max-travel-time")?.value
        );

    const maxDeposit =
        nonNegativeNumberOrNull(
            getElement("maxDeposit", "max-deposit")?.value
        );

    const sharing =
        positiveNumberOrNull(
            getElement("sharing")?.value
        );

    const furnished =
        getElement("furnished")?.value || "Any";

    const food =
        getElement("food")?.value || "Any";

    const facilities = Array.from(
        document.querySelectorAll(
            'input[name="facilities"]:checked'
        )
    ).map(input => input.value);

    return {
        country,
        state,
        district,
        location,

        locationLat: currentCoords.lat,
        locationLng: currentCoords.lng,

        budget,
        maxDistance,
        maxTravelTime,
        maxDeposit,
        sharing,

        furnished,
        facilities,
        food
    };
}


/* ============================================================
   28. VALIDATE FORM REQUIREMENTS
   ============================================================ */

function validateRequirements(req) {
    if (
        normalizeText(req.country) !== "india" ||
        normalizeText(req.state) !== "tamil nadu"
    ) {
        return "Please select India and Tamil Nadu.";
    }

    if (!req.district) {
        return "Please select your district.";
    }

    if (!req.location) {
        return "Please enter your area or locality.";
    }

    if (req.budget === null || req.budget <= 0) {
        return "Please enter a valid monthly budget.";
    }

    if (
        req.maxDistance === null ||
        req.maxDistance <= 0
    ) {
        return "Please enter a valid maximum distance.";
    }

    if (
        req.maxTravelTime === null ||
        req.maxTravelTime <= 0
    ) {
        return "Please enter a valid maximum travel time.";
    }

    if (
        req.maxDeposit === null ||
        req.maxDeposit < 0
    ) {
        return "Please enter a valid maximum deposit.";
    }

    if (req.sharing === null || req.sharing <= 0) {
        return "Please select a valid sharing preference.";
    }

    return null;
}
/* ============================================================
   29. LOADING AND ERROR DISPLAY
   ============================================================ */

function setLoading(isLoading, message = "Searching live rental properties...") {
    const button = getElement(
        "search-button",
        "searchBtn",
        "search-btn"
    );

    const loading = getElement(
        "loading",
        "loading-message"
    );

    if (button) {
        button.disabled = isLoading;
        button.textContent = isLoading
            ? "Searching..."
            : "Search Properties";
    }

    if (loading) {
        loading.textContent = isLoading ? message : "";
        loading.style.display = isLoading ? "block" : "none";
    }
}

function showSearchError(message) {
    const container = getElement(
        "error-message",
        "search-error"
    );

    if (container) {
        container.textContent = message;
        container.style.display = "block";
    } else {
        alert(message);
    }
}

function clearSearchError() {
    const container = getElement(
        "error-message",
        "search-error"
    );

    if (container) {
        container.textContent = "";
        container.style.display = "none";
    }
}


/* ============================================================
   30. PROPERTY IMAGE
   ============================================================ */

function getPropertyImage(property) {
    if (
        property.image &&
        typeof property.image === "string"
    ) {
        return property.image;
    }

    return "";
}


/* ============================================================
   31. SHORTLIST
   ============================================================ */

function toggleShortlist(propertyId) {
    const properties = getSavedLiveResults();

    const property = properties.find(item =>
        String(item.id) === String(propertyId)
    );

    if (!property) {
        alert("Property not found.");
        return;
    }

    let shortlist = getShortlist();

    const exists = shortlist.some(item =>
        String(item.id) === String(propertyId)
    );

    if (exists) {
        shortlist = shortlist.filter(item =>
            String(item.id) !== String(propertyId)
        );

        alert("Property removed from shortlist.");

    } else {
        shortlist.push(property);

        alert("Property added to shortlist.");
    }

    saveShortlist(shortlist);

    renderProperties(properties);

    if (typeof renderShortlistPage === "function") {
        renderShortlistPage();
    }
}


/* ============================================================
   32. COMPARE
   ============================================================ */

function toggleCompare(propertyId) {
    const properties = getSavedLiveResults();

    const property = properties.find(item =>
        String(item.id) === String(propertyId)
    );

    if (!property) {
        alert("Property not found.");
        return;
    }

    let compareList = getCompareList();

    const exists = compareList.some(item =>
        String(item.id) === String(propertyId)
    );

    if (exists) {
        compareList = compareList.filter(item =>
            String(item.id) !== String(propertyId)
        );

        alert("Property removed from comparison.");

    } else {
        if (compareList.length >= 3) {
            alert("You can compare a maximum of 3 properties.");
            return;
        }

        compareList.push(property);

        alert("Property added to comparison.");
    }

    saveCompareList(compareList);

    renderProperties(properties);

    if (typeof renderComparePage === "function") {
        renderComparePage();
    }
}


/* ============================================================
   33. MATCH BREAKDOWN
   ============================================================ */

function renderMatchBreakdown(property) {
    const criteria = Array.isArray(property.criteria)
        ? property.criteria
        : [];

    if (criteria.length === 0) {
        return `
            <p class="match-breakdown-empty">
                No verified matching details available.
            </p>
        `;
    }

    return `
        <div class="match-breakdown">
            <h4>Match Breakdown</h4>

            ${criteria.map(item => `
                <div class="criterion-row">
                    <div class="criterion-heading">
                        <span>${escapeHTML(item.name)}</span>

                        <strong>
                            ${formatPercent(item.score)}
                        </strong>
                    </div>

                    <div class="criterion-progress">
                        <div
                            class="criterion-progress-fill"
                            style="width:${Math.max(0, Math.min(100, Number(item.score) || 0))}%"
                        ></div>
                    </div>

                    <small class="criterion-status">
                        ${escapeHTML(item.status)}
                        ${item.details
                            ? " — " + escapeHTML(item.details)
                            : ""}
                    </small>
                </div>
            `).join("")}
        </div>
    `;
}


/* ============================================================
   34. PROPERTY CARD
   ============================================================ */

function renderPropertyCard(property) {
    const shortlist = getShortlist();
    const compareList = getCompareList();

    const isShortlisted = shortlist.some(item =>
        String(item.id) === String(property.id)
    );

    const isCompared = compareList.some(item =>
        String(item.id) === String(property.id)
    );

    const eligible =
        property.recommendationEligible === true;

    const image = getPropertyImage(property);

    const imageHTML = image
        ? `
            <img
                src="${escapeHTML(image)}"
                alt="${escapeHTML(property.name)}"
                class="property-image"
                loading="lazy"
                onerror="this.style.display='none'"
            >
        `
        : `
            <div class="property-image-placeholder">
                Property image unavailable
            </div>
        `;

    const distanceText =
        property.distanceKm !== null &&
        property.distanceKm !== undefined
            ? `${Number(property.distanceKm).toFixed(1)} km`
            : "Not verified";

    const timeText =
        property.travelTimeMin !== null &&
        property.travelTimeMin !== undefined
            ? `${property.travelTimeMin} min (estimated)`
            : "Not verified";

    const reasons = Array.isArray(
        property.eligibilityReasons
    )
        ? property.eligibilityReasons
        : [];

    const eligibilityHTML = eligible
        ? `
            <span class="recommendation-badge eligible">
                ${escapeHTML(property.recommendationStatus)}
            </span>
        `
        : `
            <span class="recommendation-badge not-eligible">
                ${escapeHTML(property.recommendationStatus)}
            </span>
        `;

    const reasonsHTML = reasons.length > 0
        ? `
            <ul class="eligibility-reasons">
                ${reasons.map(reason => `
                    <li>${escapeHTML(reason)}</li>
                `).join("")}
            </ul>
        `
        : "";

    const facilitiesHTML = ALL_FACILITIES.map(facility => {
        const status = getFacilityStatus(
            property,
            facility
        );

        let label = "Not verified";

        if (status === "available") {
            label = "Available";
        } else if (status === "unavailable") {
            label = "Unavailable";
        }

        return `
            <li>
                <span>${escapeHTML(facility)}</span>
                <strong>${label}</strong>
            </li>
        `;
    }).join("");

    return `
        <article class="property-card">

            ${imageHTML}

            <div class="property-card-content">

                <div class="property-title-row">
                    <h3>${escapeHTML(property.name)}</h3>

                    ${eligibilityHTML}
                </div>

                <p class="property-location">
                    ${escapeHTML(property.locality)},
                    ${escapeHTML(property.city)}
                </p>

                <div class="property-price">
                    <strong>${formatINR(property.rent)}</strong>
                    <span>/ month</span>
                </div>

                <div class="property-details">
                    <span>
                        Deposit: ${formatINR(property.deposit)}
                    </span>

                    <span>
                        ${property.bedrooms
                            ? property.bedrooms + " BHK"
                            : "Bedrooms not specified"}
                    </span>

                    <span>
                        ${property.bathrooms
                            ? property.bathrooms + " Bathrooms"
                            : "Bathrooms not specified"}
                    </span>
                </div>

                <div class="property-match">

                    <div class="match-score">
                        <strong>${formatPercent(property.matchScore)}</strong>
                        <span>Match Score</span>
                    </div>

                    <div class="match-confidence">
                        <strong>${formatPercent(property.confidence)}</strong>
                        <span>${getConfidenceLabel(property.confidence)}</span>
                    </div>

                </div>

                ${reasonsHTML}

                <div class="property-distance">
                    <p>Distance: ${escapeHTML(distanceText)}</p>
                    <p>Travel time: ${escapeHTML(timeText)}</p>
                </div>

                <div class="property-furnishing">
                    Furnishing:
                    ${escapeHTML(property.furnished || "Unknown")}
                </div>

                <details class="property-facilities">
                    <summary>Facility verification</summary>

                    <ul>
                        ${facilitiesHTML}
                    </ul>
                </details>

                ${renderMatchBreakdown(property)}

                <div class="property-actions">

                    <button
                        type="button"
                        onclick="toggleShortlist('${escapeHTML(property.id)}')"
                    >
                        ${isShortlisted
                            ? "Remove Shortlist"
                            : "Add to Shortlist"}
                    </button>

                    <button
                        type="button"
                        onclick="toggleCompare('${escapeHTML(property.id)}')"
                    >
                        ${isCompared
                            ? "Remove Compare"
                            : "Compare"}
                    </button>

                    ${property.url
                        ? `
                            <a
                                href="${escapeHTML(property.url)}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View Original Listing
                            </a>
                        `
                        : ""
                    }

                </div>

            </div>
        </article>
    `;
}


/* ============================================================
   35. RESULTS SUMMARY
   ============================================================ */

function renderResultsSummary(properties) {
    const container = getElement(
        "results-summary",
        "search-summary"
    );

    if (!container) return;

    const summary = getScoreSummary(properties);

    const topMatches = getTopMatches(properties, 3);

    let topMatchesHTML = "";

    if (topMatches.length > 0) {
        topMatchesHTML = `
            <h3>AI Recommended Properties</h3>

            <ol>
                ${topMatches.map(property => `
                    <li>
                        <strong>
                            ${escapeHTML(property.name)}
                        </strong>

                        — ${formatPercent(property.matchScore)} Match
                    </li>
                `).join("")}
            </ol>
        `;

    } else {
        topMatchesHTML = `
            <p>
                No properties currently meet your essential
                budget and deposit limits with sufficient
                verified information.
            </p>
        `;
    }

    container.innerHTML = `
        <div class="results-summary">

            <h3>Search Results Summary</h3>

            <p>
                Live properties found:
                <strong>${summary.total}</strong>
            </p>

            <p>
                Eligible properties:
                <strong>${summary.eligible}</strong>
            </p>

            <p>
                Over budget:
                <strong>${summary.overBudget}</strong>
            </p>

            <p>
                Deposit exceeds limit:
                <strong>${summary.depositExceeded}</strong>
            </p>

            <p>
                Average eligible match score:
                <strong>${formatPercent(summary.averageScore)}</strong>
            </p>

            ${topMatchesHTML}

        </div>
    `;
}


/* ============================================================
   36. RENDER PROPERTIES
   ============================================================ */

function renderProperties(properties) {
    const container = getElement(
    "property-list",
    "property-results",
    "results",
    "properties-container"
);

    if (!container) {
        console.error(
            "Property results container was not found."
        );

        return;
    }

    // Safety net: any property without a valid score is scored
    // here, so the page can never show "undefined%".
    const safeProperties = ensureScoredList(properties);

    renderResultsSummary(safeProperties);

    if (safeProperties.length === 0) {
        container.innerHTML = `
            <p>No live rental properties found.</p>
        `;

        return;
    }

    container.innerHTML = safeProperties
        .map(property => renderPropertyCard(property))
        .join("");
}


/* ============================================================
   37. MAIN LIVE SEARCH
   ============================================================ */

async function searchLiveProperties(event) {
    if (event) event.preventDefault();

    clearSearchError();

    let req = readRequirementsFromForm();

    const validationError =
        validateRequirements(req);

    if (validationError) {
        showSearchError(validationError);
        return;
    }

    setLoading(true);

    try {
        setLocationStatus(
            "Verifying your selected location..."
        );

        req = await resolveTypedLocation(req);

        saveRequirements(req);

        setLocationStatus(
            "Location verified. Searching live 99acres listings..."
        );

        const result = await fetchLive99Acres(1);

        const rankedProperties = rankLiveProperties(
            result.properties,
            req
        );

        saveLiveResults(rankedProperties);

        renderProperties(rankedProperties);

        setLocationStatus(
            `Found ${rankedProperties.length} live rental properties.`,
            "success"
        );

    } catch (error) {
        console.error("Live search error:", error);

        showSearchError(
            error.message ||
            "Unable to search live rental properties."
        );

        setLocationStatus(
            "Search failed. Please try again.",
            "error"
        );

    } finally {
        setLoading(false);
    }
}


/* ============================================================
   38. SHORTLIST PAGE
   ============================================================ */

function renderShortlistPage() {
    const container = getElement(
        "shortlist-results",
        "shortlist-container"
    );

    if (!container) return;

    const shortlist = getShortlist();

    if (shortlist.length === 0) {
        container.innerHTML = `
            <p>You have not shortlisted any properties yet.</p>
        `;

        return;
    }

    container.innerHTML = shortlist
        .map(property => renderPropertyCard(property))
        .join("");
}


/* ============================================================
   39. COMPARE PAGE
   ============================================================ */

function renderComparePage() {
    const container = getElement(
        "compare-results",
        "compare-container"
    );

    if (!container) return;

    const compareList = getCompareList();

    if (compareList.length === 0) {
        container.innerHTML = `
            <p>Add properties to compare them.</p>
        `;

        return;
    }

    const rows = [
        ["Rent", property => formatINR(property.rent)],
        ["Deposit", property => formatINR(property.deposit)],
        ["Bedrooms", property => property.bedrooms ?? "Unknown"],
        ["Bathrooms", property => property.bathrooms ?? "Unknown"],
        ["Furnishing", property => property.furnished || "Unknown"],
        ["Sharing", property => property.sharing ?? "Unknown"],
        ["Distance", property => property.distanceKm !== null && property.distanceKm !== undefined
            ? `${property.distanceKm} km`
            : "Unknown"],
        ["Travel time", property => property.travelTimeMin !== null && property.travelTimeMin !== undefined
            ? `${property.travelTimeMin} min (estimated)`
            : "Unknown"],
        ["Match score", property => formatPercent(property.matchScore)],
        ["Confidence", property => formatPercent(property.confidence)],
        ["Recommendation", property => property.recommendationStatus || "Unknown"],
        ["Eligibility", property => property.recommendationEligible
            ? "Eligible"
            : "Not eligible"]
    ];

    container.innerHTML = `
        <div class="comparison-table-wrapper">

            <table class="comparison-table">

                <thead>
                    <tr>
                        <th>Details</th>

                        ${compareList.map(property => `
                            <th>
                                ${escapeHTML(property.name)}
                            </th>
                        `).join("")}
                    </tr>
                </thead>

                <tbody>

                    ${rows.map(([label, getter]) => `
                        <tr>
                            <th>${escapeHTML(label)}</th>

                            ${compareList.map(property => `
                                <td>
                                    ${escapeHTML(getter(property))}
                                </td>
                            `).join("")}
                        </tr>
                    `).join("")}

                </tbody>

            </table>

        </div>
    `;
}


/* ============================================================
   40. RESTORE SAVED FORM
   ============================================================ */

function restoreSavedForm() {
    const req = getSavedRequirements();

    const fields = {
        country: req.country,
        state: req.state,
        district: req.district,
        location: req.location,
        budget: req.budget,
        maxDistance: req.maxDistance,
        "max-distance": req.maxDistance,
        maxTravelTime: req.maxTravelTime,
        "max-travel-time": req.maxTravelTime,
        maxDeposit: req.maxDeposit,
        "max-deposit": req.maxDeposit,
        sharing: req.sharing,
        furnished: req.furnished,
        food: req.food
    };

    Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);

        if (element && value !== null && value !== undefined) {
            element.value = value;
        }
    });

    currentCoords = {
        lat: req.locationLat,
        lng: req.locationLng
    };

    const savedFacilities = Array.isArray(req.facilities)
        ? req.facilities
        : [];

    document.querySelectorAll(
        'input[name="facilities"]'
    ).forEach(input => {
        input.checked = savedFacilities.includes(
            input.value
        );
    });
}


/* ============================================================
   41. LOCATION EVENT LISTENERS
   ============================================================ */

function setupLocationListeners() {
    const findButton = getElement("locate-address");

    const currentLocationButton = getElement(
        "use-current-location"
    );

    const locationInput = getElement("location");

    const districtInput = getElement("district");

    if (findButton) {
        findButton.addEventListener(
            "click",
            findAddressOnMap
        );
    }

    if (currentLocationButton) {
        currentLocationButton.addEventListener(
            "click",
            useCurrentLocation
        );
    }

    if (locationInput) {
        locationInput.addEventListener("input", () => {
            currentCoords = {
                lat: null,
                lng: null
            };

            setLocationStatus(
                "Location changed. Verify it before searching."
            );
        });
    }

    if (districtInput) {
        districtInput.addEventListener("change", () => {
            currentCoords = {
                lat: null,
                lng: null
            };

            setLocationStatus(
                "District changed. Verify your location again."
            );
        });
    }
}


/* ============================================================
   42. APPLICATION INITIALIZATION
   ============================================================ */

function initializeRentMatch() {
    restoreSavedForm();

    setupLocationListeners();

    const searchButton = getElement(
        "search-button",
        "searchBtn",
        "search-btn"
    );

    if (searchButton) {
        searchButton.addEventListener(
            "click",
            searchLiveProperties
        );
    }

    const searchForm = getElement("search-form");

    if (searchForm) {
        searchForm.addEventListener(
            "submit",
            searchLiveProperties
        );
    }

    let savedResults = getSavedLiveResults();

    // Re-score saved results with the current engine so results
    // saved by an older version show correct scores.
    if (savedResults.length > 0) {
        savedResults = rankLiveProperties(
            savedResults,
            getSavedRequirements()
        );

        saveLiveResults(savedResults);
    }

    const page = window.location.pathname.toLowerCase();

    if (
        page.includes("shortlist") ||
        getElement("shortlist-results") ||
        getElement("shortlist-container")
    ) {
        renderShortlistPage();

    } else if (
        page.includes("compare") ||
        getElement("compare-results") ||
        getElement("compare-container")
    ) {
        renderComparePage();

    } else if (savedResults.length > 0) {
        renderProperties(savedResults);
    }
}


/* ============================================================
   43. START APPLICATION
   ============================================================ */

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeRentMatch
    );

} else {
    initializeRentMatch();
}


/* ============================================================
   END OF RENTMATCH AI SCRIPT
   ============================================================ */