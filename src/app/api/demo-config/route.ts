import { NextResponse } from "next/server";
import { demoConfig } from "@/lib/demo-mode";

export function GET() {
  return NextResponse.json(demoConfig(), { headers: { "cache-control": "no-store" } });
}
