import { describe, it, expect } from "vitest";
import {
  buildEvidenceRepairManifest,
  renderRepairManifestMarkdown,
  verifyRepairManifestIntegrity,
  type EvidenceItemSnapshot,
} from "@/lib/evidence/repair-audit";

describe("Evidence Bank dry-run repair audit", () => {
  it("detects ligature/hyphen splits, duplicate skill org, fragmented tags, and flags unrecoverable 200-char truncations", () => {
    const truncated200 =
      "DCIM (Sunbird dcTrack, NetBox), Kubernetes, Terraform, Prometheus, Grafana, OpenTelemetry, PostgreSQL, Redis, Kafka, gRPC, Docker, Linux, Ansible, GitHub Actions, AWS, GCP, Azure, (Sunbird dcTrack1234";
    expect(truncated200.length).toBe(200);

    const items: EvidenceItemSnapshot[] = [
      {
        id: "ev-clean",
        userId: "u-1",
        type: "experience",
        title: "Software Engineer",
        organization: "Acme",
        verifiedSummary: "Built reliable APIs in Go and TypeScript.",
        tags: ["Go", "TypeScript"],
        status: "verified",
        updatedAt: "2026-11-01T00:00:00.000Z",
        citationCount: 2,
        bullets: [{ id: "b-clean", text: "Cut p99 latency by 40%.", technologies: ["Go"], verified: true }],
      },
      {
        id: "ev-auto",
        userId: "u-1",
        type: "skill",
        title: "Technical Skills — Testing",
        organization: "Testing",
        verifiedSummary: "Built airgap verifi cation with mobile- first design and tool calling.",
        tags: ["tool", "calling", "Playwright"],
        status: "verified",
        updatedAt: "2026-11-01T00:00:00.000Z",
        citationCount: 1,
        bullets: [
          {
            id: "b-auto",
            text: "Automated airgap verifi cation workflows with mobile- first design.",
            technologies: [],
            verified: true,
          },
        ],
      },
      {
        id: "ev-manual",
        userId: "u-1",
        type: "skill",
        title: "Technical Skills — Infrastructure",
        organization: "Infrastructure",
        verifiedSummary: truncated200,
        tags: ["(Sunbird dcTrack"],
        status: "verified",
        updatedAt: "2026-11-01T00:00:00.000Z",
        citationCount: 0,
        bullets: [{ id: "b-manual", text: "(Sunbird dcTrack", technologies: [], verified: true }],
      },
    ];

    const manifest = buildEvidenceRepairManifest(items);
    expect(manifest.scannedCount).toBe(3);
    expect(manifest.affectedCount).toBe(2);
    expect(manifest.autoRepairCount).toBe(1);
    expect(manifest.manualReviewCount).toBe(1);
    expect(verifyRepairManifestIntegrity(manifest)).toBe(true);

    const autoItem = manifest.candidates.find((c) => c.itemId === "ev-auto");
    expect(autoItem?.repairAction).toBe("UPDATE_TEXT");
    expect(autoItem?.proposedAfter.organization).toBeNull();
    expect(autoItem?.proposedAfter.verifiedSummary).toBe(
      "Built airgap verification with mobile-first design and tool calling."
    );
    expect(autoItem?.proposedAfter.bullets[0].text).toBe(
      "Automated airgap verification workflows with mobile-first design."
    );
    expect(autoItem?.proposedAfter.tags).toContain("tool calling");
    expect(autoItem?.proposedAfter.tags).not.toContain("tool");

    const manualItem = manifest.candidates.find((c) => c.itemId === "ev-manual");
    expect(manualItem?.repairAction).toBe("FLAG_FOR_MANUAL_REVIEW");

    // Tampering with manifest fails SHA-256 verification
    const tampered = structuredClone(manifest);
    tampered.candidates[0].proposedAfter.title = "Tampered";
    expect(verifyRepairManifestIntegrity(tampered)).toBe(false);

    const reportMd = renderRepairManifestMarkdown(manifest);
    expect(reportMd).toContain("zero row deletes");
    expect(reportMd).toContain("ev-auto");
    expect(reportMd).toContain("ev-manual");
  });
});
