import { describe, expect, it } from "vitest";

import {
  buildEstimate,
  buildRestorationPaths,
  buildVulnerability,
  createInitialFlags,
} from "@/lib/scenario";

describe("scenario derivation", () => {
  it("widens the planning window when low confidence is enabled", () => {
    const flags = createInitialFlags();
    const baseline = buildEstimate(flags);
    const lowConfidence = buildEstimate({ ...flags, lowConfidence: true });

    expect(lowConfidence.p95).not.toEqual(baseline.p95);
    expect(lowConfidence.confidenceScore).toBeLessThan(baseline.confidenceScore);
  });

  it("marks vulnerable handling as urgent when enabled", () => {
    const vulnerability = buildVulnerability({
      ...createInitialFlags(),
      vulnerableHousehold: true,
    });

    expect(vulnerability.level).toBe("urgent");
    expect(vulnerability.needsHumanApproval).toBe(true);
  });

  it("expands the vulnerable restoration path when triggered", () => {
    const paths = buildRestorationPaths({
      ...createInitialFlags(),
      vulnerableHousehold: true,
    });

    const vulnerablePath = paths.find((path) => path.id === "vulnerable");
    expect(vulnerablePath?.customerCount).toBe(18);
  });
});
