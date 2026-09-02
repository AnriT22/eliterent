/**
 * Partner supply for Transfers.
 *
 * There is no partner transfer-fleet API yet, so this module is the seam where
 * one will go. Everything downstream (the matching engine, the route, the UI)
 * consumes `listPartnerVehicles()` and never touches this data directly, so a
 * real integration replaces the body of that function and nothing else changes.
 *
 * IMPORTANT — these are placeholder listings, not real bookable cars. They are
 * returned with `instant: false`, which makes the UI present them as "we'll
 * confirm with our partner" rather than as instantly bookable inventory, and
 * the route never quotes them as a firm price. That is deliberate: promising
 * availability we cannot verify is exactly what the request state exists to
 * avoid.
 *
 * Shape each real partner must eventually supply (see PARTNER_FIELDS) is kept
 * here as the integration contract.
 */

const PARTNER_FIELDS = [
    'brand', 'model', 'year', 'category', 'passengers', 'luggage',
    'available', 'price', 'pickup_zones', 'service_type',
    'chauffeur', 'photos', 'cancellation_policy'
];

// Placeholder supply. `partner` is intentionally never surfaced to the
// customer — the UX rule is that the platform is the single booking surface
// and the partner is an invisible source behind it.
const PARTNER_VEHICLES = [
    {
        id: 'p-vclass', partner: 'partner-a',
        brand: 'Mercedes-Benz', model: 'V-Class', year: 2022,
        category: 'van', label: 'Luxury Van',
        passengers: 7, luggage: 6,
        price: 145, chauffeur: true,
        zones: ['tbs', 'tbilisi', 'mtskheta', 'gudauri', 'kazbegi'],
        image: '/images/s-class.webp'
    },
    {
        id: 'p-sprinter', partner: 'partner-a',
        brand: 'Mercedes-Benz', model: 'Sprinter', year: 2021,
        category: 'van', label: 'Group Minibus',
        passengers: 16, luggage: 14,
        price: 210, chauffeur: true,
        zones: ['tbs', 'kut', 'bus', 'tbilisi', 'batumi', 'kutaisi'],
        image: '/images/s-class.webp'
    },
    {
        id: 'p-maybach', partner: 'partner-b',
        brand: 'Mercedes-Benz', model: 'Maybach S-Class', year: 2023,
        category: 'sedan', label: 'Premium Luxury Sedan',
        passengers: 3, luggage: 2,
        price: 185, chauffeur: true,
        zones: ['tbs', 'tbilisi', 'mtskheta'],
        image: '/images/s-class.webp'
    },
    {
        id: 'p-7series', partner: 'partner-b',
        brand: 'BMW', model: '7 Series', year: 2022,
        category: 'sedan', label: 'Executive Sedan',
        passengers: 3, luggage: 2,
        price: 145, chauffeur: true,
        zones: ['tbs', 'tbilisi', 'batumi', 'bus'],
        image: '/images/s-class.webp'
    },
    {
        id: 'p-a8', partner: 'partner-c',
        brand: 'Audi', model: 'A8', year: 2021,
        category: 'sedan', label: 'Executive Sedan',
        passengers: 3, luggage: 3,
        price: 140, chauffeur: true,
        zones: ['tbs', 'tbilisi'],
        image: '/images/s-class.webp'
    },
    {
        id: 'p-lc300', partner: 'partner-c',
        brand: 'Toyota', model: 'Land Cruiser 300', year: 2023,
        category: 'suv', label: 'Premium 4x4',
        passengers: 5, luggage: 4,
        price: 190, chauffeur: true,
        zones: ['tbs', 'tbilisi', 'gudauri', 'kazbegi', 'mestia', 'bakuriani'],
        image: '/images/svaneti.jpg'
    }
];

/**
 * Partner vehicles that could serve a journey.
 * Filters on the criteria a partner feed will realistically expose:
 * capacity and pickup zone. Availability is never asserted — see `instant`.
 */
function listPartnerVehicles(criteria) {
    criteria = criteria || {};
    var pax = parseInt(criteria.passengers, 10) || 1;
    var zone = criteria.pickup_code;

    return PARTNER_VEHICLES
        .filter(function (v) {
            // Seats gate the list; luggage is advisory (see fits() in the route).
            if (v.passengers < pax) return false;
            if (zone && v.zones.indexOf(zone) === -1) return false;
            return true;
        })
        .map(function (v) {
            return {
                id: v.id,
                source: 'partner',
                brand: v.brand,
                model: v.model,
                year: v.year,
                category: v.category,
                label: v.label,
                passengers: v.passengers,
                luggage: v.luggage,
                price: v.price,
                chauffeur: v.chauffeur,
                image: v.image,
                // Never presented as confirmed stock: the customer sees
                // "available through a trusted partner" and the booking becomes
                // a request rather than an instant confirmation.
                instant: false
            };
        });
}

module.exports = { listPartnerVehicles, PARTNER_FIELDS };
