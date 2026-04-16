import type { DemoScenarioFlags, EmailMessage, EmailThread } from "@/lib/domain";

function getMode() {
  return process.env.AGENTMAIL_API_KEY ? "live" : "mock";
}

export function getAgentMailStatus() {
  return {
    name: "AgentMail",
    mode: getMode(),
    detail:
      getMode() === "live"
        ? "Webhook-backed email workflow is enabled."
        : "Using seeded inbox threads and drafts.",
  } as const;
}

export function buildInitialEmailThread(): EmailThread {
  return {
    inbox: "outages@utility.example",
    status: "idle",
    messages: [],
  };
}

export function buildInboundEmail(
  flags: DemoScenarioFlags,
  emailDraft: string,
): EmailThread {
  const inbound: EmailMessage = {
    id: "msg-in-1",
    from: flags.vulnerableHousehold
      ? "family.member@example.com"
      : "ops@unionmarket.example",
    to: "outages@utility.example",
    timestamp: new Date().toISOString(),
    subject: flags.vulnerableHousehold
      ? "Urgent outage update needed"
      : "Need updated restoration timing",
    body: flags.vulnerableHousehold
      ? "This property has electric heat and children in the home. Please advise on timing and next steps."
      : "Please confirm the latest restoration timing and whether we should prepare for a longer outage.",
    direction: "inbound",
    reviewRequired: false,
  };

  const outbound: EmailMessage = {
    id: "msg-out-1",
    from: "outages@utility.example",
    to: inbound.from,
    timestamp: new Date().toISOString(),
    subject: `Re: ${inbound.subject}`,
    body: emailDraft,
    direction: "outbound",
    reviewRequired: flags.vulnerableHousehold,
  };

  return {
    inbox: "outages@utility.example",
    status: "active",
    messages: [inbound, outbound],
  };
}
