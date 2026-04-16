import { NextResponse } from "next/server";

import { getSandboxArtifact, getSandboxJob } from "@/lib/adapters/sandbox";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const job = await getSandboxJob(id);

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const artifact = job.artifactId
    ? await getSandboxArtifact(job.artifactId)
    : null;

  return NextResponse.json({ job, artifact });
}
