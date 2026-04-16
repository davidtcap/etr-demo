import { getAgentMailStatus } from "@/lib/adapters/agentmail";
import { calculateEstimate, getEtrCoreStatus, segmentRestorationPaths } from "@/lib/adapters/etr-core";
import { generateNarratives, getOpenAiStatus } from "@/lib/adapters/openai";
import { getSandboxStatus } from "@/lib/adapters/sandbox";
import { getUtilitySystemStatuses } from "@/lib/adapters/utility-systems";
import { getVapiStatus } from "@/lib/adapters/vapi";
import type { AuditEntry, ChannelEvent, DemoScenarioFlags, DemoState, EmailThread, CallSession, SandboxArtifact, SandboxJob } from "@/lib/domain";
import { buildReplayState } from "@/lib/replay";
import {
  buildCustomerProfile,
  buildFallbackNarratives,
  buildOutage,
  buildUtilityContext,
  buildVulnerability,
  buildCrewBrief,
  buildDrivers,
  createInitialFlags,
} from "@/lib/scenario";

export async function composeState(input?: {
  flags?: DemoScenarioFlags;
  auditLog?: AuditEntry[];
  channelEvents?: ChannelEvent[];
  emailThread?: EmailThread;
  callSession?: CallSession;
  sandboxJobs?: SandboxJob[];
  artifact?: SandboxArtifact | null;
  scenarioId?: string;
  replayIndex?: number;
}): Promise<DemoState> {
  const flags = input?.flags ?? createInitialFlags();
  const estimate = await calculateEstimate(flags);
  const restorationPaths = await segmentRestorationPaths(flags);
  const replay = buildReplayState(input?.scenarioId, input?.replayIndex);

  const baseState: DemoState = {
    flags,
    outage: buildOutage(flags),
    restorationPaths,
    estimate,
    replay,
    drivers: buildDrivers(flags),
    auditLog: input?.auditLog ?? [],
    customerProfile: buildCustomerProfile(flags),
    vulnerability: buildVulnerability(flags),
    crewBrief: buildCrewBrief(flags),
    artifact: input?.artifact ?? null,
    sandboxJobs: input?.sandboxJobs ?? [],
    narratives: buildFallbackNarratives(estimate, flags),
    integrations: [
      getEtrCoreStatus(),
      getOpenAiStatus(),
      getVapiStatus(),
      getAgentMailStatus(),
      getSandboxStatus(),
      ...getUtilitySystemStatuses(),
    ],
    utilityContext: buildUtilityContext(flags),
    channelEvents: input?.channelEvents ?? [],
    callSession: input?.callSession ?? {
      status: "idle",
      customerType: null,
      transcript: [],
      suggestedReply: "No active call session.",
      afterCallSummary: "No call has been simulated.",
    },
    emailThread: input?.emailThread ?? {
      inbox: "outages@utility.example",
      status: "idle",
      messages: [],
    },
  };

  return {
    ...baseState,
    narratives: await generateNarratives(baseState),
  };
}
