import { z } from "zod";

import { buildInboundEmail, buildInitialEmailThread } from "@/lib/adapters/agentmail";
import { getSandboxArtifact, getSandboxJob, launchSandboxJob } from "@/lib/adapters/sandbox";
import { buildMockCallSession } from "@/lib/adapters/vapi";
import type { AuditEntry, ChannelEvent, DemoState, ScenarioAction } from "@/lib/domain";
import { composeState } from "@/lib/orchestrator";
import { createInitialFlags } from "@/lib/scenario";

const actionSchema = z.enum([
  "initialize",
  "crew-arrived",
  "toggle-low-confidence",
  "toggle-vulnerable-household",
  "toggle-parts-delay",
]);

let demoStatePromise: Promise<DemoState> | null = null;

function createAuditEntry(
  actor: string,
  action: string,
  detail: string,
): AuditEntry {
  return {
    id: `AUD-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actor,
    action,
    detail,
  };
}

function createChannelEvent(
  channel: ChannelEvent["channel"],
  source: string,
  summary: string,
): ChannelEvent {
  return {
    id: `EVT-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    channel,
    source,
    timestamp: new Date().toISOString(),
    summary,
  };
}

async function ensureState() {
  if (!demoStatePromise) {
    demoStatePromise = composeState({
      flags: createInitialFlags(),
      auditLog: [
        createAuditEntry(
          "System",
          "Scenario ready",
          "Presenter workspace initialized with seeded outage context.",
        ),
      ],
      emailThread: buildInitialEmailThread(),
    });
  }

  return demoStatePromise;
}

async function saveState(nextState: DemoState) {
  demoStatePromise = Promise.resolve(nextState);
  return nextState;
}

export async function getDemoState() {
  const current = await ensureState();
  if (current.replay.replayIndex === current.replay.totalEvents - 1) {
    return current;
  }

  const refreshed = await composeState({
    flags: current.flags,
    scenarioId: current.replay.scenarioId,
    auditLog: current.auditLog,
    channelEvents: current.channelEvents,
    emailThread: current.emailThread,
    callSession: current.callSession,
    sandboxJobs: current.sandboxJobs,
    artifact: current.artifact,
  });

  return saveState(refreshed);
}

export async function resetDemoState() {
  const nextState = await composeState({
    flags: createInitialFlags(),
    auditLog: [
      createAuditEntry(
        "Presenter",
        "Scenario reset",
        "Demo state returned to the seeded initial condition.",
      ),
    ],
    channelEvents: [
      createChannelEvent(
        "outage",
        "Presenter",
        "Demo reset to seed state.",
      ),
    ],
    emailThread: buildInitialEmailThread(),
  });

  return saveState(nextState);
}

export function parseScenarioAction(value: unknown): ScenarioAction {
  return actionSchema.parse(value);
}

export async function applyScenarioAction(action: ScenarioAction) {
  const current = await ensureState();
  const flags = { ...current.flags };

  if (action === "initialize") {
    flags.outageInitialized = true;
  } else if (action === "crew-arrived") {
    flags.outageInitialized = true;
    flags.crewArrived = true;
  } else if (action === "toggle-low-confidence") {
    flags.lowConfidence = !flags.lowConfidence;
  } else if (action === "toggle-vulnerable-household") {
    flags.vulnerableHousehold = !flags.vulnerableHousehold;
  } else if (action === "toggle-parts-delay") {
    flags.partsDelay = !flags.partsDelay;
  }

  const detailMap: Record<ScenarioAction, string> = {
    initialize: "Outage event ingested and path-based segmentation started.",
    "crew-arrived":
      "Crew arrival confirmed and local ETR confidence refreshed from field findings.",
    "toggle-low-confidence":
      flags.lowConfidence
        ? "Low-confidence mode enabled to widen the planning band."
        : "Low-confidence mode cleared after returning to normal uncertainty.",
    "toggle-vulnerable-household":
      flags.vulnerableHousehold
        ? "Vulnerable household workflow activated for policy-aware escalation."
        : "Vulnerable household workflow returned to standard handling.",
    "toggle-parts-delay":
      flags.partsDelay
        ? "Parts delay injected to extend the upper restoration window."
        : "Parts delay removed and replacement staging normalized.",
  };

  const nextState = await composeState({
    flags,
    scenarioId: current.replay.scenarioId,
    auditLog: [
      ...current.auditLog,
      createAuditEntry("IncidentAgent", action, detailMap[action]),
    ],
    channelEvents: [
      ...current.channelEvents,
      createChannelEvent("outage", "OMS event", detailMap[action]),
    ],
    emailThread: current.emailThread,
    callSession: current.callSession,
    sandboxJobs: current.sandboxJobs,
    artifact: current.artifact,
  });

  return saveState(nextState);
}

export async function applyVapiEvent(type: "standard" | "vulnerable") {
  const current = await ensureState();
  const nextCall = buildMockCallSession(type, current.flags);
  const nextState = await composeState({
    flags: current.flags,
    scenarioId: current.replay.scenarioId,
    auditLog: [
      ...current.auditLog,
      createAuditEntry(
        "VulnerabilityAgent",
        "Voice event",
        type === "vulnerable"
          ? "Urgent vulnerable household call simulated."
          : "Standard business customer call simulated.",
      ),
    ],
    channelEvents: [
      ...current.channelEvents,
      createChannelEvent(
        "voice",
        "Vapi",
        type === "vulnerable"
          ? "Vulnerable call routed through the CSR workflow."
          : "Standard call transcript replayed through the CSR workflow.",
      ),
    ],
    emailThread: current.emailThread,
    callSession: nextCall,
    sandboxJobs: current.sandboxJobs,
    artifact: current.artifact,
  });

  return saveState(nextState);
}

export async function applyAgentMailEvent() {
  const current = await ensureState();
  const nextEmailThread = buildInboundEmail(
    current.flags,
    current.narratives.emailDraft,
  );

  const nextState = await composeState({
    flags: current.flags,
    scenarioId: current.replay.scenarioId,
    auditLog: [
      ...current.auditLog,
      createAuditEntry(
        "ExplainerAgent",
        "Email event",
        current.flags.vulnerableHousehold
          ? "Customer email drafted and routed to human review."
          : "Customer email drafted for immediate send.",
      ),
    ],
    channelEvents: [
      ...current.channelEvents,
      createChannelEvent(
        "email",
        "AgentMail",
        current.flags.vulnerableHousehold
          ? "Email thread created with review gate."
          : "Email thread created with outbound draft.",
      ),
    ],
    emailThread: nextEmailThread,
    callSession: current.callSession,
    sandboxJobs: current.sandboxJobs,
    artifact: current.artifact,
  });

  return saveState(nextState);
}

export async function runSandboxAnalysis() {
  const current = await ensureState();
  const launched = await launchSandboxJob(current.flags);

  let interimState = await composeState({
    flags: current.flags,
    scenarioId: current.replay.scenarioId,
    auditLog: [
      ...current.auditLog,
      createAuditEntry(
        "PredictionWorkbenchAgent",
        "Machine learning environment launched",
        "Background explainability and backtest job queued.",
      ),
    ],
    channelEvents: [
      ...current.channelEvents,
      createChannelEvent(
        "sandbox",
        "Machine Learning Environment",
        "Explainability and historical analysis job launched.",
      ),
    ],
    emailThread: current.emailThread,
    callSession: current.callSession,
    sandboxJobs: [...current.sandboxJobs, launched],
    artifact: current.artifact,
  });

  interimState = await saveState(interimState);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const completedJob = await getSandboxJob(launched.id);
  const artifact = completedJob?.artifactId
    ? await getSandboxArtifact(completedJob.artifactId)
    : null;

  if (!completedJob || !artifact) {
    return interimState;
  }

  const refreshedState = await composeState({
    flags: interimState.flags,
    scenarioId: interimState.replay.scenarioId,
    auditLog: [
      ...interimState.auditLog,
      createAuditEntry(
        "PredictionWorkbenchAgent",
        "Machine learning environment completed",
        "Analysis artifact published to the demo workspace.",
      ),
    ],
    channelEvents: [
      ...interimState.channelEvents,
      createChannelEvent(
        "sandbox",
        "Machine Learning Environment",
        "Artifact published for control room and crew review.",
      ),
    ],
    emailThread: interimState.emailThread,
    callSession: interimState.callSession,
    sandboxJobs: interimState.sandboxJobs.map((job) =>
      job.id === launched.id ? completedJob : job,
    ),
    artifact,
  });

  return saveState(refreshedState);
}

export async function applyReplaySelection(input: {
  scenarioId?: string;
  replayIndex?: number;
}) {
  const current = await ensureState();
  const nextScenarioId = input.scenarioId ?? current.replay.scenarioId;

  const nextState = await composeState({
    flags: current.flags,
    scenarioId: nextScenarioId,
    auditLog: current.auditLog,
    channelEvents: current.channelEvents,
    emailThread: current.emailThread,
    callSession: current.callSession,
    sandboxJobs: current.sandboxJobs,
    artifact: current.artifact,
  });

  return saveState(nextState);
}
