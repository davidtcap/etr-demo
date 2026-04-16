"use client";

import dynamic from "next/dynamic";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import type { DemoState, RestorationPath, ScenarioAction } from "@/lib/domain";
import { formatUtc } from "@/lib/scenario";

type WorkspaceTab = "overview" | "phone" | "email" | "field" | "system";
type FilterKey = "open" | "priority" | "all";
type ThemeMode = "dark" | "light";

const tabs: Array<{ key: WorkspaceTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "field", label: "Field" },
  { key: "system", label: "System" },
];

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "open", label: "Open" },
  { key: "priority", label: "Priority" },
  { key: "all", label: "All" },
];
const OutageMap = dynamic(
  () => import("@/components/outage-map").then((mod) => mod.OutageMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#eef4f9] text-sm text-slate-500">
        Loading street map...
      </div>
    ),
  },
);

async function readJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as DemoState;
}

function shellCard(children: React.ReactNode, className?: string) {
  return (
    <div
      className={`rounded-[20px] border border-[rgba(208,214,224,0.2)] bg-[linear-gradient(180deg,#f7f9fc_0%,#eef3fb_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_0_rgba(0,0,0,0.03)] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function kpiTone(index: number) {
  const tones = [
    "bg-[#7170ff]",
    "bg-[#5e6ad2]",
    "bg-[#828fff]",
    "bg-[#27a644]",
  ];

  return tones[index % tones.length];
}

function formatMinutes(value: number | null) {
  return value == null ? "Pending" : `${value} min`;
}

function formatConfidence(value: number | null) {
  return value == null ? "Pending" : `${Math.round(value * 100)}%`;
}

function MetricCard({
  label,
  value,
  detail,
  footer,
  index = 0,
}: {
  label: string;
  value: string;
  detail: string;
  footer: string;
  index?: number;
}) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4 shadow-[rgba(0,0,0,0.2)_0px_0px_0px_1px]">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#8a8f98]">
        {label}
      </div>
      <div className="mt-2 text-3xl font-[590] tracking-[-0.04em] text-[#f7f8f8]">{value}</div>
      <div className="mt-1 text-sm text-[#d0d6e0]">{detail}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#62666d]">{footer}</div>
      <div className="mt-4 h-2 rounded-full bg-[rgba(255,255,255,0.05)]">
        <div
          className={`h-2 rounded-full ${kpiTone(index)}`}
          style={{ width: `${Math.max(8, Math.min(index === 3 ? 78 : 64 + index * 8, 100))}%` }}
        />
      </div>
    </div>
  );
}

function CollapsiblePanel({
  label,
  title,
  defaultOpen = true,
  children,
}: {
  label: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group self-start rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#8a8f98]">
            {label}
          </div>
          <div className="mt-1 text-lg font-[590] text-[#f7f8f8]">{title}</div>
        </div>
        <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#a8adb7] transition group-open:rotate-180">
          ⌃
        </div>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5 shadow-[rgba(0,0,0,0.2)_0px_0px_0px_1px]">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[#8a8f98]">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-lg font-[590] text-[#f7f8f8]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function outageStatus(flags: DemoState["flags"]) {
  if (!flags.outageInitialized) {
    return "Needs review";
  }

  if (flags.crewArrived) {
    return "Field assessment";
  }

  return "In progress";
}

function pathRisk(path: RestorationPath) {
  if (path.id === "vulnerable") {
    return "At risk";
  }

  if (path.id === "uncertain") {
    return "Watch";
  }

  if (path.id === "replacement") {
    return "Dispatch";
  }

  return "Stable";
}

function detailActionLabel(state: DemoState) {
  if (state.vulnerability.needsHumanApproval) {
    return "Open welfare workflow";
  }

  if (!state.flags.crewArrived) {
    return "Record crew arrival";
  }

  if (state.flags.partsDelay) {
    return "Review parts delay";
  }

  return "Refresh customer update";
}

export function DemoApp({ initialState }: { initialState: DemoState }) {
  const [state, setState] = useState(initialState);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("open");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const persisted = window.localStorage.getItem("gridops-workspace-tab");
    if (persisted && tabs.some((tab) => tab.key === persisted)) {
      setActiveTab(persisted as WorkspaceTab);
    }

    const savedTheme = window.localStorage.getItem("gridops-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
      return;
    }

    const preferredTheme =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    setTheme(preferredTheme);
    document.documentElement.dataset.theme = preferredTheme;
  }, []);

  const persistTab = useEffectEvent((tab: WorkspaceTab) => {
    window.localStorage.setItem("gridops-workspace-tab", tab);
  });
  const persistTheme = useEffectEvent((nextTheme: ThemeMode) => {
    window.localStorage.setItem("gridops-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  });

  useEffect(() => {
    persistTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    persistTheme(theme);
  }, [theme]);

  async function runMutation(request: () => Promise<DemoState>) {
    setBusy(true);
    setError(null);

    try {
      const nextState = await request();
      startTransition(() => {
        setState(nextState);
      });
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "The workspace action failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function postAction(action: ScenarioAction) {
    return runMutation(() =>
      readJson("/api/events/outage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }),
    );
  }

  function executeSuggestedAction() {
    if (state.vulnerability.needsHumanApproval) {
      setActiveTab("phone");
      return runMutation(() =>
        readJson("/api/events/vapi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "vulnerable" }),
        }),
      );
    }

    if (!state.flags.crewArrived) {
      return postAction("crew-arrived");
    }

    if (state.flags.partsDelay) {
      return postAction("toggle-parts-delay");
    }

    setActiveTab("email");
    return runMutation(() =>
      readJson("/api/events/agentmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate" }),
      }),
    );
  }

  function updateReplay(input: { scenarioId?: string; replayIndex?: number }) {
    return runMutation(() =>
      readJson("/api/demo/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
  }

  const outageCards = state.restorationPaths.filter((path) => {
    const query = search.trim().toLowerCase();
    const matchesQuery =
      !query ||
      path.label.toLowerCase().includes(query) ||
      path.summary.toLowerCase().includes(query) ||
      state.outage.id.toLowerCase().includes(query) ||
      state.outage.location.toLowerCase().includes(query) ||
      state.outage.equipmentType.toLowerCase().includes(query);

    if (!matchesQuery) {
      return false;
    }

    if (filter === "all") {
      return true;
    }

    if (filter === "priority") {
      return path.id === "vulnerable" || path.id === "replacement";
    }

    return path.status !== "watch" || state.flags.outageInitialized;
  });

  const replay = state.replay;
  const currentReplayEstimate = replay.currentEstimate;
  const previousReplayEstimate =
    replay.refinedEstimate && replay.initialEstimate
      ? replay.initialEstimate
      : null;
  const currentDeltaFromPast =
    currentReplayEstimate && previousReplayEstimate
      ? currentReplayEstimate.p50Minutes - previousReplayEstimate.p50Minutes
      : null;
  const replayConfidence =
    replay.currentConfidenceScore != null
      ? Math.round(replay.currentConfidenceScore * 100)
      : Math.round(state.estimate.confidenceScore * 100);
  const combinedOperationalLog = [
    ...replay.operationalLog.map((entry) => ({
      id: `replay-${entry.id}`,
      timestamp: entry.timestamp,
      clockLabel: entry.clockLabel,
      title: entry.title,
      summary: entry.summary,
      source: entry.sourceSystem,
      tone: entry.authoritative ? "Authoritative" : "Advisory",
    })),
    ...state.auditLog.map((entry) => ({
      id: `workspace-${entry.id}`,
      timestamp: entry.timestamp,
      clockLabel: entry.timestamp.slice(11, 16),
      title: entry.action,
      summary: entry.detail,
      source: entry.actor,
      tone: "Workspace",
    })),
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  const topStatus = outageStatus(state.flags);
  const suggestedAction = detailActionLabel(state);
  const quickActions = [
    {
      label: "Field",
      title: "Record crew arrival",
      detail: "Update site status and tighten the planning window.",
      onClick: () => postAction("crew-arrived"),
    },
    {
      label: "Forecast",
      title: "Reclassify confidence band",
      detail: "Widen or narrow the high-percentile restoration range.",
      onClick: () => postAction("toggle-low-confidence"),
    },
    {
      label: "Welfare",
      title: "Apply welfare priority",
      detail: "Move the case into urgent household handling.",
      onClick: () => postAction("toggle-vulnerable-household"),
    },
    {
      label: "Supply",
      title: "Update parts constraint",
      detail: "Reflect staging delays in the path-based forecast.",
      onClick: () => postAction("toggle-parts-delay"),
    },
    {
      label: "Phone",
      title: "Process standard phone call",
      detail: "Load the default customer conversation workflow.",
      onClick: () =>
        runMutation(() =>
          readJson("/api/events/vapi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "standard" }),
          }),
        ),
    },
    {
      label: "Phone",
      title: "Process welfare phone call",
      detail: "Open the welfare escalation conversation workflow.",
      onClick: () =>
        runMutation(() =>
          readJson("/api/events/vapi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "vulnerable" }),
          }),
        ),
    },
    {
      label: "Email",
      title: "Process inbound email",
      detail: "Create the next threaded customer response draft.",
      onClick: () =>
        runMutation(() =>
          readJson("/api/events/agentmail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "simulate" }),
          }),
        ),
    },
    {
      label: "Analysis",
      title: "Launch analysis run",
      detail: "Publish deeper backtest and explainability output.",
      onClick: () =>
        runMutation(() =>
          readJson("/api/analysis/sandbox", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "launch" }),
          }),
        ),
    },
  ];

  return (
    <main
      data-theme={theme}
      className="gridops-shell min-h-screen bg-[#08090a] text-[#f7f8f8]"
    >
      <div className="sticky top-0 z-20 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(8,9,10,0.88)] backdrop-blur">
        <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5e6ad2] text-sm font-[590] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
              GO
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#62666d]">
                Utility Operations
              </div>
              <div className="text-base font-[590] text-[#f7f8f8]">
                GridOps ETR
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <button
              className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-[510] text-[#d0d6e0] transition hover:bg-[rgba(255,255,255,0.06)]"
              onClick={() =>
                setTheme((currentTheme) =>
                  currentTheme === "dark" ? "light" : "dark",
                )
              }
            >
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-[510] text-[#d0d6e0]">
              West Region Control
            </span>
            <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-xs font-[510] text-[#d0d6e0]">
              Operator: Dispatch Lead
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-5 px-4 py-5 md:px-6">
        <section className="rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[radial-gradient(circle_at_top,_rgba(113,112,255,0.18),_transparent_42%),linear-gradient(180deg,#111214_0%,#0f1011_100%)] p-6 text-white shadow-[rgba(0,0,0,0.4)_0px_2px_4px]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[#8a8f98]">
                <span>Situation overview</span>
              </div>
              <div className="mt-2 text-2xl font-[510] tracking-[-0.04em] text-[#f7f8f8] md:text-3xl">
                {replay.currentEvent.displayType} at {replay.currentEvent.clockLabel} is driving the current restoration picture for {state.outage.location}.
              </div>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-[#8a8f98]">
                {replay.latestNarrative &&
                replay.currentEvent.summary !== replay.latestNarrative
                  ? `${replay.currentEvent.summary} ${replay.latestNarrative}`
                  : replay.latestNarrative ?? replay.currentEvent.summary ?? state.narratives.controlRoom}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#8a8f98]">
                    Active incident
                  </div>
                  <div className="mt-2 text-lg font-[590] text-[#f7f8f8]">{state.outage.id}</div>
                  <div className="mt-1 text-sm text-[#a8adb7]">{state.outage.location}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[#62666d]">
                    {state.outage.equipmentType}
                  </div>
                </div>
                <div className="rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#8a8f98]">
                    Current event
                  </div>
                  <div className="mt-2 text-lg font-[590] text-[#f7f8f8]">
                    {replay.currentEvent.sourceSystem}
                  </div>
                  <div className="mt-1 text-sm text-[#a8adb7]">
                    {replay.currentEvent.actorType} • {replay.currentEvent.authoritative ? "Authoritative" : "Advisory"}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[#62666d]">
                    {replay.currentEvent.clockLabel}
                  </div>
                </div>
                <div className="rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#8a8f98]">
                    Trigger
                  </div>
                  <div className="mt-2 text-lg font-[590] text-[#f7f8f8]">{replay.latestTrigger}</div>
                  <div className="mt-1 text-sm text-[#a8adb7]">
                    {currentReplayEstimate?.reason ?? "Waiting for the next estimate event."}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.16em] text-[#62666d]">
                    Confidence {replayConfidence}%
                  </div>
                </div>
              </div>
            </div>
            <div className="min-w-[320px] rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] xl:max-w-[360px]">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[#8a8f98]">
                Suggested next step
              </div>
              <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#8a8f98]">
                  Action
                </div>
                <div className="mt-2 text-base font-[590] text-[#f7f8f8]">
                  {suggestedAction}
                </div>
                <div className="mt-2 text-sm leading-6 text-[#a8adb7]">
                  {state.vulnerability.needsHumanApproval
                    ? "Urgent welfare conditions are active. Route the next interaction into the supervised phone workflow."
                    : state.flags.partsDelay
                      ? "Staging risk is widening the upper band. Clear the parts constraint before sending the next update."
                      : state.flags.crewArrived
                        ? "Field findings are available. Push the next outbound update from the current operating picture."
                        : "Crew travel is still the key dependency. Confirm on-site arrival before tightening the planning window."}
                </div>
                <button
                  className="mt-4 w-full rounded-xl bg-[#5e6ad2] px-4 py-3 text-sm font-[510] text-white transition hover:bg-[#7170ff] disabled:opacity-60"
                  onClick={executeSuggestedAction}
                  disabled={busy}
                >
                  {suggestedAction}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[#0f1011] p-5 shadow-[rgba(0,0,0,0.2)_0px_0px_0px_1px]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#62666d]">
              Known outages
            </div>
            <h1 className="mt-2 text-3xl font-[510] tracking-[-0.04em] text-[#f7f8f8]">
              Restoration operations
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#8a8f98]">
              Review outage status, communicate the current planning window, and
              move between customer, field, and system context without losing the
              operational thread.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Initial ETR"
            value={
              replay.initialEstimate
                ? `P50 ${replay.initialEstimate.p50Minutes}`
                : "Pending"
            }
            detail={
              replay.initialEstimate
                ? `P80 ${replay.initialEstimate.p80Minutes} · P95 ${replay.initialEstimate.p95Minutes}`
                : "Waiting for the local ETR core to publish the initial forecast."
            }
            footer={
              replay.initialEstimate
                ? `${replay.initialEstimate.clockLabel} initial estimate`
                : "No initial estimate at this event"
            }
            index={0}
          />
          <MetricCard
            label="Current ETR"
            value={
              currentReplayEstimate
                ? `P50 ${currentReplayEstimate.p50Minutes}`
                : "Pending"
            }
            detail={
              currentReplayEstimate
                ? `P80 ${currentReplayEstimate.p80Minutes} · P95 ${currentReplayEstimate.p95Minutes}`
                : "Waiting for the current planning window."
            }
            footer={
              currentReplayEstimate
                ? `${currentReplayEstimate.clockLabel} current published estimate`
                : "No active estimate published yet"
            }
            index={1}
          />
          <MetricCard
            label="Change from past ETR"
            value={
              currentDeltaFromPast != null
                ? `${currentDeltaFromPast >= 0 ? "+" : ""}${currentDeltaFromPast} min`
                : "Pending"
            }
            detail={
              previousReplayEstimate
                ? `From earlier P50 ${previousReplayEstimate.p50Minutes} to current P50 ${currentReplayEstimate?.p50Minutes ?? "--"}`
                : "A prior estimate appears once the first refinement lands."
            }
            footer={
              currentDeltaFromPast != null
                ? replay.latestTrigger
                : "Waiting for estimate movement"
            }
            index={2}
          />
          <MetricCard
            label="Confidence"
            value={formatConfidence(currentReplayEstimate?.confidenceScore ?? null)}
            detail={
              currentReplayEstimate
                ? `${currentReplayEstimate.authoritative ? "Authoritative" : "Advisory"} local estimate`
                : "No estimate published at this point."
            }
            footer={
              currentReplayEstimate
                ? currentReplayEstimate.reason
                : "Confidence appears once the first estimate is scored"
            }
            index={3}
          />
          <MetricCard
            label="Resolution delta"
            value={
              replay.refinementDeltaMinutes != null
                ? `+${replay.refinementDeltaMinutes} min`
                : "Pending"
            }
            detail={
              replay.refinementDeltaMinutes != null
                ? "Current planning window widened between first and latest published P50."
                : "No refinement delta available yet."
            }
            footer={
              replay.refinementDeltaMinutes != null
                ? replay.latestTrigger
                : "Triggered by field assessment or parts/weather movement"
            }
            index={4}
          />
        </section>

        <section className="rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[#0f1011] p-3 shadow-[rgba(0,0,0,0.2)_0px_0px_0px_1px]">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.015)_100%)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#62666d]">
                  <span className="text-[13px] normal-case tracking-normal text-[#8a8f98]">
                    ⌕
                  </span>
                  Search
                </div>
                <span className="rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[10px] font-[510] uppercase tracking-[0.16em] text-[#62666d]">
                  /
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-sm text-[#8a8f98]">⌕</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search outage ID, feeder, location, caller, or crew state"
                  className="w-full border-0 bg-transparent p-0 text-[15px] font-[400] text-[#f7f8f8] outline-none placeholder:text-[#62666d]"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.015)] p-1">
              {filters.map((item) => (
                <button
                  key={item.key}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-[510] leading-none transition ${
                    filter === item.key
                      ? "bg-[#5e6ad2] text-white shadow-[0_0_0_1px_rgba(130,143,255,0.18)]"
                      : "text-[#8a8f98] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#d0d6e0]"
                  }`}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Section eyebrow="Operational timeline" title="Timeline and event detail">
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
              <CollapsiblePanel
                label="Operational timeline"
                title="Event stream"
              >
                <div className="max-h-[520px] overflow-auto">
                  <div className="grid gap-2">
                    {replay.operationalLog.map((event, index) => (
                      <button
                        key={event.id}
                        className={`rounded-xl border p-3 text-left transition ${
                          index === replay.replayIndex
                            ? "border-[rgba(39,166,68,0.45)] bg-[rgba(39,166,68,0.09)]"
                            : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)]"
                        }`}
                        onClick={() => updateReplay({ replayIndex: index })}
                        disabled={busy}
                      >
                        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-[#8a8f98]">
                          <span>{event.clockLabel}</span>
                          <span>{event.sourceSystem}</span>
                        </div>
                        <div className="mt-2 text-sm font-[590] text-[#f7f8f8]">
                          {event.title}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em]">
                          <span className={`rounded-full px-2 py-1 ${event.authoritative ? "bg-[rgba(39,166,68,0.12)] text-[#8ff0ad]" : "bg-[rgba(255,255,255,0.04)] text-[#8a8f98]"}`}>
                            {event.authoritative ? "Authoritative" : "Advisory"}
                          </span>
                          <span className="rounded-full bg-[rgba(113,112,255,0.12)] px-2 py-1 text-[#cfd3ff]">
                            {event.actorType}
                          </span>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[#a8adb7]">
                          {event.summary}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </CollapsiblePanel>
              <div className="grid gap-4">
                <CollapsiblePanel
                  label="Selected event"
                  title={replay.currentEvent.displayType}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm leading-6 text-[#a8adb7]">
                      {replay.currentEvent.summary}
                    </div>
                    <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#d0d6e0]">
                      {replay.currentEvent.clockLabel}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {replay.selectedEventDetails.map((pair) => (
                      <div
                        key={`${pair.label}-${pair.value}`}
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3"
                      >
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[#62666d]">
                          {pair.label}
                        </div>
                        <div className="mt-1 text-sm text-[#f7f8f8]">{pair.value}</div>
                      </div>
                    ))}
                  </div>
                </CollapsiblePanel>
                <CollapsiblePanel
                  label="Crew timing"
                  title={replay.crewStatus?.etaLabel ?? "Standby"}
                >
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-[#62666d]">
                        Crew
                      </div>
                      <div className="mt-1 text-sm font-[590] text-[#f7f8f8]">
                        {replay.crewAssignment?.crewName ?? "Unassigned"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-[#62666d]">
                        ETA / status
                      </div>
                      <div className="mt-1 text-sm font-[590] text-[#f7f8f8]">
                        {replay.crewStatus?.etaLabel ?? "Standby"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-[#62666d]">
                        Preferred entry
                      </div>
                      <div className="mt-1 text-sm font-[590] text-[#f7f8f8]">
                        {replay.crewStatus?.preferredEntry ?? "Pending"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[#a8adb7]">
                    {replay.crewAssignment
                      ? `${replay.crewAssignment.crewName} (${replay.crewAssignment.crewId}) is carrying ${replay.crewAssignment.skills.join(", ")} capability.`
                      : "Crew assignment details will appear once dispatch is confirmed."}
                  </div>
                </CollapsiblePanel>
                <CollapsiblePanel
                  label="Operational log"
                  title="System and workspace history"
                  defaultOpen={false}
                >
                  <div className="mt-3 grid gap-2">
                    {combinedOperationalLog.slice(0, 7).map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3"
                      >
                        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-[#8a8f98]">
                          <span>{entry.clockLabel}</span>
                          <span>{entry.tone}</span>
                        </div>
                        <div className="mt-1 text-sm font-[590] text-[#f7f8f8]">
                          {entry.title}
                        </div>
                        <div className="mt-1 text-sm leading-6 text-[#a8adb7]">
                          {entry.summary}
                        </div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#62666d]">
                          {entry.source}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsiblePanel>
              </div>
            </div>
          </Section>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.5fr_0.95fr]">
          <div className="flex flex-col gap-5">
            <Section eyebrow="Map-first operations" title="Active outage geography">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[#8a8f98]">
                    <span>Distribution map</span>
                    <span>{topStatus}</span>
                  </div>
                  <div className="relative mt-4 h-[340px] overflow-hidden rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[#0b1020]">
                    <OutageMap />
                    <div className="pointer-events-none absolute left-[58%] top-[29%] rounded-xl border border-white/90 bg-white/96 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm">
                      {state.outage.location}
                    </div>
                    <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/80 bg-white/92 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-slate-500 shadow-sm">
                      Live streets
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#d0d6e0]">
                    <span className="rounded-full border border-[rgba(244,63,94,0.2)] bg-[rgba(244,63,94,0.08)] px-3 py-1.5">
                      At risk
                    </span>
                    <span className="rounded-full border border-[rgba(113,112,255,0.22)] bg-[rgba(113,112,255,0.12)] px-3 py-1.5">
                      In progress
                    </span>
                    <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5">
                      Needs dispatch
                    </span>
                    <span className="rounded-full border border-[rgba(39,166,68,0.28)] bg-[rgba(39,166,68,0.1)] px-3 py-1.5 text-[#d7ffe0]">
                      Restoration imminent
                    </span>
                  </div>
                </div>

                <div className="grid gap-3">
                  {outageCards.map((path) => (
                    <button
                      key={path.id}
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4 text-left transition hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.04)] hover:shadow-[rgba(0,0,0,0.4)_0px_2px_4px]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-[590] text-[#f7f8f8]">
                          {state.outage.id}
                        </div>
                        <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8a8f98]">
                          {pathRisk(path)}
                        </div>
                      </div>
                      <div className="mt-2 text-sm font-[510] text-[#d0d6e0]">
                        {path.label}
                      </div>
                      <div className="mt-1 text-sm text-[#62666d]">
                        {state.outage.location}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[#8a8f98]">
                        <div>
                          ETR {currentReplayEstimate ? formatMinutes(currentReplayEstimate.p80Minutes) : formatUtc(state.estimate.p80)}
                        </div>
                        <div>{state.outage.equipmentType}</div>
                        <div>{path.customerCount} customers</div>
                        <div>
                          {currentReplayEstimate
                            ? `${Math.round(currentReplayEstimate.confidenceScore * 100)}% confidence`
                            : state.estimate.confidenceLabel}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Section>
          </div>

          <div className="flex flex-col gap-5">
            <Section eyebrow="Selected outage" title="Detail rail">
              <div className="rounded-[1.15rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[#8a8f98]">
                      {topStatus}
                    </div>
                    <div className="mt-1 text-2xl font-[590] text-[#f7f8f8]">
                      {state.outage.location}
                    </div>
                  </div>
                  <div className="rounded-full bg-[#5e6ad2] px-3 py-1.5 text-xs font-[510] text-white">
                    {state.outage.id}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[#62666d]">
                      ETR
                    </div>
                    <div className="mt-1 text-2xl font-[590] text-[#f7f8f8]">
                      {currentReplayEstimate
                        ? formatMinutes(currentReplayEstimate.p80Minutes)
                        : formatUtc(state.estimate.p80)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-3">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[#62666d]">
                      Confidence
                    </div>
                    <div className="mt-1 text-2xl font-[590] text-[#f7f8f8]">
                      {replayConfidence}%
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="grid gap-3 sm:grid-cols-2 text-sm text-[#8a8f98]">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-[#62666d]">
                        Customer
                      </div>
                      <div className="mt-1 text-[#f7f8f8]">
                        {state.customerProfile.accountName}
                      </div>
                      <div className="mt-1 text-[#8a8f98]">
                        {state.customerProfile.segment} account
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-[#62666d]">
                        Impacted customers
                      </div>
                      <div className="mt-1 text-[#f7f8f8]">
                        {state.outage.affectedCustomers} customers
                      </div>
                      <div className="mt-1 text-[#8a8f98]">
                        {replay.currentEstimate?.pathPredictions.length ?? state.restorationPaths.length} restoration paths
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-[#62666d]">
                        Device
                      </div>
                      <div className="mt-1 text-[#f7f8f8]">
                        {state.outage.equipmentType}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.2em] text-[#62666d]">
                        Crew
                      </div>
                      <div className="mt-1 text-[#f7f8f8]">
                        {replay.crewAssignment
                          ? `${replay.crewAssignment.crewName} dispatched`
                          : state.flags.crewArrived
                            ? "Crew 14 on site"
                            : "Crew 14 dispatched"}
                      </div>
                      <div className="mt-1 text-[#8a8f98]">
                        {replay.crewStatus?.etaLabel ??
                          (state.flags.crewArrived
                            ? "Assessment in progress"
                            : "14 minute travel estimate")}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[#62666d]">
                      Device
                    </div>
                    <div className="mt-2 text-base font-[590] text-[#f7f8f8]">
                      Next action
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[#d0d6e0]">
                      {state.vulnerability.needsHumanApproval
                        ? "Urgent household handling requires supervisor review and welfare confirmation before the next outbound response."
                        : state.flags.crewArrived
                          ? "Publish the latest field findings and refresh the next customer-safe update."
                          : "Confirm field arrival and update the restoration path forecast from the first site assessment."}
                    </div>
                    <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3 text-sm text-[#8a8f98]">
                      Suggested owner:{" "}
                      <span className="font-[590] text-[#f7f8f8]">
                        {state.flags.crewArrived ? "Field coordination" : "Dispatch desk"}
                      </span>
                    </div>
                    <button
                      className="mt-4 w-full rounded-xl bg-[#5e6ad2] px-4 py-3 text-sm font-[510] text-white transition hover:bg-[#7170ff] disabled:opacity-60"
                      onClick={executeSuggestedAction}
                      disabled={busy}
                    >
                      {suggestedAction}
                    </button>
                    <div className="mt-2 text-xs text-[#62666d]">
                      One click executes the recommended operational step.
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[#62666d]">
                    Customer context
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-[#d0d6e0]">
                    {state.customerProfile.notes.map((note) => (
                      <div key={note}>{note}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={`rounded-full px-3.5 py-2 text-sm font-[510] transition ${
                      activeTab === tab.key
                        ? "bg-[#5e6ad2] text-white"
                        : "border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.05)]"
                    }`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" ? (
                <div className="mt-4 grid gap-4">
                  <div className="rounded-[1.1rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                    <div className="text-sm font-[590] text-[#f7f8f8]">
                      Summary
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[#d0d6e0]">
                      {state.narratives.controlRoom}
                    </div>
                  </div>
                  <div className="rounded-[1.1rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                    <div className="text-sm font-[590] text-[#f7f8f8]">
                      Ranked factors
                    </div>
                    <div className="mt-3 grid gap-3">
                      {state.drivers.map((driver) => (
                        <div key={driver.label} className="text-sm text-[#d0d6e0]">
                          <span className="font-[590] text-[#f7f8f8]">
                            {driver.label}:
                          </span>{" "}
                          {driver.detail}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[1.1rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                    <div className="text-sm font-[590] text-[#f7f8f8]">
                      Timeline
                    </div>
                    <div className="mt-3 grid gap-3">
                      {combinedOperationalLog.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="text-sm text-[#d0d6e0]">
                          <span className="font-[590] text-[#f7f8f8]">
                            {entry.title}
                          </span>{" "}
                          at {entry.clockLabel} via {entry.source}. {entry.summary}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "phone" ? (
                <div className="mt-4 grid gap-4">
                  <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-950">
                        Call activity
                      </div>
                      <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        {state.callSession.status}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {state.callSession.transcript.length > 0 ? (
                        state.callSession.transcript.map((line, index) => (
                          <div
                            key={`${line.speaker}-${index}`}
                            className="rounded-xl border border-slate-200 bg-white p-3"
                          >
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                              {line.speaker}
                            </div>
                            <div className="mt-1 text-sm leading-7 text-slate-700">
                              {line.text}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                          No active phone transcript.
                        </div>
                      )}
                    </div>
                  </div>
                  {shellCard(
                    <div className="p-4">
                      <div className="text-sm font-semibold text-slate-950">
                        Caller response
                      </div>
                      <div className="mt-2 text-sm leading-7 text-slate-700">
                        {state.callSession.suggestedReply}
                      </div>
                    </div>,
                  )}
                </div>
              ) : null}

              {activeTab === "email" ? (
                <div className="mt-4 grid gap-4">
                  <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-950">
                      Email thread
                    </div>
                    <div className="mt-3 grid gap-3">
                      {state.emailThread.messages.length > 0 ? (
                        state.emailThread.messages.map((message) => (
                          <div
                            key={message.id}
                            className="rounded-xl border border-slate-200 bg-white p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                              <span>{message.direction}</span>
                              <span>{message.subject}</span>
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                              {message.from} to {message.to}
                            </div>
                            <div className="mt-2 text-sm leading-7 text-slate-700">
                              {message.body}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                          No active email thread.
                        </div>
                      )}
                    </div>
                  </div>
                  {shellCard(
                    <div className="p-4">
                      <div className="text-sm font-semibold text-slate-950">
                        Draft guidance
                      </div>
                      <div className="mt-2 text-sm leading-7 text-slate-700">
                        {state.narratives.emailDraft}
                      </div>
                    </div>,
                  )}
                </div>
              ) : null}

              {activeTab === "field" ? (
                <div className="mt-4 grid gap-4">
                  <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-950">
                      Crew brief
                    </div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">
                      {replay.crewStatus?.latestFieldNote ?? state.crewBrief.summary}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Crew
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-950">
                          {replay.crewAssignment?.crewName ?? "Unassigned"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          ETA / status
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-950">
                          {replay.crewStatus?.etaLabel ?? "Standby"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          Access
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-950">
                          {replay.crewStatus?.preferredEntry ?? "Pending"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {(replay.crewStatus?.topIncidents.length
                        ? replay.crewStatus.topIncidents.map((incident) => (
                            `${incident.incidentId}: ${incident.rootCause}, actual ${incident.actualDurationMinutes} minutes. ${incident.crewNotes}`
                          ))
                        : state.crewBrief.firstActions
                      ).map((item) => (
                        <div key={item} className="text-sm text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-950">
                      Analysis output
                    </div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">
                      {state.artifact
                        ? state.artifact.summary
                        : "No analysis artifact published yet."}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "system" ? (
                <div className="mt-4 grid gap-4">
                  <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-950">
                      Source systems
                    </div>
                    <div className="mt-3 grid gap-3">
                      {state.utilityContext.sources.map((source) => (
                        <div
                          key={source.name}
                          className="rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-950">
                              {source.name}
                            </div>
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                              {source.status}
                            </div>
                          </div>
                          <div className="mt-1 text-sm text-slate-700">
                            {source.summary}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {shellCard(
                    <div className="p-4">
                      <div className="text-sm font-semibold text-slate-950">
                        Channel and analysis lanes
                      </div>
                      <div className="mt-2 text-sm leading-7 text-slate-700">
                        Phone and email remain communication channels. The
                        analysis lane handles heavier backtesting and artifact
                        generation without slowing the active outage workflow.
                      </div>
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                        Current operational source: {replay.currentEvent.sourceSystem} • {replay.currentEvent.authoritative ? "Authoritative" : "Advisory"} • {replay.currentEvent.displayType}
                      </div>
                    </div>,
                  )}
                </div>
              ) : null}
            </Section>

            {error ? (
              <div className="rounded-[1.1rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <Section eyebrow="Quick actions" title="Operations controls">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <button
                    key={action.title}
                    className="group rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-[rgba(113,112,255,0.28)] hover:bg-[rgba(113,112,255,0.08)] disabled:opacity-60"
                    onClick={action.onClick}
                    disabled={busy}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[10px] font-[510] uppercase tracking-[0.18em] text-[#8a8f98] group-hover:text-[#d0d6e0]">
                        {action.label}
                      </span>
                      <span className="h-2 w-2 rounded-full bg-[rgba(113,112,255,0.9)] shadow-[0_0_0_4px_rgba(113,112,255,0.08)]" />
                    </div>
                    <div className="mt-3 text-[15px] font-[510] text-[#f7f8f8]">
                      {action.title}
                    </div>
                    <div className="mt-1 text-[13px] leading-6 text-[#8a8f98]">
                      {action.detail}
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          </div>
        </section>
      </div>
    </main>
  );
}
