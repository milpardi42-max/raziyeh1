import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { withNoStore } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Admin-app bootstrap session. The temporary public mode is scoped to admin routes. */
export async function GET() {
  return NextResponse.json({ user: await getAdminSession() }, withNoStore());
}
