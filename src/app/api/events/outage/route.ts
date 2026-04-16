import { NextResponse } from "next/server";
import { z } from "zod";

import { applyScenarioAction, parseScenarioAction } from "@/lib/store";

const schema = z.object({
  action: z.string(),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const action = parseScenarioAction(body.action);

  return NextResponse.json(await applyScenarioAction(action));
}
