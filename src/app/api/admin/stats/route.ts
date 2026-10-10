import { orderStatistics } from "@/lib/data/order-statistics";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getAllOrders } from "@/lib/data/orders";
import { withNoStore } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
  }

  try {
    const orders = await getAllOrders({ strict: true });
    return NextResponse.json({ ok: true, ...orderStatistics(orders) }, withNoStore());
  } catch {
    return NextResponse.json({ ok: false, error: "stats_unavailable" }, withNoStore({ status: 503 }));
  }
}
