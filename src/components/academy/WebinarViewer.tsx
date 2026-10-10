"use client";

/**
 * WebinarViewer — Public-facing live-watch room.
 *
 * Flow:
 *   0. Show WebinarJoinGate — user enters name + email (or it's pre-filled from session)
 *   1. On join → POST register → transition to watching room
 *   2. Poll GET ?role=viewer&viewerId=xxx every 2 s
 *   3. When offer arrives → createAnswer → POST answer
 *   4. Exchange ICE candidates
 *   5. Remote stream appears in <video>
 *   6. Chat + Q&A via POST chat / POST qa
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  MessageCircle,
  Radio,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { WebinarJoinGate, type JoinIdentity } from "./WebinarJoinGate";

/* ─── types ─────────────────────────────────────────────────────── */

interface ChatMessage {
  id: string;
  viewerId: string;
  name: string;
  text: string;
  ts: number;
}

interface QAQuestion {
  id: string;
  viewerId: string;
  name: string;
  question: string;
  answered: boolean;
  ts: number;
}

type ViewerStatus = "waiting" | "connecting" | "watching" | "ended" | "error";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/* ─── Component ─────────────────────────────────────────────────── */

export default function WebinarViewer({
  slug,
  title,
  image = "",
  hostName,
  startsAt,
  durationMin,
  capacity,
  registeredCount,
  eventStatus = "live",
  chatEnabled = true,
  qaEnabled = true,
  requiresAccount = false,
  prefillName = "",
  prefillEmail = "",
  hlsUrl,
  locale = "fa",
}: {
  slug: string;
  title?: string;
  image?: string;
  hostName?: string;
  startsAt?: string;
  durationMin?: number;
  capacity?: number;
  registeredCount?: number;
  eventStatus?: "scheduled" | "live" | "ended" | "cancelled";
  chatEnabled?: boolean;
  qaEnabled?: boolean;
  requiresAccount?: boolean;
  prefillName?: string;
  prefillEmail?: string;
  /** Same-origin entitlement-checked HLS proxy; external HLS URLs are never passed to the browser. */
  hlsUrl?: string;
  locale?: "fa" | "en";
}) {
  const isFA = locale === "fa";

  /* ── Phase: "gate" → user hasn't joined yet; "room" → watching ── */
  const [phase, setPhase] = useState<"gate" | "room">("gate");
  const [identity, setIdentity] = useState<JoinIdentity | null>(null);

  const [status, setStatus] = useState<ViewerStatus>("waiting");
  const [activeEventStatus, setActiveEventStatus] = useState(eventStatus);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>(DEFAULT_ICE_SERVERS);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [qa, setQa] = useState<QAQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "qa">("chat");
  const [chatInput, setChatInput] = useState("");
  const [qaInput, setQaInput] = useState("");
  const [muted, setMuted] = useState(Boolean(hlsUrl));
  const [sideOpen, setSideOpen] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAnsweredRef = useRef(false);
  const iceAppliedCountRef = useRef(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const signalUrl = `/api/webinar/${encodeURIComponent(slug)}/signal`;

  // Keep the entry screen in sync when the host starts or ends the camera from the admin panel.
  useEffect(() => {
    if (phase !== "gate") return;
    let active = true;
    const refreshEventStatus = async () => {
      try {
        const response = await fetch(`${signalUrl}?role=event`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { status?: string };
        if (!active) return;
        if (data.status === "scheduled" || data.status === "live" || data.status === "ended" || data.status === "cancelled") {
          setActiveEventStatus(data.status);
        }
      } catch {
        // The initial server-rendered schedule remains usable if live status polling is unavailable.
      }
    };
    void refreshEventStatus();
    const timer = setInterval(() => void refreshEventStatus(), 5_000);
    return () => { active = false; clearInterval(timer); };
  }, [phase, signalUrl]);

  /* ── handle join from gate ───────────────────────────────────── */

  const handleJoin = (id: JoinIdentity) => {
    if (id.joinUrl) {
      try {
        const target = new URL(id.joinUrl);
        if (target.protocol !== "https:") throw new Error("unsafe meeting URL");
        window.location.assign(target.href);
      } catch {
        setError(isFA ? "لینک جلسه معتبر نیست." : "The meeting link is invalid.");
      }
      return;
    }
    setIdentity(id);
    setPhase("room");
  };

  /* ── signal helpers ──────────────────────────────────────────── */

  const postSignal = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(signalUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, viewerId: identity?.viewerId }),
    });
    if (!res.ok) throw new Error(`signal ${res.status}`);
    return res.json() as Promise<unknown>;
  }, [signalUrl, identity?.viewerId]);

  /* ── external HLS playback (same-origin proxy only) ─────────── */
  useEffect(() => {
    if (phase !== "room" || !hlsUrl || !identity || activeEventStatus !== "live") return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    const markPlaying = () => setStatus("watching");
    const markError = () => {
      setStatus("error");
      setError(isFA ? "پخش زنده در دسترس نیست. اتصال یا تنظیم استریم را بررسی کنید." : "The live stream is unavailable. Check the connection or stream settings.");
    };
    video.addEventListener("playing", markPlaying);
    video.addEventListener("error", markError);
    setStatus("connecting");

    void (async () => {
      try {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = hlsUrl;
          setStatus("watching");
          await video.play().catch(() => undefined);
          return;
        }
        const hlsModule = await import("hls.js");
        if (cancelled) return;
        const Hls = hlsModule.default;
        if (!Hls.isSupported()) {
          markError();
          return;
        }
        const player = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
        hls = player;
        player.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          setStatus("watching");
          void video.play().catch(() => undefined);
        });
        player.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) markError();
        });
        player.attachMedia(video);
        player.loadSource(hlsUrl);
      } catch {
        if (!cancelled) markError();
      }
    })();

    return () => {
      cancelled = true;
      video.removeEventListener("playing", markPlaying);
      video.removeEventListener("error", markError);
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [phase, hlsUrl, identity, activeEventStatus, isFA]);

  useEffect(() => {
    if (phase !== "room" || !identity || hlsUrl) return;
    let cancelled = false;
    void fetch(`${signalUrl}?role=ice&viewerId=${encodeURIComponent(identity.viewerId)}`, { credentials: "include", cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as { iceServers?: RTCIceServer[] } : null)
      .then((data) => { if (!cancelled && data?.iceServers?.length) setIceServers(data.iceServers); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [phase, identity, signalUrl, hlsUrl]);

  /* ── initial join signal once in room ───────────────────────── */

  useEffect(() => {
    if (phase !== "room" || !identity) return;
    void postSignal({ type: "join", name: identity.name }).catch(() => {
      setStatus("error");
      setError(isFA ? "اتصال ورود به اتاق برقرار نشد؛ صفحه را دوباره بارگذاری کنید." : "Could not join the live room. Please reload and try again.");
    });
  }, [phase, identity, postSignal, isFA]);

  /* ── poll viewer endpoint ────────────────────────────────────── */

  const pollViewer = useCallback(async () => {
    if (!identity) return;
    try {
      const res = await fetch(`${signalUrl}?role=viewer&viewerId=${identity.viewerId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          setStatus("error");
          setError(isFA ? "دسترسی این جلسه یا اتصال آن منقضی شده است. دوباره از صفحه رویداد وارد شوید." : "Session access or live-room connection expired. Rejoin from the event page.");
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        }
        return;
      }

      const data = await res.json() as {
        status: string;
        offer: RTCSessionDescriptionInit | null;
        broadcasterIce: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }[];
        chat: ChatMessage[];
        qa: QAQuestion[];
      };

      const resolvedStatus = data.status === "live" || data.status === "ended" || data.status === "cancelled" || data.status === "scheduled"
        ? data.status
        : eventStatus;
      setActiveEventStatus(resolvedStatus);
      if (resolvedStatus === "ended" || resolvedStatus === "cancelled") {
        setStatus("ended");
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        return;
      }

      setChat(data.chat ?? []);
      setQa(data.qa ?? []);
      if (hlsUrl) return;

      // Process offer (once)
      if (data.offer && !hasAnsweredRef.current) {
        hasAnsweredRef.current = true;
        setStatus("connecting");

        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            postSignal({
              type: "ice-viewer",
              candidate: {
                candidate: ev.candidate.candidate,
                sdpMid: ev.candidate.sdpMid,
                sdpMLineIndex: ev.candidate.sdpMLineIndex,
              },
            }).catch(console.error);
          }
        };

        pc.ontrack = (ev) => {
          if (videoRef.current && ev.streams[0]) {
            videoRef.current.srcObject = ev.streams[0];
            setStatus("watching");
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            setStatus("error");
            setError(isFA ? "اتصال قطع شد. لطفاً صفحه را بارگذاری مجدد کنید." : "Connection lost. Please reload.");
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await postSignal({ type: "answer", sdp: pc.localDescription });
      }

      // Apply new broadcaster ICE candidates
      const allIce = data.broadcasterIce ?? [];
      const newIce = allIce.slice(iceAppliedCountRef.current);
      if (newIce.length > 0 && pcRef.current) {
        for (const ice of newIce) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(ice));
          } catch { /* ignore stale */ }
        }
        iceAppliedCountRef.current += newIce.length;
      }
    } catch (e) {
      console.error("[viewer poll]", e);
    }
  }, [signalUrl, identity, postSignal, isFA, hlsUrl, eventStatus, iceServers]);

  /* ── lifecycle (start polling when in room) ──────────────────── */

  useEffect(() => {
    if (phase !== "room") return;
    pollTimerRef.current = setInterval(pollViewer, 2000);
    pollViewer();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (pcRef.current) pcRef.current.close();
    };
  }, [phase, pollViewer]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  /* ── send chat ───────────────────────────────────────────────── */

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    try {
      await postSignal({ type: "chat", name: identity?.name ?? "بیننده", text });
    } catch { /* best-effort */ }
  };

  /* ── send Q&A ────────────────────────────────────────────────── */

  const sendQA = async () => {
    const question = qaInput.trim();
    if (!question) return;
    setQaInput("");
    try {
      await postSignal({ type: "qa", name: identity?.name ?? "بیننده", question });
    } catch { /* best-effort */ }
  };

  const viewerId = identity?.viewerId ?? "";

  /* ─── GATE phase ─────────────────────────────────────────────── */

  if (phase === "gate") {
    return (
      <WebinarJoinGate
        slug={slug}
        title={title ?? "وبینار زنده"}
        image={image}
        hostName={hostName}
        startsAt={startsAt}
        durationMin={durationMin}
        capacity={capacity}
        registeredCount={registeredCount}
        chatEnabled={chatEnabled}
        requiresAccount={requiresAccount}
        status={activeEventStatus}
        prefillName={prefillName}
        prefillEmail={prefillEmail}
        onJoin={handleJoin}
        locale={locale}
      />
    );
  }

  /* ─── ROOM phase ─────────────────────────────────────────────── */

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden" dir={isFA ? "rtl" : "ltr"}>
      {/* ── Main video area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Radio className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold text-sm truncate">{title ?? (isFA ? "وبینار زنده" : "Live Webinar")}</span>
            {status === "watching" && (
              <span className="flex items-center gap-1 text-xs font-semibold bg-red-600 text-white px-2 py-0.5 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Viewer name chip */}
            {identity && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs text-white/60">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {identity.name}
              </span>
            )}
            <button
              onClick={() => setMuted((v) => !v)}
              className="text-zinc-400 hover:text-white transition-colors"
              title={muted ? (isFA ? "صدا را باز کن" : "Unmute") : (isFA ? "بی‌صدا" : "Mute")}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            {(chatEnabled || qaEnabled) && (
              <button
                onClick={() => setSideOpen((v) => !v)}
                className="text-zinc-400 hover:text-white transition-colors"
                title={isFA ? "باز/بستن پنل چت" : "Toggle chat"}
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Video */}
        <div className="relative flex-1 bg-black flex items-center justify-center">
          {status === "waiting" && (
            <div className="text-center space-y-4 px-6">
              <Radio className="w-14 h-14 mx-auto text-zinc-600 animate-pulse" />
              <p className="text-zinc-400 text-lg font-medium">
                {isFA ? "منتظر شروع پخش…" : "Waiting for broadcast…"}
              </p>
              <p className="text-zinc-600 text-sm">
                {isFA
                  ? "به محض شروع پخش توسط مدرس، ویدیو نمایش داده می‌شود"
                  : "The video will appear as soon as the host starts broadcasting"}
              </p>
            </div>
          )}

          {status === "connecting" && (
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-zinc-400">{isFA ? "در حال اتصال…" : "Connecting…"}</p>
            </div>
          )}

          {status === "ended" && (
            <div className="text-center space-y-4 px-6">
              <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />
              <p className="text-zinc-200 text-lg font-semibold">
                {isFA ? "پخش پایان یافت" : "Broadcast ended"}
              </p>
              <p className="text-zinc-500 text-sm">
                {isFA ? "از حضور شما در این وبینار متشکریم" : "Thank you for joining this webinar"}
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-4 px-6">
              <AlertCircle className="w-14 h-14 mx-auto text-red-500" />
              <p className="text-red-400">{error}</p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                {isFA ? "بارگذاری مجدد" : "Reload"}
              </Button>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            controls={Boolean(hlsUrl)}
            poster={image || undefined}
            muted={muted}
            className={cn(
              "absolute inset-0 w-full h-full object-contain transition-opacity",
              status === "watching" ? "opacity-100" : "opacity-0"
            )}
          />
        </div>
      </div>

      {/* ── Side panel ── */}
      {(chatEnabled || qaEnabled) && sideOpen && (
        <div className="w-72 xl:w-80 flex flex-col bg-zinc-900 border-s border-zinc-800 shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800 shrink-0">
            {chatEnabled && (
              <button
                onClick={() => setActiveTab("chat")}
                className={cn(
                  "flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                  activeTab === "chat"
                    ? "text-white border-b-2 border-rose-500"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {isFA ? "چت" : "Chat"}
              </button>
            )}
            {qaEnabled && (
              <button
                onClick={() => setActiveTab("qa")}
                className={cn(
                  "flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                  activeTab === "qa"
                    ? "text-white border-b-2 border-rose-500"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {isFA ? "سؤال" : "Q&A"}
                {qa.filter((q) => q.answered).length > 0 && (
                  <span className="text-xs bg-emerald-700 text-emerald-100 px-1 rounded">
                    {qa.filter((q) => q.answered).length}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {activeTab === "chat" ? (
              chat.length === 0 ? (
                <p className="text-zinc-600 text-center mt-10 text-xs">
                  {isFA ? "اولین پیام را بفرستید!" : "Send the first message!"}
                </p>
              ) : (
                <>
                  {chat.map((m) => (
                    <div key={m.id} className={cn("space-y-0.5", m.viewerId === viewerId && "text-left ltr")}>
                      <span className={cn(
                        "text-xs font-medium",
                        m.viewerId === viewerId ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {m.viewerId === viewerId ? (isFA ? "شما" : "You") : m.name}
                      </span>
                      <p className={cn(
                        "rounded-xl px-3 py-2 text-zinc-100 max-w-[90%]",
                        m.viewerId === viewerId
                          ? "bg-emerald-900/40 mr-auto"
                          : "bg-zinc-800"
                      )}>
                        {m.text}
                      </p>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </>
              )
            ) : (
              qa.length === 0 ? (
                <p className="text-zinc-600 text-center mt-10 text-xs">
                  {isFA ? "سؤال خود را بپرسید" : "Ask your question"}
                </p>
              ) : (
                qa.map((q) => (
                  <div key={q.id} className={cn(
                    "rounded-lg p-3 space-y-1.5 border text-sm",
                    q.answered
                      ? "bg-emerald-950/30 border-emerald-800/40"
                      : "bg-zinc-800 border-zinc-700"
                  )}>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-zinc-400">
                        {q.viewerId === viewerId ? (isFA ? "شما" : "You") : q.name}
                      </span>
                      {q.answered && (
                        <span className="text-xs text-emerald-400 font-medium flex items-center gap-0.5 ms-auto">
                          <CheckCircle2 className="w-3 h-3" />
                          {isFA ? "پاسخ داده شد" : "Answered"}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-200">{q.question}</p>
                  </div>
                ))
              )
            )}
          </div>

          {/* Input */}
          <div className="border-t border-zinc-800 p-3 shrink-0">
            {activeTab === "chat" ? (
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder={isFA ? "پیام بفرستید…" : "Send a message…"}
                  disabled={status !== "watching"}
                  className="flex-1 bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-zinc-700 focus:border-zinc-500 placeholder-zinc-600 disabled:opacity-40"
                  dir={isFA ? "rtl" : "ltr"}
                />
                <button
                  onClick={sendChat}
                  disabled={!chatInput.trim() || status !== "watching"}
                  className="w-9 h-9 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                >
                  <Send className="w-4 h-4 rotate-180" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={qaInput}
                  onChange={(e) => setQaInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendQA()}
                  placeholder={isFA ? "سؤال بپرسید…" : "Ask a question…"}
                  disabled={status !== "watching"}
                  className="flex-1 bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-zinc-700 focus:border-zinc-500 placeholder-zinc-600 disabled:opacity-40"
                  dir={isFA ? "rtl" : "ltr"}
                />
                <button
                  onClick={sendQA}
                  disabled={!qaInput.trim() || status !== "watching"}
                  className="w-9 h-9 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                >
                  <Send className="w-4 h-4 rotate-180" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
