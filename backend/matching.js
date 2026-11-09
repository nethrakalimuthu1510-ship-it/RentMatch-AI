// RentMatch AI - Shared Matching Engine
// Scores are normalized using verified listing information.
// Confidence shows how much of the requested criteria could be evaluated.

const WEIGHTS = {
    budget: 25,
    distance: 20,
    travelTime: 15,
    deposit: 15,
    facilities: 15,
    furnishing: 5,
    sharing: 5
};

const ALL_FACILITIES = [
    "Wi-Fi",
    "Washing machine",
    "Attached bathroom"
];

function numberOrNull(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function positiveNumberOrNull(value) {
    const n = numberOrNull(value);
    return n !== null && n > 0 ? n : null;
}

function nonNegativeNumberOrNull(value) {
    const n = numberOrNull(value);
    return n !== null && n >= 0 ? n : null;
}

function validCoordinates(lat, lng) {
    const a = numberOrNull(lat);
    const b = numberOrNull(lng);

    if (a === null || b === null) return false;
    if (a < -90 || a > 90 || b < -180 || b > 180) {
        return false;
    }

    // Reject placeholder coordinates.
    if (a === 0 && b === 0) return false;

    return true;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
    if (
        !validCoordinates(lat1, lng1) ||
        !validCoordinates(lat2, lng2)
    ) {
        return null;
    }

    const toRad = deg => deg * Math.PI / 180;
    const earthRadiusKm = 6371;

    const dLat = toRad(Number(lat2) - Number(lat1));
    const dLng = toRad(Number(lng2) - Number(lng1));

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(Number(lat1))) *
        Math.cos(toRad(Number(lat2))) *
        Math.sin(dLng / 2) ** 2;

    return earthRadiusKm *
        2 *
        Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// This is an estimate, not an actual route or live-traffic calculation.
function estimateTravelTimeMin(distanceKm) {
    const km = positiveNumberOrNull(distanceKm);

    if (km === null && Number(distanceKm) !== 0) {
        return null;
    }

    return Math.max(
        5,
        Math.round((Number(distanceKm) / 18) * 60 + 4)
    );
}

function getDistanceAndTime(property, req) {
    const propertyLat = property.latitude ?? property.lat;
    const propertyLng = property.longitude ?? property.lng;

    if (
        validCoordinates(req.locationLat, req.locationLng) &&
        validCoordinates(propertyLat, propertyLng)
    ) {
        const km = haversineDistanceKm(
            req.locationLat,
            req.locationLng,
            propertyLat,
            propertyLng
        );

        if (km !== null) {
            return {
                distanceKm: Math.round(km * 10) / 10,
                travelTimeMin: estimateTravelTimeMin(km),
                distanceMethod: "straight-line",
                travelTimeMethod: "estimated",
                exact: true
            };
        }
    }

    const storedDistance =
        nonNegativeNumberOrNull(property.distanceKm);

    const storedTime =
        positiveNumberOrNull(property.travelTimeMin);

    return {
        distanceKm: storedDistance,
        travelTimeMin: storedTime,
        distanceMethod:
            storedDistance !== null ? "stored-estimate" : null,
        travelTimeMethod:
            storedTime !== null ? "stored-estimate" : null,
        exact: false
    };
}

function addBreakdown(
    breakdown,
    label,
    status,
    text,
    points,
    weight
) {
    breakdown.push({
        label,
        status,
        text,
        points:
            points === null
                ? null
                : Math.round(points * 100) / 100,
        weight
    });
}

function computeMatch(property, req) {
    const breakdown = [];

    let earnedPoints = 0;
    let availableWeight = 0;
    let requestedWeight = 0;

    const addCriterion = (
        key,
        label,
        actual,
        limit,
        scorer,
        explanation
    ) => {
        const weight = WEIGHTS[key];

        requestedWeight += weight;

        if (
            actual === null ||
            actual === undefined ||
            limit === null ||
            limit === undefined ||
            (typeof actual === "number" &&
                !Number.isFinite(actual)) ||
            (typeof limit === "number" &&
                !Number.isFinite(limit))
        ) {
            addBreakdown(
                breakdown,
                label,
                "unknown",
                explanation ||
                    "Not enough verified information to evaluate.",
                null,
                weight
            );

            return;
        }

        const result = scorer(actual, limit, weight);

        availableWeight += weight;
        earnedPoints += result.points;

        addBreakdown(
            breakdown,
            label,
            result.status,
            result.text || explanation,
            result.points,
            weight
        );
    };

    // 1. Budget
    const rent = positiveNumberOrNull(property.rent);
    const budget = positiveNumberOrNull(req.budget);

    addCriterion(
        "budget",
        "Budget",
        rent,
        budget,
        (actual, limit, weight) => {
            const overRatio = Math.max(
                0,
                (actual - limit) / limit
            );

    const points =
    actual <= limit
        ? weight
        : overRatio <= 0.15
            ? weight * 0.6
            : 0;

            return {
                points,
                status:
                    actual <= limit
                        ? "pass"
                        : points > 0
                            ? "partial"
                            : "fail",
                text:
                    `₹${actual.toLocaleString("en-IN")} ` +
                    `vs your ₹${limit.toLocaleString("en-IN")} budget`
            };
        }
    );

    const location = getDistanceAndTime(property, req);

    // 2. Distance
    addCriterion(
        "distance",
        "Distance",
        nonNegativeNumberOrNull(location.distanceKm),
        positiveNumberOrNull(req.maxDistance),
        (actual, limit, weight) => {
            const over = actual - limit;

            const points =
                actual <= limit
                    ? weight
                    : over <= 1
                        ? weight * 0.6
                        : Math.max(
                            0,
                            weight * (
                                1 - (over - 1) / Math.max(limit, 1)
                            )
                        );

            return {
                points,
                status:
                    actual <= limit
                        ? "pass"
                        : points > 0
                            ? "partial"
                            : "fail",
                text:
                    `${actual.toFixed(1)} km vs your ${limit} km limit ` +
                    `(${location.distanceMethod === "straight-line"
                        ? "straight-line distance"
                        : "stored distance"})`
            };
        }
    );

    // 3. Travel time
    addCriterion(
        "travelTime",
        "Travel time",
        positiveNumberOrNull(location.travelTimeMin),
        positiveNumberOrNull(req.maxTravelTime),
        (actual, limit, weight) => {
            const over = actual - limit;

            const points =
                actual <= limit
                    ? weight
                    : over <= 5
                        ? weight * 0.6
                        : Math.max(
                            0,
                            weight * (
                                1 - (over - 5) / Math.max(limit, 1)
                            )
                        );

            return {
                points,
                status:
                    actual <= limit
                        ? "pass"
                        : points > 0
                            ? "partial"
                            : "fail",
                text:
                    `${actual} min vs your ${limit} min limit ` +
                    "(estimated; not live traffic)"
            };
        }
    );

    // 4. Deposit
    const deposit =
        nonNegativeNumberOrNull(property.deposit);

    const maxDeposit =
        positiveNumberOrNull(req.maxDeposit);

    addCriterion(
        "deposit",
        "Deposit",
        deposit,
        maxDeposit,
        (actual, limit, weight) => {
            const overRatio = Math.max(
                0,
                (actual - limit) / limit
            );

            const points =
                actual <= limit
                    ? weight
                    : overRatio <= 0.15
                        ? weight * 0.6
                        : Math.max(
                            0,
                            weight * (1 - overRatio)
                        );

            return {
                points,
                status:
                    actual <= limit
                        ? "pass"
                        : points > 0
                            ? "partial"
                            : "fail",
                text:
                    `₹${actual.toLocaleString("en-IN")} vs your ` +
                    `₹${limit.toLocaleString("en-IN")} deposit limit`
            };
        }
    );

    // 5. Facilities
    // Score only when the user selected facilities
    // and listing amenities are explicitly known.
    const wantedFacilities =
        Array.isArray(req.facilities)
            ? req.facilities
            : [];

    if (wantedFacilities.length > 0) {
        requestedWeight += WEIGHTS.facilities;

        const facilitiesKnown =
            property.facilitiesKnown === true ||
            (
                Array.isArray(property.facilities) &&
                property.facilities.length > 0
            );

        if (!facilitiesKnown) {
            addBreakdown(
                breakdown,
                "Facilities",
                "unknown",
                "Facilities are not confirmed in this listing.",
                null,
                WEIGHTS.facilities
            );
        } else {
            const available =
                Array.isArray(property.facilities)
                    ? property.facilities
                    : [];

            const matched = wantedFacilities.filter(
                item => available.includes(item)
            );

            const points =
                matched.length /
                wantedFacilities.length *
                WEIGHTS.facilities;

            availableWeight += WEIGHTS.facilities;
            earnedPoints += points;

            addBreakdown(
                breakdown,
                "Facilities",
                matched.length === wantedFacilities.length
                    ? "pass"
                    : matched.length > 0
                        ? "partial"
                        : "fail",
                `${matched.length} of ${wantedFacilities.length} ` +
                    "requested facilities confirmed",
                points,
                WEIGHTS.facilities
            );
        }
    }

    // 6. Furnishing
    const furnishing =
        typeof property.furnished === "string"
            ? property.furnished.trim()
            : "";

    const wantedFurnishing =
        typeof req.furnished === "string"
            ? req.furnished.trim()
            : "";

    requestedWeight += WEIGHTS.furnishing;

    if (
        !furnishing ||
        /^unknown$/i.test(furnishing) ||
        !wantedFurnishing
    ) {
        addBreakdown(
            breakdown,
            "Furnishing",
            "unknown",
            "Furnishing is not confirmed in this listing.",
            null,
            WEIGHTS.furnishing
        );
    } else {
        const match =
            furnishing.toLowerCase() ===
            wantedFurnishing.toLowerCase();

        availableWeight += WEIGHTS.furnishing;

        if (match) {
            earnedPoints += WEIGHTS.furnishing;
        }

        addBreakdown(
            breakdown,
            "Furnishing",
            match ? "pass" : "fail",
            `${furnishing} vs preferred ${wantedFurnishing}`,
            match ? WEIGHTS.furnishing : 0,
            WEIGHTS.furnishing
        );
    }

    // 7. Sharing
    // Bedroom count is NOT assumed to mean sharing capacity.
    const sharing =
        positiveNumberOrNull(property.sharing);

    const wantedSharing =
        positiveNumberOrNull(req.sharing);

    requestedWeight += WEIGHTS.sharing;

    if (sharing === null || wantedSharing === null) {
        addBreakdown(
            breakdown,
            "Sharing",
            "unknown",
            "Sharing capacity is not confirmed in this listing.",
            null,
            WEIGHTS.sharing
        );
    } else {
        const diff = Math.abs(sharing - wantedSharing);

        const points =
            diff === 0
                ? WEIGHTS.sharing
                : diff === 1
                    ? WEIGHTS.sharing * 0.4
                    : 0;

        availableWeight += WEIGHTS.sharing;
        earnedPoints += points;

        addBreakdown(
            breakdown,
            "Sharing",
            diff === 0
                ? "pass"
                : diff === 1
                    ? "partial"
                    : "fail",
            `${sharing} sharing vs your preference of ${wantedSharing}`,
            points,
            WEIGHTS.sharing
        );
    }

    // Normalize score using only criteria with verified information.
    const score =
        availableWeight > 0
            ? Math.round(
                (earnedPoints / availableWeight) * 100
            )
            : 0;

    // Confidence shows how much requested information was available.
    const confidence =
        requestedWeight > 0
            ? Math.round(
                (availableWeight / requestedWeight) * 100
            )
            : 0;

    return {
        score: Math.max(0, Math.min(100, score)),
        confidence,
        availableWeight,
        requestedWeight,
        breakdown,
        distanceKm: location.distanceKm,
        travelTimeMin: location.travelTimeMin,
        distanceMethod: location.distanceMethod,
        travelTimeMethod: location.travelTimeMethod,
        exact: location.exact
    };
}

module.exports = {
    WEIGHTS,
    ALL_FACILITIES,
    haversineDistanceKm,
    estimateTravelTimeMin,
    getDistanceAndTime,
    computeMatch
};
