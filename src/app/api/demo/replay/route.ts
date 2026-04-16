import { NextResponse } from "next/server";
import { z } from "zod";

import { applyReplaySelection } from "@/lib/store";

const schema = z.object({
  scenarioId: z.string().optional(),
  replayIndex: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  return NextResponse.json(await applyReplaySelection(body));
}
