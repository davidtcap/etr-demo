export type IntegrationMode = "live" | "mock";

export type ScenarioAction =
  | "initialize"
  | "crew-arrived"
  | "toggle-low-confidence"
  | "toggle-vulnerable-household"
  | "toggle-parts-delay";

export interface DemoScenarioFlags {
  outageInitialized: boolean;
  crewArrived: boolean;
  lowConfidence: boolean;
  vulnerableHousehold: boolean;
  partsDelay: boolean;
}

export interface Outage {
  id: string;
  createdAt: string;
  feeder: string;
  equipmentType: string;
  location: string;
  affectedCustomers: number;
  status: "monitoring" | "dispatched" | "field-assessment";
}

export interface RestorationPath {
  id: string;
  label: string;
  customerCount: number;
  status: "tracking" | "staged" | "watch";
  summary: string;
}

export interface Driver {
  label: string;
  impact: "positive" | "negative" | "watch";
  detail: string;
}

export interface EtrEstimate {
  p50: string;
  p80: string;
  p95: string;
  confidenceScore: number;
  confidenceLabel: string;
  auditId: string;
}

export interface ReplayPathPrediction {
  pathId: string;
  customers: number;
  p50Minutes: number | null;
  p80Minutes: number | null;
  p95Minutes: number | null;
  confidenceScore: number | null;
  status: string;
  distributionDriver: string | null;
  stabilizedCustomers: number | null;
}

export interface EtrSnapshot {
  predictionId: string;
  eventId: string;
  eventTime: string;
  clockLabel: string;
  p50Minutes: number;
  p80Minutes: number;
  p95Minutes: number;
  confidenceScore: number;
  topFactors: string[];
  triggerEvent: string | null;
  reason: string;
  authoritative: boolean;
  pathPredictions: ReplayPathPrediction[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
}

export interface CustomerProfile {
  accountName: string;
  segment: "business" | "residential";
  contactChannel: "voice" | "email";
  vulnerable: boolean;
  notes: string[];
}

export interface VulnerabilityAssessment {
  level: "normal" | "urgent";
  reason: string;
  welfareActions: string[];
  needsHumanApproval: boolean;
}

export interface CrewBrief {
  summary: string;
  topIncidents: string[];
  likelyDelays: string[];
  firstActions: string[];
}

export interface CrewAssignment {
  crewId: string;
  crewName: string;
  members: string[];
  skills: string[];
  estimatedTravelMinutes: number | null;
  currentDistanceKm: number | null;
  siteManagerName: string | null;
  siteManagerPhone: string | null;
  siteManagerNotes: string | null;
}

export interface CrewStatusSnapshot {
  status: string;
  assessmentStarted: boolean;
  etaLabel: string;
  preferredEntry: string | null;
  parkingNotes: string | null;
  drawingsContact: string | null;
  travelVarianceMinutes: number | null;
  latestFieldNote: string | null;
  topIncidents: Array<{
    incidentId: string;
    monthsAgo: number;
    rootCause: string;
    actualDurationMinutes: number;
    predictedDurationMinutes: number;
    crewNotes: string;
  }>;
}

export interface SandboxArtifact {
  id: string;
  title: string;
  createdAt: string;
  format: "json" | "chart";
  summary: string;
  highlights: string[];
  values: Array<{ label: string; actual: number; predicted: number }>;
}

export interface ChannelEvent {
  id: string;
  channel: "outage" | "voice" | "email" | "sandbox";
  source: string;
  timestamp: string;
  summary: string;
}

export interface AgentNarratives {
  controlRoom: string;
  customerSafe: string;
  csrGuidance: string;
  managerNote: string;
  crewSummary: string;
  emailDraft: string;
}

export interface IntegrationStatus {
  name: string;
  mode: IntegrationMode;
  detail: string;
}

export interface CallTranscriptLine {
  speaker: "caller" | "csr" | "assistant";
  text: string;
}

export interface CallSession {
  status: "idle" | "active";
  customerType: "standard" | "vulnerable" | null;
  transcript: CallTranscriptLine[];
  suggestedReply: string;
  afterCallSummary: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  timestamp: string;
  subject: string;
  body: string;
  direction: "inbound" | "outbound";
  reviewRequired: boolean;
}

export interface EmailThread {
  inbox: string;
  status: "idle" | "active";
  messages: EmailMessage[];
}

export interface SandboxJob {
  id: string;
  status: "queued" | "completed";
  requestedAt: string;
  artifactId: string | null;
}

export interface UtilityContext {
  sources: Array<{ name: string; status: string; summary: string }>;
}

export interface ScenarioManifest {
  generated_scenarios: Array<{
    scenario_name: string;
    outage_id: string;
    customer_count: number;
    vulnerable_customers: number;
    event_count: number;
    path_counts: Record<string, number>;
    initial_prediction: {
      p50: number;
      p80: number;
      p95: number;
      confidence: number;
    };
    refined_prediction: {
      p50: number;
      p80: number;
      p95: number;
      confidence: number;
    };
    conditions: {
      weather_severity: string;
      alternate_feed_available: boolean;
      parts_in_stock: boolean;
      traffic_multiplier: number;
      vegetation_risk_level: string;
    };
    output_path: string;
  }>;
}

export interface ReplayDetailPair {
  label: string;
  value: string;
}

export interface OperationalEvent {
  id: string;
  eventType: string;
  displayType: string;
  eventTime: string;
  clockLabel: string;
  sourceSystem: string;
  actorType: string;
  authoritative: boolean;
  summary: string;
  detailPairs: ReplayDetailPair[];
}

export interface OperationalLogEntry {
  id: string;
  timestamp: string;
  clockLabel: string;
  title: string;
  summary: string;
  sourceSystem: string;
  actorType: string;
  authoritative: boolean;
  detailPairs: ReplayDetailPair[];
}

export interface ReplayScenarioOption {
  id: string;
  label: string;
  outageId: string;
  weatherSeverity: string;
  trafficMultiplier: number;
  partsInStock: boolean;
  alternateFeedAvailable: boolean;
  initialP50: number;
  refinedP50: number;
  refinementDeltaMinutes: number;
  eventCount: number;
}

export interface ReplayState {
  scenarioId: string;
  scenarioLabel: string;
  scenarioOptions: ReplayScenarioOption[];
  replayIndex: number;
  totalEvents: number;
  currentEvent: OperationalEvent;
  initialEstimate: EtrSnapshot | null;
  refinedEstimate: EtrSnapshot | null;
  currentEstimate: EtrSnapshot | null;
  currentConfidenceScore: number | null;
  refinementDeltaMinutes: number | null;
  latestTrigger: string;
  crewAssignment: CrewAssignment | null;
  crewStatus: CrewStatusSnapshot | null;
  selectedEventDetails: ReplayDetailPair[];
  operationalLog: OperationalLogEntry[];
  latestNarrative: string | null;
  currentEventCounter: string;
}

export interface DemoState {
  flags: DemoScenarioFlags;
  outage: Outage;
  restorationPaths: RestorationPath[];
  estimate: EtrEstimate;
  replay: ReplayState;
  drivers: Driver[];
  auditLog: AuditEntry[];
  customerProfile: CustomerProfile;
  vulnerability: VulnerabilityAssessment;
  crewBrief: CrewBrief;
  artifact: SandboxArtifact | null;
  sandboxJobs: SandboxJob[];
  narratives: AgentNarratives;
  integrations: IntegrationStatus[];
  utilityContext: UtilityContext;
  channelEvents: ChannelEvent[];
  callSession: CallSession;
  emailThread: EmailThread;
}
