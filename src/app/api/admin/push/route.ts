import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/auth";
import { adminPushConfig, listAdminPushDevices, parseAdminPushSubscription, removeAdminPushDevice, saveAdminPushDevice } from "@/lib/admin-push";
import { withNoStore } from "@/lib/http";
import { verifyCsrf } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
}

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") return unauthorized();

  const { configured, publicKey } = adminPushConfig();
  try {
    const devices = await listAdminPushDevices(session.id);
    return NextResponse.json(
      { ok: true, configured, publicKey: configured ? publicKey : "", devices: devices.length },
      withNoStore(),
    );
  } catch {
    return NextResponse.json({ ok: false, error: "push_store_error" }, withNoStore({ status: 500 }));
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") return unauthorized();

  const csrf = verifyCsrf(request, await cookies());
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: csrf.error }, withNoStore({ status: 403 }));
  }

  const { configured } = adminPushConfig();
  if (!configured) {
    return NextResponse.json({ ok: false, error: "push_not_configured" }, withNoStore({ status: 503 }));
  }

  const body = await request.json().catch(() => null) as { subscription?: unknown } | null;
  const subscription = parseAdminPushSubscription(body?.subscription);
  if (!subscription) {
    return NextResponse.json({ ok: false, error: "invalid_subscription" }, withNoStore({ status: 400 }));
  }

  try {
    const result = await saveAdminPushDevice(session.id, subscription);
    if (!result.saved) {
      return NextResponse.json({ ok: false, error: "device_limit", limit: 8 }, withNoStore({ status: 409 }));
    }
    return NextResponse.json({ ok: true, devices: result.count }, withNoStore());
  } catch {
    return NextResponse.json({ ok: false, error: "push_store_error" }, withNoStore({ status: 500 }));
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") return unauthorized();

  const csrf = verifyCsrf(request, await cookies());
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: csrf.error }, withNoStore({ status: 403 }));
  }

  const body = await request.json().catch(() => null) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string" || body.endpoint.length > 2048) {
    return NextResponse.json({ ok: false, error: "invalid_endpoint" }, withNoStore({ status: 400 }));
  }

  try {
    const result = await removeAdminPushDevice(session.id, body.endpoint);
    return NextResponse.json({ ok: true, devices: result.count }, withNoStore());
  } catch {
    return NextResponse.json({ ok: false, error: "push_store_error" }, withNoStore({ status: 500 }));
  }
}
