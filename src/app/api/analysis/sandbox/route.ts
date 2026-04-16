import { NextResponse } from "next/server";
import { z } from "zod";

import { runSandboxAnalysis } from "@/lib/store";

const schema = z.object({
  action: z.literal("launch"),
});

export async function POST(request: Request) {
  schema.parse(await request.json());
  return NextResponse.json(await runSandboxAnalysis());
}
