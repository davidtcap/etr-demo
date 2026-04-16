import { NextResponse } from "next/server";
import { z } from "zod";

import { applyAgentMailEvent } from "@/lib/store";

const schema = z.object({
  action: z.literal("simulate"),
});

export async function POST(request: Request) {
  schema.parse(await request.json());
  return NextResponse.json(await applyAgentMailEvent());
}
