import { NextResponse } from "next/server";
import { PLATFORM_SERVICE_ID } from "@/lib/platform/config";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: PLATFORM_SERVICE_ID,
    },
    { status: 200 }
  );
}
