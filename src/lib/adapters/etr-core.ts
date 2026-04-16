import type { DemoScenarioFlags, EtrEstimate, RestorationPath } from "@/lib/domain";
import { buildEstimate, buildRestorationPaths } from "@/lib/scenario";

export function getEtrCoreStatus() {
  return {
    name: "Local ETR Core",
    mode: "live" as const,
    detail: "Authoritative local scoring and audit lane.",
  };
}

export async function calculateEstimate(
  flags: DemoScenarioFlags,
): Promise<EtrEstimate> {
  return buildEstimate(flags);
}

export async function segmentRestorationPaths(
  flags: DemoScenarioFlags,
): Promise<RestorationPath[]> {
  return buildRestorationPaths(flags);
}
