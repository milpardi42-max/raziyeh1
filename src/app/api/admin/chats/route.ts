import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { withNoStore } from "@/lib/http";
import { addChatMessage, listChats, setChatStatus } from "@/lib/data/chats";

export const dynamic = "force-dynamic";

async function isAdmin() {
  return (await getAdminSession())?.role === "admin";
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
  return NextResponse.json({ ok: true, chats: await listChats() }, withNoStore());
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
  const body = await request.json().catch(() => null) as { id?: unknown; action?: unknown; message?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[a-f0-9]{48}$/.test(id)) return NextResponse.json({ ok: false, error: "invalid_id" }, withNoStore({ status: 400 }));

  if (body?.action === "reply") {
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
    if (!message) return NextResponse.json({ ok: false, error: "message_required" }, withNoStore({ status: 400 }));
    const chat = await addChatMessage(id, "admin", message);
    if (!chat) return NextResponse.json({ ok: false, error: "not_found" }, withNoStore({ status: 404 }));
    return NextResponse.json({ ok: true, chat }, withNoStore());
  }

  if (body?.action === "close" || body?.action === "reopen") {
    const chat = await setChatStatus(id, body.action === "close" ? "closed" : "open");
    if (!chat) return NextResponse.json({ ok: false, error: "not_found" }, withNoStore({ status: 404 }));
    return NextResponse.json({ ok: true, chat }, withNoStore());
  }
  return NextResponse.json({ ok: false, error: "invalid_action" }, withNoStore({ status: 400 }));
}
