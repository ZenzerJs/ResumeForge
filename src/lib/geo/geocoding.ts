/**
 * Canadian City Geocoding & Distance Calculation Module
 * Provides coordinates for tech hubs and Haversine distance calculations.
 */

export interface CanadianCityGeo {
  key: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export const CANADIAN_TECH_HUBS: Record<string, CanadianCityGeo> = {
  toronto: {
    key: "toronto",
    name: "Toronto",
    region: "ON",
    lat: 43.6532,
    lng: -79.3832,
    aliases: ["toronto", "gta", "mississauga", "brampton", "markham", "vaughan", "richmond hill", "oakville", "scarborough", "north york"],
  },
  vancouver: {
    key: "vancouver",
    name: "Vancouver",
    region: "BC",
    lat: 49.2827,
    lng: -123.1207,
    aliases: ["vancouver", "burnaby", "richmond", "surrey", "coquitlam", "north vancouver", "metro vancouver"],
  },
  montreal: {
    key: "montreal",
    name: "Montreal",
    region: "QC",
    lat: 45.5017,
    lng: -73.5673,
    aliases: ["montreal", "montréal", "laval", "longueuil", "westmount"],
  },
  ottawa: {
    key: "ottawa",
    name: "Ottawa",
    region: "ON",
    lat: 45.4215,
    lng: -75.6972,
    aliases: ["ottawa", "gatineau", "kanata", "nepean"],
  },
  calgary: {
    key: "calgary",
    name: "Calgary",
    region: "AB",
    lat: 51.0447,
    lng: -114.0719,
    aliases: ["calgary", "airdrie", "cochrane"],
  },
  waterloo: {
    key: "waterloo",
    name: "Waterloo / Kitchener",
    region: "ON",
    lat: 43.4643,
    lng: -80.5204,
    aliases: ["waterloo", "kitchener", "cambridge", "kw", "tri-cities"],
  },
  edmonton: {
    key: "edmonton",
    name: "Edmonton",
    region: "AB",
    lat: 53.5461,
    lng: -113.4938,
    aliases: ["edmonton", "st. albert", "sherwood park"],
  },
  victoria: {
    key: "victoria",
    name: "Victoria",
    region: "BC",
    lat: 48.4284,
    lng: -123.3656,
    aliases: ["victoria", "saanich", "esquimalt"],
  },
  halifax: {
    key: "halifax",
    name: "Halifax",
    region: "NS",
    lat: 44.6488,
    lng: -63.5752,
    aliases: ["halifax", "dartmouth", "bedford"],
  },
  quebec: {
    key: "quebec",
    name: "Quebec City",
    region: "QC",
    lat: 46.8139,
    lng: -71.208,
    aliases: ["quebec city", "québec", "quebec", "lévis"],
  },
};

/**
 * Calculates the great-circle distance between two points in kilometers
 * using the Haversine formula.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Resolves a raw location string to Canadian geographic coordinates.
 */
export function geocodeCanadianLocation(rawLocation?: string | null): {
  cityKey: string;
  cityName: string;
  region: string;
  lat: number;
  lng: number;
  isRemote: boolean;
} | null {
  if (!rawLocation || !rawLocation.trim()) return null;

  const lower = rawLocation.toLowerCase();
  const isRemote =
    lower.includes("remote") ||
    lower.includes("anywhere") ||
    lower.includes("work from home") ||
    lower.includes("virtual");

  for (const [key, hub] of Object.entries(CANADIAN_TECH_HUBS)) {
    if (hub.aliases.some((alias) => lower.includes(alias))) {
      return {
        cityKey: key,
        cityName: hub.name,
        region: hub.region,
        lat: hub.lat,
        lng: hub.lng,
        isRemote,
      };
    }
  }

  return null;
}

/**
 * Determines whether a job coordinate is within a given radius (km) of a target city.
 */
export function isWithinRadiusKm(
  jobLat: number | null | undefined,
  jobLng: number | null | undefined,
  targetCityKey: string,
  radiusKm: number
): boolean {
  if (targetCityKey === "ALL" || targetCityKey === "all" || !targetCityKey) {
    return true;
  }

  const targetHub = CANADIAN_TECH_HUBS[targetCityKey.toLowerCase()];
  if (!targetHub) return true;

  if (jobLat == null || jobLng == null) {
    return false;
  }

  const distance = haversineDistanceKm(targetHub.lat, targetHub.lng, jobLat, jobLng);
  return distance <= radiusKm;
}
