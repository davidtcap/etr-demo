import { describe, expect, it } from "vitest";

import { POST as resetPost } from "@/app/api/demo/reset/route";
import { POST as replayPost } from "@/app/api/demo/replay/route";
import { POST as outagePost } from "@/app/api/events/outage/route";
import { POST as agentMailPost } from "@/app/api/events/agentmail/route";
import { POST as sandboxPost } from "@/app/api/analysis/sandbox/route";

describe("demo routes", () => {
  it("initializes the outage flow", async () => {
    await resetPost();
    const response = await outagePost(
      new Request("http://localhost/api/events/outage", {
        method: "POST",
        body: JSON.stringify({ action: "initialize" }),
      }),
    );

    const data = await response.json();
    expect(data.flags.outageInitialized).toBe(true);
  });

  it("creates an email thread with a drafted response", async () => {
    await resetPost();
    const response = await agentMailPost(
      new Request("http://localhost/api/events/agentmail", {
        method: "POST",
        body: JSON.stringify({ action: "simulate" }),
      }),
    );
    const data = await response.json();

    expect(data.emailThread.messages).toHaveLength(2);
  });

  it("publishes a sandbox artifact", async () => {
    await resetPost();
    const response = await sandboxPost(
      new Request("http://localhost/api/analysis/sandbox", {
        method: "POST",
        body: JSON.stringify({ action: "launch" }),
      }),
    );
    const data = await response.json();

    expect(data.artifact).not.toBeNull();
    expect(data.sandboxJobs[0].status).toBe("completed");
  });

  it("updates the active scenario while keeping the workspace on the latest state", async () => {
    await resetPost();
    const response = await replayPost(
      new Request("http://localhost/api/demo/replay", {
        method: "POST",
        body: JSON.stringify({
          scenarioId: "ab_447_parts_delay",
          replayIndex: 11,
        }),
      }),
    );
    const data = await response.json();

    expect(data.replay.scenarioId).toBe("ab_447_parts_delay");
    expect(data.replay.replayIndex).toBe(data.replay.totalEvents - 1);
    expect(data.replay.currentEvent.displayType).toBe("Audit Narrative Published");
  });
});
