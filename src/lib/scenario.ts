import type {
  AgentNarratives,
  CallSession,
  CrewBrief,
  CustomerProfile,
  DemoScenarioFlags,
  Driver,
  EtrEstimate,
  Outage,
  RestorationPath,
  SandboxArtifact,
  UtilityContext,
  VulnerabilityAssessment,
} from "@/lib/domain";

export const BASE_TIME = "2026-04-16T14:32:00Z";

export function createInitialFlags(): DemoScenarioFlags {
  return {
    outageInitialized: false,
    crewArrived: false,
    lowConfidence: false,
    vulnerableHousehold: false,
    partsDelay: false,
  };
}

export function buildOutage(flags: DemoScenarioFlags): Outage {
  const status = !flags.outageInitialized
    ? "monitoring"
    : flags.crewArrived
      ? "field-assessment"
      : "dispatched";

  return {
    id: "OUT-2026-0416-17",
    createdAt: BASE_TIME,
    feeder: "Feeder 12B",
    equipmentType: "Distribution transformer",
    location: "Westmore Ave and Union Yard",
    affectedCustomers: 428,
    status,
  };
}

export function buildRestorationPaths(
  flags: DemoScenarioFlags,
): RestorationPath[] {
  return [
    {
      id: "switching",
      label: "Upstream switching path",
      customerCount: 214,
      status: flags.outageInitialized ? "tracking" : "watch",
      summary:
        "Customers likely restorable after upstream switching and relay validation.",
    },
    {
      id: "replacement",
      label: "Transformer replacement path",
      customerCount: 148,
      status: flags.crewArrived ? "staged" : "tracking",
      summary:
        "Customers tied to direct transformer replacement and downstream inspection.",
    },
    {
      id: "uncertain",
      label: "High-uncertainty edge cases",
      customerCount: flags.lowConfidence ? 44 : 28,
      status: "watch",
      summary:
        "Customers exposed to travel, parts, and field-condition uncertainty.",
    },
    {
      id: "vulnerable",
      label: "Vulnerable household handling",
      customerCount: flags.vulnerableHousehold ? 18 : 6,
      status: flags.vulnerableHousehold ? "tracking" : "watch",
      summary:
        "Households requiring policy-aware welfare checks and supervisor review.",
    },
  ];
}

export function buildEstimate(flags: DemoScenarioFlags): EtrEstimate {
  const p50 = flags.crewArrived
    ? "2026-04-16T15:52:00Z"
    : "2026-04-16T15:32:00Z";
  const p80 = flags.partsDelay
    ? "2026-04-16T16:48:00Z"
    : flags.crewArrived
      ? "2026-04-16T16:22:00Z"
      : "2026-04-16T16:02:00Z";
  const p95 = flags.partsDelay
    ? "2026-04-16T17:34:00Z"
    : flags.lowConfidence
      ? "2026-04-16T17:06:00Z"
      : "2026-04-16T16:44:00Z";

  const confidenceScore = flags.lowConfidence
    ? 0.54
    : flags.crewArrived
      ? 0.74
      : 0.68;

  return {
    p50,
    p80,
    p95,
    confidenceScore,
    confidenceLabel:
      confidenceScore >= 0.72
        ? "High confidence"
        : confidenceScore >= 0.6
          ? "Guarded confidence"
          : "Low confidence",
    auditId: flags.crewArrived ? "AUD-98414" : "AUD-98391",
  };
}

export function buildDrivers(flags: DemoScenarioFlags): Driver[] {
  const drivers: Driver[] = [
    {
      label: "Feeder topology",
      impact: "positive",
      detail:
        "Half of affected customers can likely be restored by switching without full transformer replacement.",
    },
    {
      label: "AMI last-gasp pattern",
      impact: "watch",
      detail:
        "Signal drop confirms a concentrated transformer event with a smaller downstream uncertainty band.",
    },
    {
      label: "Crew travel and dispatch",
      impact: flags.crewArrived ? "positive" : "watch",
      detail: flags.crewArrived
        ? "Crew is on site and field inspection is now constraining the confidence band."
        : "Crew has been dispatched with a 14-minute travel estimate.",
    },
    {
      label: "Parts availability",
      impact: flags.partsDelay ? "negative" : "watch",
      detail: flags.partsDelay
        ? "Replacement transformer staging is uncertain and expands the upper planning window."
        : "Replacement stock is available in the nearby service yard.",
    },
  ];

  if (flags.lowConfidence) {
    drivers.push({
      label: "Weather and traffic volatility",
      impact: "negative",
      detail:
        "Localized congestion and weather uncertainty widened the high-percentile restoration window.",
    });
  }

  return drivers;
}

export function buildCustomerProfile(
  flags: DemoScenarioFlags,
): CustomerProfile {
  return {
    accountName: flags.vulnerableHousehold
      ? "Garcia household"
      : "Union Market cold storage",
    segment: flags.vulnerableHousehold ? "residential" : "business",
    contactChannel: flags.vulnerableHousehold ? "voice" : "email",
    vulnerable: flags.vulnerableHousehold,
    notes: flags.vulnerableHousehold
      ? [
          "Electric heat dependency recorded in CRM.",
          "Two young children at property.",
          "Supervisor escalation required for welfare routing.",
        ]
      : [
          "Business customer with refrigeration exposure.",
          "Requested next-update commitment in outbound response.",
        ],
  };
}

export function buildVulnerability(
  flags: DemoScenarioFlags,
): VulnerabilityAssessment {
  if (!flags.vulnerableHousehold) {
    return {
      level: "normal",
      reason:
        "No vulnerable household trigger is active for the current scenario.",
      welfareActions: [
        "Continue standard restoration communications.",
        "Offer next update commitment if the customer requests it.",
      ],
      needsHumanApproval: false,
    };
  }

  return {
    level: "urgent",
    reason:
      "Electric heat dependency combined with cold exposure requires a welfare escalation review.",
    welfareActions: [
      "Confirm household safety and alternative accommodation status.",
      "Escalate to welfare queue and supervisor.",
      "Hold AI response draft for human approval before send.",
    ],
    needsHumanApproval: true,
  };
}

export function buildCrewBrief(flags: DemoScenarioFlags): CrewBrief {
  return {
    summary: flags.crewArrived
      ? "Crew is on site with strong evidence of transformer damage and moderate risk of grounding follow-up work."
      : "Dispatch package prepared with feeder history, access instructions, and likely replacement steps.",
    topIncidents: [
      "June 2025: grounding corrosion added 31 minutes to restoration.",
      "January 2025: loading dock access shortened arrival-to-isolation by 12 minutes.",
      "October 2024: cable routing required extra inspection before re-energisation.",
    ],
    likelyDelays: flags.partsDelay
      ? [
          "Replacement transformer staging may slip by 20-30 minutes.",
          "Traffic on the service-yard route remains elevated.",
        ]
      : [
          "Downstream inspection after replacement remains the main tail-risk.",
          "Supervisor approval needed before restoring vulnerable households if welfare action is active.",
        ],
    firstActions: [
      "Verify switching isolation and relay status.",
      "Inspect transformer casing, grounding, and drain bed.",
      "Confirm parts staging and cabinet access path.",
      "Review prior site-access note before energisation.",
      "Report field findings back to the control room for ETR update.",
    ],
  };
}

export function buildUtilityContext(flags: DemoScenarioFlags): UtilityContext {
  return {
    sources: [
      {
        name: "OMS",
        status: flags.outageInitialized ? "active" : "ready",
        summary: "Outage record and lifecycle state remain authoritative locally.",
      },
      {
        name: "GIS",
        status: "active",
        summary: "Feeder topology and downstream path segmentation loaded.",
      },
      {
        name: "SCADA",
        status: "active",
        summary: "Fault and load signals confirm a concentrated transformer failure.",
      },
      {
        name: "AMI",
        status: "active",
        summary: "Last-gasp pattern supports restoration-path segmentation.",
      },
      {
        name: "WFM",
        status: flags.crewArrived ? "active" : "tracking",
        summary: flags.crewArrived
          ? "Crew arrival event received from field operations."
          : "Crew travel ETA is being tracked.",
      },
    ],
  };
}

export function buildFallbackNarratives(
  estimate: EtrEstimate,
  flags: DemoScenarioFlags,
): AgentNarratives {
  const confidenceWindow = `${formatUtc(estimate.p50)} to ${formatUtc(
    estimate.p80,
  )}`;

  return {
    controlRoom: `The local ETR core split the outage into switching, replacement, and high-uncertainty paths. The current safe planning window is ${confidenceWindow}, with ${estimate.confidenceLabel.toLowerCase()} because ${flags.partsDelay ? "parts staging remains uncertain" : "field inspection is still narrowing the upper band"}.`,
    customerSafe: `We are responding to an outage affecting your area. Our latest restoration planning window is ${confidenceWindow}, and customers on faster switching paths may restore earlier than customers waiting on equipment replacement.`,
    csrGuidance: flags.vulnerableHousehold
      ? "Treat this call as urgent. Confirm household safety, explain that restoration timing is still path-based, and escalate to the welfare queue before closing the interaction."
      : "Explain that the outage is segmented into restoration paths, share the planning window, and commit to the next proactive update.",
    managerNote: flags.lowConfidence
      ? "Confidence widened after operational uncertainty increased. Keep the P80/P95 framing visible and launch explainability support."
      : "Confidence remains within the expected band for a transformer event; continue monitoring for tail-risk movement.",
    crewSummary: flags.crewArrived
      ? "Crew arrival is confirmed. Prioritize grounding inspection, confirm replacement feasibility, and feed findings back for the next ETR refresh."
      : "Crew dispatch is underway. Stage replacement parts and review historical site notes before arrival.",
    emailDraft: flags.vulnerableHousehold
      ? `We are treating this outage as urgent because of the household risk factors on file. Our latest planning window is ${confidenceWindow}. A human team member is reviewing the next steps with priority.`
      : `We are currently responding to an outage affecting your area. The latest restoration planning window is ${confidenceWindow}. We will continue sending updates if field conditions change.`,
  };
}

export function buildInitialCallSession(): CallSession {
  return {
    status: "idle",
    customerType: null,
    transcript: [],
    suggestedReply: "No active call session.",
    afterCallSummary: "No call has been simulated.",
  };
}

export function buildArtifact(flags: DemoScenarioFlags): SandboxArtifact {
  return {
    id: flags.lowConfidence ? "ART-LOWCONF" : "ART-BASE",
    title: flags.lowConfidence
      ? "Confidence Delta Analysis"
      : "Historical Transformer Backtest",
    createdAt: new Date().toISOString(),
    format: "chart",
    summary: flags.lowConfidence
      ? "Machine learning environment run compared similar incidents and showed that travel and parts uncertainty drove the widened P80 movement."
      : "Machine learning environment run ranked similar transformer incidents and generated a backtest against actual repair durations.",
    highlights: flags.lowConfidence
      ? [
          "Travel and weather variables explain most of the P80 shift.",
          "Historical analogs suggest replacement path is still the dominant tail risk.",
          "Explainability artifact is suitable for supervisor review.",
        ]
      : [
          "Model backtest remains within expected error on the switching path.",
          "Replacement path remains the largest source of residual variance.",
          "Crew brief has been enriched with top historical incidents.",
        ],
    values: [
      { label: "Switching path", actual: 48, predicted: 44 },
      { label: "Replacement path", actual: 87, predicted: 92 },
      { label: "High-uncertainty path", actual: 111, predicted: 118 },
    ],
  };
}

export function formatUtc(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(new Date(value));
}
