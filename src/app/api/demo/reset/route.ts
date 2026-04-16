import { NextResponse } from "next/server";

import { resetDemoState } from "@/lib/store";

export async function POST() {
  return NextResponse.json(await resetDemoState());
}
