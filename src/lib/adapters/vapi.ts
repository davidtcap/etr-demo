import type { CallSession, DemoScenarioFlags } from "@/lib/domain";
import { formatUtc } from "@/lib/scenario";

function getMode() {
  return process.env.VAPI_API_KEY ? "live" : "mock";
}

export function getVapiStatus() {
  return {
    name: "Vapi",
    mode: getMode(),
    detail:
      getMode() === "live"
        ? "Webhook-backed voice events are enabled."
        : "Using seeded transcript playback for the demo.",
  } as const;
}

export function buildMockCallSession(
  type: "standard" | "vulnerable",
  flags: DemoScenarioFlags,
): CallSession {
  const planningWindow = `${formatUtc(
    flags.crewArrived ? "2026-04-16T15:52:00Z" : "2026-04-16T15:32:00Z",
  )} to ${formatUtc(flags.partsDelay ? "2026-04-16T16:48:00Z" : "2026-04-16T16:02:00Z")}`;

  if (type === "vulnerable") {
    return {
      status: "active",
      customerType: "vulnerable",
      transcript: [
        {
          speaker: "caller",
          text: "My mother has electric heat and the house is getting dangerously cold.",
        },
        {
          speaker: "assistant",
          text: "Urgent household risk detected. Route to welfare questions and supervisor escalation.",
        },
        {
          speaker: "csr",
          text: `I’m treating this as urgent. Our current restoration planning window is ${planningWindow}, and I need to confirm whether the household is safe right now.`,
        },
      ],
      suggestedReply:
        "Confirm immediate safety, ask welfare questions, and escalate to the supervisor queue before closing the call.",
      afterCallSummary:
        "Vulnerable household call handled with urgent escalation and welfare review.",
    };
  }

  return {
    status: "active",
    customerType: "standard",
    transcript: [
      {
        speaker: "caller",
        text: "We run cold storage. What should we plan around for restoration?",
      },
      {
        speaker: "assistant",
        text: "Share the path-based planning window and commit to the next update.",
      },
      {
        speaker: "csr",
        text: `Our current restoration planning window is ${planningWindow}. Customers on switching paths may restore earlier, and I’ll make sure you receive the next update automatically.`,
      },
    ],
    suggestedReply:
      "Frame the response around P50/P80 rather than a single point estimate.",
    afterCallSummary:
      "Business customer advised on path-based restoration window and next update timing.",
  };
}
