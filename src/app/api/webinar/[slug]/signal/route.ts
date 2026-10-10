/**
 * Authenticated, HTTP-polling WebRTC signaling for small live classes.
 * Room state is process-local; configure an SFU/Redis-backed signaling service for multi-instance scale.
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { getAdminSession, getSession } from "@/lib/auth";
import { withNoStore } from "@/lib/http";
import { clientIp, recordAttempt, retryAfterSeconds, tooManyAttempts } from "@/lib/rate-limit";
import { getContent, getContentWithEtag, saveContent } from "@/lib/data/store";
import { createReservation, getAllReservations } from "@/lib/data/reservations";
import { effectiveLiveStatus, hasGrantedReservation, isFreePrice, safeExternalHttpsUrl } from "@/lib/academy-live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface IceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}
interface ViewerState {
  answer: RTCSessionDescriptionInit | null;
  iceCandidates: IceCandidate[];
  lastSeen: number;
}
export interface ChatMessage {
  id: string;
  viewerId: string;
  name: string;
  text: string;
  ts: number;
}
export interface QAQuestion {
  id: string;
  viewerId: string;
  name: string;
  question: string;
  answered: boolean;
  ts: number;
}
export interface Attendee {
  viewerId: string;
  name: string;
  email: string;
  joinedAt: number;
  lastSeen: number;
}
interface Room {
  /** One peer-to-peer offer per viewer; a single shared SDP offer breaks two-or-more viewers. */
  offers: Map<string, RTCSessionDescriptionInit>;
  broadcasterIce: Map<string, IceCandidate[]>;
  viewers: Map<string, ViewerState>;
  broadcasterCursor: Map<string, number>;
  chat: ChatMessage[];
  qa: QAQuestion[];
  attendees: Map<string, Attendee>;
  status: "scheduled" | "live" | "ended";
  createdAt: number;
}

const rooms = new Map<string, Room>();
const VIEWER_ID_PATTERN = /^v-[a-zA-Z0-9_-]{8,100}$/;
const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function getOrCreateRoom(slug: string): Room {
  let room = rooms.get(slug);
  if (!room) {
    room = {
      offers: new Map(),
      broadcasterIce: new Map(),
      viewers: new Map(),
      broadcasterCursor: new Map(),
      chat: [],
      qa: [],
      attendees: new Map(),
      status: "scheduled",
      createdAt: Date.now(),
    };
    rooms.set(slug, room);
  }
  return room;
}

function pruneRooms() {
  const cutoff = Date.now() - 12 * 60 * 60 * 1000;
  for (const [slug, room] of rooms) if (room.createdAt < cutoff) rooms.delete(slug);
}

function error(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, withNoStore({ status }));
}

async function getLiveEvent(slug: string) {
  const content = await getContent();
  const event = content.education.find((item) => item.slug === slug && (item.type === "workshop" || item.type === "webinar"));
  return event?.liveEvent ? { item: event, config: event.liveEvent } : null;
}

async function persistLiveEventStatus(slug: string, status: "live" | "ended") {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [content, etag] = await getContentWithEtag();
    let found = false;
    const education = content.education.map((item) => {
      if (item.slug !== slug || (item.type !== "workshop" && item.type !== "webinar") || !item.liveEvent) return item;
      found = true;
      if (status === "live") {
        if (!item.liveEvent.isOnline) throw new Error("event_not_online");
        if (item.liveEvent.webinarStream?.source === "external") throw new Error("external_stream_configured");
        const effective = effectiveLiveStatus(item.liveEvent);
        if (effective === "ended" || effective === "cancelled") throw new Error("event_closed");
      }
      return { ...item, liveEvent: { ...item.liveEvent, status } };
    });
    if (!found) throw new Error("event_not_found");
    try {
      await saveContent({ ...content, education }, etag);
      return;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "etag_conflict" || attempt === 1) throw error;
    }
  }
}

function attendeeFor(room: Room, viewerId: string) {
  const attendee = room.attendees.get(viewerId);
  if (attendee) {
    attendee.lastSeen = Date.now();
    const viewer = room.viewers.get(viewerId);
    if (viewer) viewer.lastSeen = Date.now();
  }
  return attendee;
}

function pruneInactiveAttendees(room: Room) {
  const cutoff = Date.now() - 2 * 60 * 1000;
  for (const [viewerId, attendee] of room.attendees) {
    if (attendee.lastSeen >= cutoff) continue;
    room.attendees.delete(viewerId);
    room.viewers.delete(viewerId);
    room.offers.delete(viewerId);
    room.broadcasterIce.delete(viewerId);
    room.broadcasterCursor.delete(viewerId);
  }
}

function validIceCandidate(value: unknown): value is IceCandidate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<IceCandidate>;
  return typeof candidate.candidate === "string" && candidate.candidate.length <= 2048
    && (candidate.sdpMid === null || typeof candidate.sdpMid === "string")
    && (candidate.sdpMLineIndex === null || Number.isInteger(candidate.sdpMLineIndex));
}

async function iceServersResponse(request: Request, slug: string) {
  const url = new URL(request.url);
  const viewerId = url.searchParams.get("viewerId") ?? "";
  const client = url.searchParams.get("client");
  const session = await getAdminSession();
  if (client === "broadcaster") {
    if (!session || session.role !== "admin") return error("unauthorized", 401);
  } else {
    const room = rooms.get(slug);
    if (!VIEWER_ID_PATTERN.test(viewerId) || !room || !attendeeFor(room, viewerId)) return error("attendee_required", 401);
  }

  const urls = (process.env.TURN_URLS ?? "").split(",").map((value) => value.trim()).filter((value) => /^turns?:/i.test(value));
  const sharedSecret = process.env.TURN_SHARED_SECRET;
  const iceServers: RTCIceServer[] = [...STUN_SERVERS];
  if (urls.length && sharedSecret) {
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    const username = `${expiresAt}:${client === "broadcaster" ? session!.id : viewerId}`;
    const credential = crypto.createHmac("sha1", sharedSecret).update(username).digest("base64");
    iceServers.push({ urls, username, credential });
  }
  return NextResponse.json({ ok: true, iceServers, turnConfigured: iceServers.length > STUN_SERVERS.length }, withNoStore());
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(request.url);
  const role = url.searchParams.get("role");
  const room = rooms.get(slug);

  if (role === "ice") return iceServersResponse(request, slug);

  if (role === "event") {
    const found = await getLiveEvent(slug);
    if (!found) return error("event_not_found", 404);
    const configuredStatus = effectiveLiveStatus(found.config);
    const status = room?.status === "ended" || configuredStatus === "ended" || configuredStatus === "cancelled"
      ? "ended"
      : room?.status === "live" || configuredStatus === "live" ? "live" : "scheduled";
    return NextResponse.json({ status }, withNoStore());
  }

  if (role === "viewer") {
    const viewerId = url.searchParams.get("viewerId") ?? "";
    if (!VIEWER_ID_PATTERN.test(viewerId) || !room || !attendeeFor(room, viewerId)) return error("attendee_required", 401);
    const found = await getLiveEvent(slug);
    if (!found) return error("event_not_found", 404);
    const configuredStatus = effectiveLiveStatus(found.config);
    const status = room.status === "ended" || configuredStatus === "ended" || configuredStatus === "cancelled"
      ? "ended"
      : room.status === "live" || configuredStatus === "live" ? "live" : "scheduled";
    if (status === "ended") {
      return NextResponse.json({ status: "ended", offer: null, broadcasterIce: [], chat: [], qa: [] }, withNoStore());
    }
    const reservationCount = (await getAllReservations()).filter(
      (reservation) => reservation.eventSlug === slug && reservation.status !== "cancelled",
    ).length;
    return NextResponse.json({
      status,
      offer: room.offers.get(viewerId) ?? null,
      broadcasterIce: room.broadcasterIce.get(viewerId) ?? [],
      reservationCount,
      chat: found?.config.webinarStream?.chatEnabled === false ? [] : room.chat.slice(-50),
      qa: found?.config.webinarStream?.qaEnabled === false ? [] : room.qa.slice(-100),
    }, withNoStore());
  }

  if (role === "broadcaster") {
    const session = await getAdminSession();
    if (!session || session.role !== "admin") return error("unauthorized", 401);
    if (!room) return NextResponse.json({ viewers: [], attendees: [], status: "scheduled", chat: [], qa: [] }, withNoStore());
    pruneInactiveAttendees(room);

    const viewers: { viewerId: string; answer: RTCSessionDescriptionInit | null; newIce: IceCandidate[] }[] = [];
    for (const [viewerId, state] of room.viewers) {
      const cursor = room.broadcasterCursor.get(viewerId) ?? 0;
      const newIce = state.iceCandidates.slice(cursor);
      room.broadcasterCursor.set(viewerId, state.iceCandidates.length);
      viewers.push({ viewerId, answer: state.answer, newIce });
    }
    return NextResponse.json({ viewers, status: room.status, chat: room.chat.slice(-50), qa: room.qa.slice(-100), attendees: [...room.attendees.values()] }, withNoStore());
  }

  return error("missing_or_invalid_role", 400);
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  pruneRooms();
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 512 * 1024) return error("payload_too_large", 413);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return error("invalid_json", 400);
  }
  const type = typeof body.type === "string" ? body.type : "";
  if (type === "register") {
    const key = `academy-enroll:${clientIp(request)}`;
    if (tooManyAttempts(key)) {
      const response = error("too_many_attempts", 429);
      const retryAfter = retryAfterSeconds(key);
      if (retryAfter > 0) response.headers.set("Retry-After", String(retryAfter));
      return response;
    }
    recordAttempt(key);
  }

  if (["offer", "ice-broadcaster", "end", "start"].includes(type)) {
    const session = await getAdminSession();
    if (!session || session.role !== "admin") return error("unauthorized", 401);
    const found = await getLiveEvent(slug);
    if (!found) return error("event_not_found", 404);
    const room = getOrCreateRoom(slug);

    if (type === "start") {
      const status = effectiveLiveStatus(found.config);
      if (status === "ended" || status === "cancelled") return error("event_closed", 409);
      if (!found.config.isOnline) return error("event_not_online", 409);
      if (found.config.webinarStream?.source === "external") return error("external_stream_configured", 409);
      try {
        await persistLiveEventStatus(slug, "live");
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "";
        if (message === "event_closed" || message === "event_not_online" || message === "external_stream_configured") return error(message, 409);
        console.error("[webinar/start] failed to persist live status:", cause);
        return error("event_status_unavailable", 503);
      }
      room.status = "live";
      return NextResponse.json({ ok: true }, withNoStore());
    }
    if (type === "end") {
      room.status = "ended";
      try {
        await persistLiveEventStatus(slug, "ended");
      } catch (cause) {
        console.error("[webinar/end] failed to persist ended status:", cause);
        return error("event_status_unavailable", 503);
      }
      return NextResponse.json({ ok: true }, withNoStore());
    }

    const viewerId = typeof body.viewerId === "string" ? body.viewerId : "";
    if (!VIEWER_ID_PATTERN.test(viewerId) || !room.attendees.has(viewerId)) return error("attendee_required", 401);
    if (room.status !== "live") return error("broadcast_not_live", 409);

    if (type === "offer") {
      const sdp = body.sdp as RTCSessionDescriptionInit | undefined;
      if (!sdp || sdp.type !== "offer" || typeof sdp.sdp !== "string" || sdp.sdp.length > 200_000) return error("invalid_offer", 400);
      room.offers.set(viewerId, sdp);
      room.broadcasterIce.set(viewerId, room.broadcasterIce.get(viewerId) ?? []);
      return NextResponse.json({ ok: true }, withNoStore());
    }
    if (type === "ice-broadcaster") {
      if (!validIceCandidate(body.candidate)) return error("invalid_candidate", 400);
      const candidates = room.broadcasterIce.get(viewerId) ?? [];
      candidates.push(body.candidate);
      if (candidates.length > 250) candidates.splice(0, candidates.length - 250);
      room.broadcasterIce.set(viewerId, candidates);
      return NextResponse.json({ ok: true }, withNoStore());
    }
  }

  if (type === "qa-answer") {
    const session = await getAdminSession();
    if (!session || session.role !== "admin") return error("unauthorized", 401);
    const questionId = typeof body.questionId === "string" ? body.questionId : "";
    if (!/^q-[a-f0-9]{16}$/.test(questionId)) return error("invalid_question_id", 400);
    const room = rooms.get(slug);
    const question = room?.qa.find((entry) => entry.id === questionId);
    if (!question) return error("question_not_found", 404);
    question.answered = true;
    return NextResponse.json({ ok: true }, withNoStore());
  }

  if (["register", "join", "answer", "ice-viewer", "chat", "qa"].includes(type)) {
    const viewerId = typeof body.viewerId === "string" ? body.viewerId : "";
    if (!VIEWER_ID_PATTERN.test(viewerId)) return error("invalid_viewer_id", 400);
    const room = getOrCreateRoom(slug);

    if (type === "register") {
      pruneInactiveAttendees(room);
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      const submittedEmail = typeof body.email === "string" ? body.email.trim().slice(0, 200).toLowerCase() : "";
      if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submittedEmail)) return error("invalid_attendee", 400);

      const found = await getLiveEvent(slug);
      if (!found) return error("event_not_found", 404);
      const { item, config } = found;
      const status = effectiveLiveStatus(config);
      if (status === "ended" || status === "cancelled") return error("event_closed", 409);
      if (!config.isOnline) return error("event_not_online", 409);

      const session = await getSession();
      const reservations = await getAllReservations();
      const free = isFreePrice(item.price);
      const approved = hasGrantedReservation(reservations, slug, session);
      if (!free && !approved) return error(session ? "payment_pending" : "sign_in_required", 403);
      const externalJoinUrl = item.type === "workshop" && config.webinarStream?.source === "external"
        ? safeExternalHttpsUrl(config.meetLink)
        : null;
      if (item.type === "workshop" && config.webinarStream?.source === "external" && !externalJoinUrl) {
        return error("meeting_unavailable", 503);
      }

      const existing = room.attendees.get(viewerId);
      const maxViewers = config.webinarStream?.maxViewers ?? 0;
      if (!existing && maxViewers > 0 && room.attendees.size >= maxViewers) return error("viewer_limit", 409);
      if (room.status === "ended") return error("event_closed", 409);

      const attendeeEmail = session?.email.trim().toLowerCase() ?? submittedEmail;
      try {
        await createReservation({
          eventSlug: slug,
          eventType: item.type as "workshop" | "webinar",
          eventTitle: item.title,
          startsAt: config.startsAt,
          capacity: config.capacity,
          userId: session?.id,
          name,
          email: attendeeEmail,
          accessGranted: free,
          paymentRequired: !free,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "event_full") return error("event_full", 409);
        throw err;
      }

      const current = room.attendees.get(viewerId);
      room.attendees.set(viewerId, {
        viewerId,
        name,
        email: attendeeEmail,
        joinedAt: current?.joinedAt ?? Date.now(),
        lastSeen: Date.now(),
      });

      // Only return a private external meeting URL after the entitlement check above.
      if (externalJoinUrl) {
        return NextResponse.json({ ok: true, joinUrl: externalJoinUrl.href }, withNoStore());
      }
      return NextResponse.json({ ok: true }, withNoStore());
    }

    if (!room.attendees.has(viewerId)) return error("attendee_required", 401);
    if (room.status === "ended") return error("event_closed", 409);

    if (type === "join") {
      room.viewers.set(viewerId, room.viewers.get(viewerId) ?? { answer: null, iceCandidates: [], lastSeen: Date.now() });
      const state = room.viewers.get(viewerId)!;
      state.lastSeen = Date.now();
      return NextResponse.json({ ok: true }, withNoStore());
    }
    if (type === "answer") {
      const sdp = body.sdp as RTCSessionDescriptionInit | undefined;
      if (!sdp || sdp.type !== "answer" || typeof sdp.sdp !== "string" || sdp.sdp.length > 200_000) return error("invalid_answer", 400);
      const state = room.viewers.get(viewerId);
      if (!state) return error("join_required", 409);
      state.answer = sdp;
      state.lastSeen = Date.now();
      return NextResponse.json({ ok: true }, withNoStore());
    }
    if (type === "ice-viewer") {
      if (!validIceCandidate(body.candidate)) return error("invalid_candidate", 400);
      const state = room.viewers.get(viewerId);
      if (!state) return error("join_required", 409);
      state.iceCandidates.push(body.candidate);
      if (state.iceCandidates.length > 250) state.iceCandidates.splice(0, state.iceCandidates.length - 250);
      state.lastSeen = Date.now();
      return NextResponse.json({ ok: true }, withNoStore());
    }
    if (type === "chat") {
      const event = await getLiveEvent(slug);
      if (!event) return error("event_not_found", 404);
      if (event.config.webinarStream?.chatEnabled === false) return error("chat_disabled", 409);
      const rateKey = `chat-message:${slug}:${viewerId}`;
      if (tooManyAttempts(rateKey)) return error("too_many_messages", 429);
      recordAttempt(rateKey);
      const text = typeof body.text === "string" ? body.text.trim().slice(0, 300) : "";
      if (!text) return error("empty_message", 400);
      room.chat.push({ id: `c-${crypto.randomBytes(8).toString("hex")}`, viewerId, name: room.attendees.get(viewerId)!.name, text, ts: Date.now() });
      if (room.chat.length > 200) room.chat.splice(0, room.chat.length - 200);
      return NextResponse.json({ ok: true }, withNoStore());
    }
    if (type === "qa") {
      const event = await getLiveEvent(slug);
      if (!event) return error("event_not_found", 404);
      if (event.config.webinarStream?.qaEnabled === false) return error("qa_disabled", 409);
      const rateKey = `chat-message:${slug}:${viewerId}`;
      if (tooManyAttempts(rateKey)) return error("too_many_messages", 429);
      recordAttempt(rateKey);
      const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
      if (!question) return error("empty_question", 400);
      room.qa.push({ id: `q-${crypto.randomBytes(8).toString("hex")}`, viewerId, name: room.attendees.get(viewerId)!.name, question, answered: false, ts: Date.now() });
      if (room.qa.length > 300) room.qa.splice(0, room.qa.length - 300);
      return NextResponse.json({ ok: true }, withNoStore());
    }
  }

  return error("unknown_type", 400);
}
