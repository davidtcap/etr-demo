import { NextResponse } from "next/server";

import { getDemoState } from "@/lib/store";

export async function GET() {
  return NextResponse.json(await getDemoState());
}
