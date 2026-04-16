import { NextResponse } from "next/server";
import { z } from "zod";

import { applyVapiEvent } from "@/lib/store";

const schema = z.object({
  type: z.enum(["standard", "vulnerable"]),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  return NextResponse.json(await applyVapiEvent(body.type));
}
