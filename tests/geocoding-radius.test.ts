import { describe, it, expect } from "vitest";
import {
  haversineDistanceKm,
  geocodeCanadianLocation,
  isWithinRadiusKm,
  CANADIAN_TECH_HUBS,
} from "@/lib/geo/geocoding";

describe("WS2.1 — Canadian City Geocoding & Haversine Distance Calculation", () => {
  it("calculates accurate great-circle distances between Canadian hubs", () => {
    // Toronto to Waterloo is approx 90-110 km
    const dTorontoWaterloo = haversineDistanceKm(
      CANADIAN_TECH_HUBS.toronto.lat,
      CANADIAN_TECH_HUBS.toronto.lng,
      CANADIAN_TECH_HUBS.waterloo.lat,
      CANADIAN_TECH_HUBS.waterloo.lng
    );
    expect(dTorontoWaterloo).toBeGreaterThan(80);
    expect(dTorontoWaterloo).toBeLessThan(120);

    // Toronto to Montreal is approx 500 km
    const dTorontoMontreal = haversineDistanceKm(
      CANADIAN_TECH_HUBS.toronto.lat,
      CANADIAN_TECH_HUBS.toronto.lng,
      CANADIAN_TECH_HUBS.montreal.lat,
      CANADIAN_TECH_HUBS.montreal.lng
    );
    expect(dTorontoMontreal).toBeGreaterThan(480);
    expect(dTorontoMontreal).toBeLessThan(540);

    // Vancouver to Victoria is approx 90-110 km across the Strait of Georgia
    const dVanVic = haversineDistanceKm(
      CANADIAN_TECH_HUBS.vancouver.lat,
      CANADIAN_TECH_HUBS.vancouver.lng,
      CANADIAN_TECH_HUBS.victoria.lat,
      CANADIAN_TECH_HUBS.victoria.lng
    );
    expect(dVanVic).toBeGreaterThan(80);
    expect(dVanVic).toBeLessThan(120);
  });

  it("geocodes Canadian tech hubs and sub-region aliases", () => {
    const torontoGta = geocodeCanadianLocation("Markham, ON (GTA)");
    expect(torontoGta?.cityKey).toBe("toronto");
    expect(torontoGta?.cityName).toBe("Toronto");
    expect(torontoGta?.region).toBe("ON");

    const vancouverBurnaby = geocodeCanadianLocation("Burnaby, BC");
    expect(vancouverBurnaby?.cityKey).toBe("vancouver");

    const waterlooKitchener = geocodeCanadianLocation("Kitchener-Waterloo, ON");
    expect(waterlooKitchener?.cityKey).toBe("waterloo");

    const ottawaKanata = geocodeCanadianLocation("Kanata Tech Park, Ottawa, ON");
    expect(ottawaKanata?.cityKey).toBe("ottawa");
  });

  it("detects remote flag within location strings", () => {
    const remoteLocation = geocodeCanadianLocation("Toronto, ON (Remote / Work from home)");
    expect(remoteLocation?.isRemote).toBe(true);
    expect(remoteLocation?.cityKey).toBe("toronto");
  });

  it("evaluates isWithinRadiusKm accurately against target cities", () => {
    const torontoHub = CANADIAN_TECH_HUBS.toronto;
    const waterlooHub = CANADIAN_TECH_HUBS.waterloo;
    const montrealHub = CANADIAN_TECH_HUBS.montreal;

    // Waterloo is within 100km radius of Toronto
    expect(isWithinRadiusKm(waterlooHub.lat, waterlooHub.lng, "toronto", 110)).toBe(true);
    // Waterloo is NOT within 50km radius of Toronto
    expect(isWithinRadiusKm(waterlooHub.lat, waterlooHub.lng, "toronto", 50)).toBe(false);

    // Montreal is NOT within 250km radius of Toronto
    expect(isWithinRadiusKm(montrealHub.lat, montrealHub.lng, "toronto", 250)).toBe(false);
    // Montreal is within 600km of Toronto
    expect(isWithinRadiusKm(montrealHub.lat, montrealHub.lng, "toronto", 600)).toBe(true);

    // "ALL" city filter always returns true
    expect(isWithinRadiusKm(montrealHub.lat, montrealHub.lng, "ALL", 25)).toBe(true);
  });
});
