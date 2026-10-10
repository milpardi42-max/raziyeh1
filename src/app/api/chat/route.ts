import { NextResponse } from "next/server";
import { addChatMessage, createChat, findChat } from "@/lib/data/chats";
import { withNoStore } from "@/lib/http";
import { clientIp, recordAttempt, retryAfterSeconds, tooManyAttempts } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[a-f0-9]{48}$/.test(id)) {
    return NextResponse.json({ ok: false, error: "not_found" }, withNoStore({ status: 404 }));
  }
  const chat = await findChat(id);
  if (!chat) return NextResponse.json({ ok: false, error: "not_found" }, withNoStore({ status: 404 }));
  return NextResponse.json({ ok: true, chat }, withNoStore());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const message = clean(body?.message, 2000);
  const id = clean(body?.id, 48);
  if (message.length < 1) return NextResponse.json({ ok: false, error: "message_required" }, withNoStore({ status: 400 }));

  if (id) {
    if (!/^[a-f0-9]{48}$/.test(id)) return NextResponse.json({ ok: false, error: "not_found" }, withNoStore({ status: 404 }));
    const rateKey = `chat-message:${id}`;
    if (tooManyAttempts(rateKey)) return NextResponse.json({ ok: false, error: "rate_limited" }, withNoStore({ status: 429, headers: { "retry-after": String(retryAfterSeconds(rateKey)) } }));
    const chat = await addChatMessage(id, "customer", message);
    if (!chat) return NextResponse.json({ ok: false, error: "chat_closed" }, withNoStore({ status: 404 }));
    recordAttempt(rateKey);
    return NextResponse.json({ ok: true, chat }, withNoStore());
  }

  const name = clean(body?.name, 100);
  const email = clean(body?.email, 254).toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "details_required" }, withNoStore({ status: 400 }));
  }
  const rateKey = `chat-create:${clientIp(request)}`;
  if (tooManyAttempts(rateKey)) return NextResponse.json({ ok: false, error: "rate_limited" }, withNoStore({ status: 429, headers: { "retry-after": String(retryAfterSeconds(rateKey)) } }));
  recordAttempt(rateKey);
  const chat = await createChat(name, email, message);
  return NextResponse.json({ ok: true, chat }, withNoStore({ status: 201 }));
}
