import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/auth";
import { sendAdminPush } from "@/lib/admin-push";
import { withNoStore } from "@/lib/http";
import { verifyCsrf } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
  }

  const csrf = verifyCsrf(request, await cookies());
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: csrf.error }, withNoStore({ status: 403 }));
  }

  try {
    const result = await sendAdminPush(
      {
        title: "اعلان آزمایشی آتلیه رزی",
        body: "اعلان‌های پنل روی این گوشی فعال هستند.",
        url: "/admin/fa?section=dashboard",
        tag: `admin-push-test-${Date.now()}`,
      },
      { adminId: session.id },
    );
    return NextResponse.json({ ok: true, ...result }, withNoStore());
  } catch {
    return NextResponse.json({ ok: false, error: "push_delivery_error" }, withNoStore({ status: 502 }));
  }
}
