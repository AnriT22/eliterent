/**
 * Curated pick-up / drop-off points for Transfers.
 *
 * Deliberately a fixed list rather than a maps autocomplete: it needs no API
 * key, no billing and no third-party request on page load, and for a Georgian
 * transfer service the useful set of endpoints is small and stable — three
 * airports, the cities people fly into, and the mountain/wine destinations
 * they actually get driven to.
 *
 * Coordinates are real, so distance and duration estimates are honest rather
 * than invented. `detour` scales great-circle distance up to real road
 * distance: Georgian mountain roads wind a lot, so a straight line badly
 * understates the drive. `speed` is a realistic average including stops.
 *
 * To move to Google Places later, keep this list as the quick-pick set and
 * treat free-text as an additional option — the API contract below
 * (code/label/lat/lng) is what the matching engine consumes.
 */

const LOCATIONS = [
    // --- Airports -----------------------------------------------------------
    { code: 'tbs', label: 'Tbilisi International Airport (TBS)', group: 'Airports', lat: 41.6692, lng: 44.9547 },
    { code: 'kut', label: 'Kutaisi International Airport (KUT)', group: 'Airports', lat: 42.1767, lng: 42.4826 },
    { code: 'bus', label: 'Batumi International Airport (BUS)', group: 'Airports', lat: 41.6103, lng: 41.5997 },

    // --- Cities -------------------------------------------------------------
    { code: 'tbilisi', label: 'Tbilisi city centre', group: 'Cities', lat: 41.6938, lng: 44.8015 },
    { code: 'batumi', label: 'Batumi city centre', group: 'Cities', lat: 41.6459, lng: 41.6417 },
    { code: 'kutaisi', label: 'Kutaisi city centre', group: 'Cities', lat: 42.2679, lng: 42.6946 },
    { code: 'rustavi', label: 'Rustavi', group: 'Cities', lat: 41.5495, lng: 45.0000 },
    { code: 'telavi', label: 'Telavi', group: 'Cities', lat: 41.9197, lng: 45.4731 },
    { code: 'zugdidi', label: 'Zugdidi', group: 'Cities', lat: 42.5088, lng: 41.8709 },

    // --- Destinations -------------------------------------------------------
    { code: 'gudauri', label: 'Gudauri ski resort', group: 'Destinations', lat: 42.4769, lng: 44.4783 },
    { code: 'kazbegi', label: 'Kazbegi / Stepantsminda', group: 'Destinations', lat: 42.6570, lng: 44.6415 },
    { code: 'bakuriani', label: 'Bakuriani ski resort', group: 'Destinations', lat: 41.7497, lng: 43.5325 },
    { code: 'borjomi', label: 'Borjomi', group: 'Destinations', lat: 41.8392, lng: 43.3906 },
    { code: 'mestia', label: 'Mestia (Svaneti)', group: 'Destinations', lat: 43.0450, lng: 42.7280 },
    { code: 'sighnaghi', label: 'Sighnaghi (Kakheti)', group: 'Destinations', lat: 41.6197, lng: 45.9214 },
    { code: 'mtskheta', label: 'Mtskheta', group: 'Destinations', lat: 41.8458, lng: 44.7194 },
    { code: 'kvareli', label: 'Kvareli (Kakheti)', group: 'Destinations', lat: 41.9506, lng: 45.8156 },
    { code: 'gori', label: 'Gori', group: 'Destinations', lat: 41.9847, lng: 44.1086 },
    { code: 'kobuleti', label: 'Kobuleti', group: 'Destinations', lat: 41.8206, lng: 41.7789 }
];

const BY_CODE = LOCATIONS.reduce(function (acc, l) { acc[l.code] = l; return acc; }, {});

// Great-circle distance in km.
function haversineKm(a, b) {
    var R = 6371;
    var toRad = function (d) { return d * Math.PI / 180; };
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
}

// Mountain routes (Gudauri, Kazbegi, Mestia, Bakuriani) are far longer and
// slower than the straight line suggests, so they carry a bigger detour factor
// and a lower average speed. These are estimates and the UI labels them as such.
const MOUNTAIN = ['gudauri', 'kazbegi', 'mestia', 'bakuriani', 'borjomi'];

/**
 * True when either end of the journey is a mountain destination.
 *
 * These are the routes where the vehicle genuinely matters: the Georgian
 * Military Highway to Gudauri and Kazbegi, and the road to Mestia, are
 * snow-bound for months and steep year-round. A sedan can physically do them
 * in summer, but an SUV/4x4 is the right answer — so the matching engine
 * promotes them rather than leaving a guest to work it out.
 */
function isMountainRoute(fromCode, toCode) {
    return MOUNTAIN.indexOf(fromCode) !== -1 || MOUNTAIN.indexOf(toCode) !== -1;
}

/** The label to show when explaining why 4x4s are surfaced first. */
function mountainEndpoint(fromCode, toCode) {
    var code = MOUNTAIN.indexOf(toCode) !== -1 ? toCode
        : (MOUNTAIN.indexOf(fromCode) !== -1 ? fromCode : null);
    return code && BY_CODE[code] ? BY_CODE[code].label : null;
}

function estimateRoute(fromCode, toCode) {
    var a = BY_CODE[fromCode];
    var b = BY_CODE[toCode];
    if (!a || !b || fromCode === toCode) return null;
    var mountain = MOUNTAIN.indexOf(fromCode) !== -1 || MOUNTAIN.indexOf(toCode) !== -1;
    var detour = mountain ? 1.45 : 1.25;
    var speed = mountain ? 45 : 70;
    var km = Math.round(haversineKm(a, b) * detour);
    return { distance_km: km, duration_min: Math.max(15, Math.round(km / speed * 60)) };
}

module.exports = { LOCATIONS, BY_CODE, estimateRoute, isMountainRoute, mountainEndpoint };
