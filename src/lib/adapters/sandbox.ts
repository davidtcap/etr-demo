import type { DemoScenarioFlags, SandboxArtifact, SandboxJob } from "@/lib/domain";
import { buildArtifact } from "@/lib/scenario";

const sandboxJobs = new Map<string, SandboxJob>();
const sandboxArtifacts = new Map<string, SandboxArtifact>();

export function getSandboxStatus() {
  return {
    name: "Sandbox",
    mode: "live" as const,
    detail: "Local async analysis lane with deterministic artifacts.",
  };
}

export async function launchSandboxJob(
  flags: DemoScenarioFlags,
): Promise<SandboxJob> {
  const id = `job-${Date.now()}`;
  const artifact = buildArtifact(flags);
  const job: SandboxJob = {
    id,
    status: "queued",
    requestedAt: new Date().toISOString(),
    artifactId: null,
  };

  sandboxJobs.set(id, job);

  setTimeout(() => {
    const completedJob: SandboxJob = {
      ...job,
      status: "completed",
      artifactId: artifact.id,
    };
    sandboxJobs.set(id, completedJob);
    sandboxArtifacts.set(artifact.id, artifact);
  }, 400);

  return job;
}

export async function getSandboxJob(id: string) {
  return sandboxJobs.get(id) ?? null;
}

export async function getSandboxArtifact(id: string) {
  return sandboxArtifacts.get(id) ?? null;
}
