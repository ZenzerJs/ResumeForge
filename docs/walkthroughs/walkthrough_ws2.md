# Phase 3: WS2 Walkthrough — Discover Filters, Geocoding, Radius & Blended Sorting

## Deliverable Summary
- **WS2.1 (Canadian City Geocoding & Distance Calculation)**:
  - Created `src/lib/geo/geocoding.ts` with coordinate dictionary for 10 major Canadian tech hubs (Toronto, Vancouver, Montreal, Ottawa, Calgary, Waterloo/Kitchener, Edmonton, Victoria, Halifax, Quebec City).
  - Implemented `haversineDistanceKm` and `isWithinRadiusKm` for radius bounding (25km, 50km, 100km, 250km).
- **WS2.2 (Blended Match Scoring Engine)**:
  - Created `calculateBlendedScore` combining:
    - ATS Qualification Match (55% weight)
    - Posting Recency Decay (20% weight: <24h = 100, <3d = 85, <7d = 65, <14d = 45, <30d = 25)
    - Location Affinity & Remote Match (15% weight)
    - Salary Transparency & Threshold Match (10% weight)
- **WS2.3 (API Endpoint Filtering & Sorting)**:
  - Upgraded `GET /api/connectors/jobs` supporting `city`, `radiusKm`, `minSalary`, `minScore`, and `sort` (`blended`, `newest`, `ats`, `salary`).
  - Added in-memory geo-radius calculation and score breakdown calculation for candidate listings.
- **WS2.4 (Discover Feed UI Toolbar & Card Badges)**:
  - Upgraded `src/components/tracker/discover-feed.tsx` with:
    - Canadian City selector & dynamic Distance Radius selector
    - Minimum Salary filter dropdown
    - Sort Order selector (`Blended Match`, `Newest First`, `Highest ATS Match`, `Salary: High to Low`)
    - Color-coded `% Match` badge pill with breakdown tooltip on every job card.

---

## File Changes

| File | Type | Description |
|---|---|---|
| `src/lib/geo/geocoding.ts` | NEW | Canadian tech hub coordinates, Haversine formula, and radius calculator |
| `src/lib/scoring/blended-sort.ts` | NEW | Multi-factor blended score engine (ATS + Recency + Location + Salary) |
| `src/app/api/connectors/jobs/route.ts` | MODIFY | Added city, radiusKm, minSalary, minScore, and sort query parameter handling |
| `src/components/tracker/discover-feed.tsx` | MODIFY | Added city, radius, salary, and sort UI controls + blended score badges |
| `tests/geocoding-radius.test.ts` | NEW | Unit tests verifying Haversine calculations and Canadian tech hub lookup |
| `tests/blended-scoring.test.ts` | NEW | Unit tests verifying recency decay, salary thresholds, and score composition |
| `e2e/ws2-discover-filters.spec.ts` | NEW | Playwright E2E spec verifying interactive filter UI controls |

---

## Verification Results

| Quality Gate | Command | Result |
|---|---|---|
| **ESLint** | `npm run lint` | **PASS** (0 warnings, 0 errors) |
| **TypeScript** | `npm run typecheck` | **PASS** (Clean `tsc --noEmit`) |
| **Vitest Unit Tests** | `npm run test` | **PASS** (70 test files, 347/347 tests passed) |
| **Next.js Production Build** | `npm run build` | **PASS** (46 static/dynamic routes compiled) |
| **Playwright E2E Tests** | `npx playwright test` | **PASS** (76/76 tests passed across 18 spec files) |
