import { describe, expect, it } from "vitest";

import { buildReplayState } from "@/lib/replay";

describe("replay derivation", () => {
  it("hydrates the canonical replay with initial and refined estimates", () => {
    const replay = buildReplayState("ab_447_rich_demo");

    expect(replay.totalEvents).toBeGreaterThan(20);
    expect(replay.initialEstimate?.p50Minutes).toBe(52);
    expect(replay.refinedEstimate?.p50Minutes).toBe(100);
    expect(replay.refinementDeltaMinutes).toBe(48);
    expect(replay.currentEvent.displayType).toBe("Audit Narrative Published");
  });

  it("keeps refined estimate pending before field assessment", () => {
    const replay = buildReplayState("ab_447_rich_demo", 11);

    expect(replay.initialEstimate?.p50Minutes).toBe(52);
    expect(replay.refinedEstimate).toBeNull();
    expect(replay.currentEvent.displayType).toBe("ETR Calculated");
  });
});
