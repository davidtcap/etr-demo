import fs from "node:fs";
import path from "node:path";

import type {
  CrewAssignment,
  CrewStatusSnapshot,
  EtrSnapshot,
  OperationalEvent,
  OperationalLogEntry,
  ReplayDetailPair,
  ReplayPathPrediction,
  ReplayScenarioOption,
  ReplayState,
  ScenarioManifest,
} from "@/lib/domain";

type RawEvent = {
  event_id: string;
  event_type: string;
  event_time: string;
  outage_id: string;
  source_system: string;
  actor_type: string;
  actor_id: string;
  payload?: Record<string, unknown>;
  derived_context?: Record<string, unknown>;
  audit?: {
    authoritative?: boolean;
    version?: number;
    tags?: string[];
  };
};

type SandboxSummaryArtifact = {
  top_scenario_deltas: Array<{
    scenario_name: string;
    refinement_delta_minutes: number;
    weather_severity: string;
    parts_in_stock: boolean;
    alternate_feed_available: boolean;
  }>;
  path_risk_summary: Array<{
    path_id: string;
    avg_p50_minutes: number;
    avg_p95_minutes: number;
    avg_confidence_score: number;
    scenario_count: number;
  }>;
  recommended_agent_takeaways: string[];
};

const FIXTURES_DIR = path.join(process.cwd(), "src/lib/replay/fixtures");
const CANONICAL_SCENARIO_ID = "ab_447_rich_demo";

let bundleCache:
  | {
      manifest: ScenarioManifest;
      artifact: SandboxSummaryArtifact;
      scenarios: ReplayScenarioOption[];
      eventsByScenario: Map<string, RawEvent[]>;
    }
  | null = null;

function readJsonFile<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, filename), "utf8")) as T;
}

function formatClock(value: string) {
  return value.slice(11, 16);
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function displayEventType(value: string) {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}

function displayScenarioLabel(value: string) {
  return value
    .replace(/^ab_\d+_/, "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displaySourceSystem(value: string) {
  if (value === "OpenAI") {
    return "Model";
  }

  if (value === "Sandbox") {
    return "Machine Learning Environment";
  }

  return value;
}

function toNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function extractPathPredictions(event: RawEvent): ReplayPathPrediction[] {
  const pathPredictions = Array.isArray(event.derived_context?.path_predictions)
    ? event.derived_context.path_predictions
    : [];

  return pathPredictions.map((item) => {
    const candidate = item as Record<string, unknown>;
    return {
      pathId: toStringValue(candidate.path_id) ?? "Unknown path",
      customers: toNumber(candidate.customers) ?? 0,
      p50Minutes: toNumber(candidate.p50_minutes),
      p80Minutes: toNumber(candidate.p80_minutes),
      p95Minutes: toNumber(candidate.p95_minutes),
      confidenceScore: toNumber(candidate.confidence_score),
      status: toStringValue(candidate.status) ?? "unknown",
      distributionDriver: toStringValue(candidate.distribution_driver),
      stabilizedCustomers: toNumber(candidate.stabilized_customers),
    };
  });
}

function summarizeEvent(event: RawEvent) {
  const payload = event.payload ?? {};

  switch (event.event_type) {
    case "OutageCreated":
      return `${payload.customers_affected ?? "Unknown"} customers interrupted on ${payload.feeder_id ?? "the feeder"}.`;
    case "CrewAssigned":
      return `${payload.crew_name ?? "Crew"} assigned with ${payload.estimated_travel_minutes ?? "unknown"} minute ETA.`;
    case "ETRCalculated":
      return `Initial estimate set at P50 ${payload.p50_minutes ?? "?"} / P80 ${payload.p80_minutes ?? "?"} / P95 ${payload.p95_minutes ?? "?"} minutes.`;
    case "ETRRefined":
      return `Refined estimate moved to P50 ${payload.p50_minutes ?? "?"} / P80 ${payload.p80_minutes ?? "?"} / P95 ${payload.p95_minutes ?? "?"} minutes.`;
    case "CrewStatusUpdate":
      return `Crew status updated to ${payload.status ?? "unknown"}.`;
    case "SiteAssessmentSubmitted":
      return toStringValue(payload.site_notes) ?? "Field assessment submitted from site.";
    case "CustomerCallReceived":
      return `${payload.customer_name ?? "Customer"} called about ${payload.reason ?? "the outage"}.`;
    case "CustomerEmailReceived":
      return `${payload.subject ?? "Customer update request"} received by email.`;
    case "HistoricalIncidentsRanked":
      return "Historical analog incidents and access notes ranked for the dispatched crew.";
    case "SandboxArtifactProduced":
      return "Machine learning environment artifact published for supervisor and control room review.";
    case "AuditNarrativePublished":
      return toStringValue(payload.summary) ?? "Audit narrative published for operators.";
    case "RestorationPathsResolved":
      return "Restoration paths resolved from feeder topology, AMI, and switching context.";
    case "WeatherUpdated":
      return "Weather context refreshed for the active repair window.";
    case "TrafficUpdated":
      return "Traffic delay signal refreshed for crew travel and staging.";
    case "PartsAvailabilityChecked":
      return "Parts inventory and delivery timing checked against the likely repair path.";
    default:
      return `${displayEventType(event.event_type)} received from ${displaySourceSystem(event.source_system)}.`;
  }
}

function eventDetailPairs(
  event: RawEvent,
  historyEvent: RawEvent | undefined,
): ReplayDetailPair[] {
  const payload = event.payload ?? {};

  if (event.event_type === "OutageCreated") {
    return [
      { label: "Outage ID", value: event.outage_id },
      { label: "Cause", value: toStringValue(payload.suspected_cause) ?? "Unknown" },
      { label: "Feeder", value: toStringValue(payload.feeder_id) ?? "Unknown" },
      {
        label: "Customers",
        value: `${toNumber(payload.customers_affected) ?? 0}`,
      },
    ];
  }

  if (event.event_type === "ETRCalculated" || event.event_type === "ETRRefined") {
    return [
      { label: "P50", value: `${toNumber(payload.p50_minutes) ?? 0} minutes` },
      { label: "P80", value: `${toNumber(payload.p80_minutes) ?? 0} minutes` },
      { label: "P95", value: `${toNumber(payload.p95_minutes) ?? 0} minutes` },
      {
        label: "Confidence",
        value: `${Math.round((toNumber(payload.confidence_score) ?? 0) * 100)}%`,
      },
    ];
  }

  if (event.event_type === "CrewAssigned") {
    return [
      { label: "Crew", value: toStringValue(payload.crew_name) ?? "Unknown" },
      { label: "Crew ID", value: toStringValue(payload.crew_id) ?? "Unknown" },
      {
        label: "ETA",
        value: `${toNumber(payload.estimated_travel_minutes) ?? 0} minutes`,
      },
      {
        label: "Skills",
        value: Array.isArray(payload.skills)
          ? (payload.skills as string[]).join(", ")
          : "Unknown",
      },
    ];
  }

  if (event.event_type === "CrewStatusUpdate") {
    return [
      { label: "Status", value: toStringValue(payload.status) ?? "Unknown" },
      {
        label: "Travel variance",
        value:
          historyEvent?.derived_context?.travel_variance_minutes !== undefined
            ? `${historyEvent.derived_context.travel_variance_minutes} minutes`
            : "Not provided",
      },
      {
        label: "Assessment",
        value: payload.assessment_started ? "Started" : "Not started",
      },
    ];
  }

  if (event.event_type === "SiteAssessmentSubmitted") {
    return [
      {
        label: "Transformer damage",
        value: toStringValue(payload.transformer_damage) ?? "Unknown",
      },
      {
        label: "Vegetation",
        value: payload.vegetation_contact_confirmed ? "Confirmed" : "Unconfirmed",
      },
      { label: "Site notes", value: toStringValue(payload.site_notes) ?? "No notes" },
    ];
  }

  if (event.event_type === "CustomerCallReceived") {
    return [
      { label: "Customer", value: toStringValue(payload.customer_name) ?? "Unknown" },
      { label: "Reason", value: toStringValue(payload.reason) ?? "Unknown" },
      {
        label: "Segment",
        value: toStringValue(event.derived_context?.customer_segment) ?? "Unknown",
      },
      { label: "Channel", value: "Phone" },
    ];
  }

  if (event.event_type === "CustomerEmailReceived") {
    return [
      { label: "Subject", value: toStringValue(payload.subject) ?? "Unknown" },
      { label: "From", value: toStringValue(payload.from_email) ?? "Unknown" },
      {
        label: "Path",
        value: toStringValue(event.derived_context?.path_id) ?? "Unknown",
      },
      { label: "Channel", value: "Email" },
    ];
  }

  if (event.event_type === "SandboxArtifactProduced") {
    const summary = payload.summary as Record<string, unknown> | undefined;
    const topScenario = summary?.top_scenario_delta as Record<string, unknown> | undefined;
    return [
      {
        label: "Artifact",
        value: toStringValue(payload.artifact_type) ?? "sandbox_etr_model_summary",
      },
      {
        label: "Largest delta",
        value: topScenario
          ? `${displayScenarioLabel(toStringValue(topScenario.scenario_name) ?? "scenario")} (+${toNumber(topScenario.refinement_delta_minutes) ?? 0} min)`
          : "Not available",
      },
      {
        label: "Review",
        value: event.derived_context?.ready_for_supervisor_review ? "Supervisor ready" : "Advisory",
      },
    ];
  }

  if (event.event_type === "HistoricalIncidentsRanked") {
    const incidents = Array.isArray(payload.historical_incidents)
      ? payload.historical_incidents
      : [];
    const topIncident = incidents[0] as Record<string, unknown> | undefined;

    return [
      {
        label: "Top analog",
        value: topIncident
          ? `${toStringValue(topIncident.incident_id) ?? "Unknown"} • ${toNumber(topIncident.actual_duration_minutes) ?? 0} minutes`
          : "No analogs",
      },
      {
        label: "Preferred entry",
        value:
          toStringValue((payload.site_access as Record<string, unknown> | undefined)?.preferred_entry) ??
          "Pending",
      },
      {
        label: "Analog count",
        value: `${incidents.length}`,
      },
    ];
  }

  return Object.entries(payload)
    .slice(0, 4)
    .map(([key, value]) => ({
      label: titleCase(key),
      value:
        typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : Array.isArray(value)
            ? `${value.length} items`
            : "Structured payload",
    }));
}

function buildEtrSnapshot(event: RawEvent): EtrSnapshot {
  const payload = event.payload ?? {};
  const triggerEvent = toStringValue(event.derived_context?.trigger_event);
  const topFactors = Array.isArray(payload.top_factors)
    ? payload.top_factors.filter((item): item is string => typeof item === "string")
    : [];

  return {
    predictionId: toStringValue(payload.prediction_id) ?? event.event_id,
    eventId: event.event_id,
    eventTime: event.event_time,
    clockLabel: formatClock(event.event_time),
    p50Minutes: toNumber(payload.p50_minutes) ?? 0,
    p80Minutes: toNumber(payload.p80_minutes) ?? 0,
    p95Minutes: toNumber(payload.p95_minutes) ?? 0,
    confidenceScore: toNumber(payload.confidence_score) ?? 0,
    topFactors,
    triggerEvent,
    reason: triggerEvent
      ? `${displayEventType(triggerEvent)} triggered the current refinement.`
      : topFactors[0] ?? "Local ETR core published the current estimate.",
    authoritative: Boolean(event.audit?.authoritative),
    pathPredictions: extractPathPredictions(event),
  };
}

function loadReplayBundle() {
  if (bundleCache) {
    return bundleCache;
  }

  const manifest = readJsonFile<ScenarioManifest>("scenario_manifest.json");
  const artifact = readJsonFile<SandboxSummaryArtifact>("sandbox_etr_summary_artifact.json");
  const scenarios = manifest.generated_scenarios.map<ReplayScenarioOption>((scenario) => ({
    id: scenario.scenario_name,
    label: displayScenarioLabel(scenario.scenario_name),
    outageId: scenario.outage_id,
    weatherSeverity: scenario.conditions.weather_severity,
    trafficMultiplier: scenario.conditions.traffic_multiplier,
    partsInStock: scenario.conditions.parts_in_stock,
    alternateFeedAvailable: scenario.conditions.alternate_feed_available,
    initialP50: scenario.initial_prediction.p50,
    refinedP50: scenario.refined_prediction.p50,
    refinementDeltaMinutes:
      scenario.refined_prediction.p50 - scenario.initial_prediction.p50,
    eventCount: scenario.event_count,
  }));

  const eventsByScenario = new Map<string, RawEvent[]>();
  for (const scenario of scenarios) {
    const filename = `event_stream_${scenario.id}.jsonl`;
    const lines = fs
      .readFileSync(path.join(FIXTURES_DIR, filename), "utf8")
      .split("\n")
      .filter(Boolean);
    eventsByScenario.set(
      scenario.id,
      lines.map((line) => JSON.parse(line) as RawEvent),
    );
  }

  bundleCache = { manifest, artifact, scenarios, eventsByScenario };
  return bundleCache;
}

export function buildReplayState(
  scenarioId?: string,
  replayIndex?: number,
): ReplayState {
  const bundle = loadReplayBundle();
  const scenario =
    bundle.scenarios.find((item) => item.id === scenarioId) ??
    bundle.scenarios.find((item) => item.id === CANONICAL_SCENARIO_ID) ??
    bundle.scenarios[0];

  const events = bundle.eventsByScenario.get(scenario.id) ?? [];
  const safeIndex =
    typeof replayIndex === "number"
      ? Math.min(Math.max(replayIndex, 0), Math.max(events.length - 1, 0))
      : Math.max(events.length - 1, 0);
  const activeEvents = events.slice(0, safeIndex + 1);
  const currentEvent = activeEvents[activeEvents.length - 1] ?? events[0];

  const initialEvent = activeEvents.find((event) => event.event_type === "ETRCalculated") ?? null;
  const refinedEvent =
    [...activeEvents].reverse().find((event) => event.event_type === "ETRRefined") ?? null;
  const crewAssigned =
    [...activeEvents].reverse().find((event) => event.event_type === "CrewAssigned") ?? null;
  const crewStatusEvent =
    [...activeEvents].reverse().find((event) => event.event_type === "CrewStatusUpdate") ?? null;
  const historyEvent =
    [...activeEvents]
      .reverse()
      .find((event) => event.event_type === "HistoricalIncidentsRanked") ?? null;
  const siteAssessmentEvent =
    [...activeEvents]
      .reverse()
      .find((event) => event.event_type === "SiteAssessmentSubmitted") ?? null;
  const auditNarrative =
    [...activeEvents]
      .reverse()
      .find((event) => event.event_type === "AuditNarrativePublished") ?? null;

  const initialEstimate = initialEvent ? buildEtrSnapshot(initialEvent) : null;
  const refinedEstimate = refinedEvent ? buildEtrSnapshot(refinedEvent) : null;
  const currentEstimate = refinedEstimate ?? initialEstimate;

  const crewAssignment: CrewAssignment | null = crewAssigned
    ? {
        crewId: toStringValue(crewAssigned.payload?.crew_id) ?? "Unknown",
        crewName: toStringValue(crewAssigned.payload?.crew_name) ?? "Unknown",
        members: Array.isArray(crewAssigned.payload?.members)
          ? crewAssigned.payload.members.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        skills: Array.isArray(crewAssigned.payload?.skills)
          ? crewAssigned.payload.skills.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        estimatedTravelMinutes: toNumber(
          crewAssigned.payload?.estimated_travel_minutes,
        ),
        currentDistanceKm: toNumber(crewAssigned.payload?.current_distance_km),
        siteManagerName: toStringValue(
          (crewAssigned.payload?.site_manager as Record<string, unknown> | undefined)?.name,
        ),
        siteManagerPhone: toStringValue(
          (crewAssigned.payload?.site_manager as Record<string, unknown> | undefined)?.phone,
        ),
        siteManagerNotes: toStringValue(
          (crewAssigned.payload?.site_manager as Record<string, unknown> | undefined)?.notes,
        ),
      }
    : null;

  const topIncidents = Array.isArray(historyEvent?.payload?.historical_incidents)
    ? historyEvent?.payload?.historical_incidents
    : [];

  const crewStatus: CrewStatusSnapshot | null =
    crewAssignment || crewStatusEvent || historyEvent
      ? {
          status:
            toStringValue(crewStatusEvent?.payload?.status) ??
            (crewAssignment ? "EnRoute" : "Standby"),
          assessmentStarted: Boolean(crewStatusEvent?.payload?.assessment_started),
          etaLabel:
            toStringValue(crewStatusEvent?.payload?.status) === "OnSite"
              ? "On site"
              : crewAssignment?.estimatedTravelMinutes != null
                ? `${crewAssignment.estimatedTravelMinutes} minute ETA`
                : "Standby",
          preferredEntry: toStringValue(
            (historyEvent?.payload?.site_access as Record<string, unknown> | undefined)
              ?.preferred_entry,
          ),
          parkingNotes: toStringValue(
            (historyEvent?.payload?.site_access as Record<string, unknown> | undefined)
              ?.parking_notes,
          ),
          drawingsContact: toStringValue(
            (historyEvent?.payload?.site_access as Record<string, unknown> | undefined)
              ?.drawings_contact,
          ),
          travelVarianceMinutes: toNumber(
            crewStatusEvent?.derived_context?.travel_variance_minutes,
          ),
          latestFieldNote: toStringValue(siteAssessmentEvent?.payload?.site_notes),
          topIncidents: topIncidents.map((item) => {
            const incident = item as Record<string, unknown>;
            return {
              incidentId: toStringValue(incident.incident_id) ?? "Unknown",
              monthsAgo: toNumber(incident.months_ago) ?? 0,
              rootCause: toStringValue(incident.root_cause) ?? "Unknown",
              actualDurationMinutes:
                toNumber(incident.actual_duration_minutes) ?? 0,
              predictedDurationMinutes:
                toNumber(incident.predicted_duration_minutes) ?? 0,
              crewNotes: toStringValue(incident.crew_notes) ?? "No notes",
            };
          }),
        }
      : null;

  const currentOperationalEvent: OperationalEvent = currentEvent
    ? {
        id: currentEvent.event_id,
        eventType: currentEvent.event_type,
        displayType: displayEventType(currentEvent.event_type),
        eventTime: currentEvent.event_time,
        clockLabel: formatClock(currentEvent.event_time),
        sourceSystem: displaySourceSystem(currentEvent.source_system),
        actorType: currentEvent.actor_type,
        authoritative: Boolean(currentEvent.audit?.authoritative),
        summary: summarizeEvent(currentEvent),
        detailPairs: eventDetailPairs(currentEvent, historyEvent ?? undefined),
      }
    : {
        id: "empty",
        eventType: "NoEvent",
        displayType: "No event",
        eventTime: new Date().toISOString(),
        clockLabel: "--:--",
        sourceSystem: "Operations",
        actorType: "system",
        authoritative: false,
        summary: "No replay events available.",
        detailPairs: [],
      };

  const operationalLog: OperationalLogEntry[] = activeEvents.map((event) => ({
    id: event.event_id,
    timestamp: event.event_time,
    clockLabel: formatClock(event.event_time),
    title: displayEventType(event.event_type),
    summary: summarizeEvent(event),
    sourceSystem: displaySourceSystem(event.source_system),
    actorType: event.actor_type,
    authoritative: Boolean(event.audit?.authoritative),
    detailPairs: eventDetailPairs(event, historyEvent ?? undefined),
  }));

  const fallbackDelta =
    bundle.artifact.top_scenario_deltas.find((item) => item.scenario_name === scenario.id)
      ?.refinement_delta_minutes ?? scenario.refinementDeltaMinutes;

  return {
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    scenarioOptions: bundle.scenarios,
    replayIndex: safeIndex,
    totalEvents: events.length,
    currentEvent: currentOperationalEvent,
    initialEstimate,
    refinedEstimate,
    currentEstimate,
    currentConfidenceScore: currentEstimate?.confidenceScore ?? null,
    refinementDeltaMinutes:
      initialEstimate && refinedEstimate
        ? refinedEstimate.p50Minutes - initialEstimate.p50Minutes
        : currentEstimate
          ? fallbackDelta
          : null,
    latestTrigger:
      refinedEstimate?.triggerEvent
        ? displayEventType(refinedEstimate.triggerEvent)
        : currentOperationalEvent.displayType,
    crewAssignment,
    crewStatus,
    selectedEventDetails: currentOperationalEvent.detailPairs,
    operationalLog,
    latestNarrative: toStringValue(auditNarrative?.payload?.summary),
    currentEventCounter: `Event ${safeIndex + 1} / ${events.length}`,
  };
}

export function getReplayScenarioIds() {
  return loadReplayBundle().scenarios.map((scenario) => scenario.id);
}
