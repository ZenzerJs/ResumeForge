import { geocodeCanadianLocation } from "@/lib/geo/geocoding";
import { parseJobDescription } from "@/lib/jd-parser/parser";
import {
  JobRequirementsSchema,
  ParsedIngestedRequirementsSchema,
  type JobRequirements,
  type ParsedIngestedRequirements,
} from "@/lib/jd-parser/types";

export interface IngestedJobEnrichment {
  lat: number | null;
  lng: number | null;
  cityNorm: string | null;
  parsedRequirements: ParsedIngestedRequirements;
}

export function computeIngestedJobEnrichment(input: {
  description: string;
  location?: string | null;
}): IngestedJobEnrichment {
  const geo = geocodeCanadianLocation(input.location);
  let requirements: JobRequirements;
  try {
    requirements = JobRequirementsSchema.parse(parseJobDescription(input.description || ""));
  } catch {
    requirements = JobRequirementsSchema.parse({
      requiredSkills: [],
      preferredSkills: [],
      domainTerms: [],
    });
  }

  return {
    lat: geo ? geo.lat : null,
    lng: geo ? geo.lng : null,
    cityNorm: geo ? geo.cityKey : null,
    parsedRequirements: ParsedIngestedRequirementsSchema.parse({
      requirements,
      geoRemote: Boolean(geo?.isRemote),
    }),
  };
}
