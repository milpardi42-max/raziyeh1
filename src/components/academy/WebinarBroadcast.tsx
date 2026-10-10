"use client";

/**
 * WebinarBroadcast — Admin-side live broadcast room.
 *
 * Architecture (SFU-lite over HTTP polling):
 *   1. Admin clicks "شروع پخش" → getUserMedia → createOffer → POST offer
 *   2. Every 2 s: GET ?role=broadcaster → process viewer answers → addIceCandidate
 *   3. ICE candidates gathered locally → POST ice-broadcaster
 *   4. Chat / Q&A displayed + admin can mark Q&A as answered
 *   5. Admin clicks "پایان پخش" → POST end
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Mic,
  MicOff,
  MonitorPlay,
  PhoneOff,
  Radio,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { WebinarAttendeesPanel } from "@/components/admin/WebinarAttendeesPanel";

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

type BroadcastStatus = "idle" | "starting" | "live" | "ended" | "error";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function broadcastErrorMessage(error: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "برای روشن کردن دوربین، صفحه باید با HTTPS باز شود.";
  }
  const name = error && typeof error === "object" && "name" in error
    ? String((error as { name?: unknown }).name ?? "")
    : "";
  const message = error instanceof Error ? error.message : "";

  if (message === "event_closed") return "این رویداد پایان‌یافته یا لغوشده است؛ یک رویداد آینده را انتخاب کنید.";
  if (message === "event_not_online") return "این رویداد به‌صورت آنلاین تنظیم نشده است؛ تنظیمات آکادمی را بررسی کنید.";
  if (message === "external_stream_configured") return "این رویداد از سرویس خارجی پخش می‌شود؛ لینک همان سرویس را باز کنید.";
  if (message === "event_status_unavailable") return "ذخیره وضعیت رویداد انجام نشد؛ اتصال سرور را بررسی کنید و دوباره تلاش کنید.";
  if (message === "unauthorized") return "نشست مدیر معتبر نیست؛ دوباره وارد پنل مدیریت شوید و تلاش کنید.";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "اجازهٔ دوربین یا میکروفون داده نشد. از تنظیمات مجوز سایت، دسترسی Camera و Microphone را فعال و دوباره تلاش کنید.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "دوربین یا میکروفونی پیدا نشد. دستگاه را وصل کنید و دوباره تلاش کنید.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "دوربین یا میکروفون در برنامهٔ دیگری مشغول است. آن برنامه را ببندید و دوباره تلاش کنید.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "تنظیمات دوربین این دستگاه پشتیبانی نمی‌شود؛ دوربین پیش‌فرض دستگاه را انتخاب کنید.";
  }
  if (message === "media_api_unsupported" || message === "webrtc_unsupported") {
    return "این مرورگر از پخش زنده پشتیبانی نمی‌کند. از نسخهٔ جدید Chrome, Edge یا Safari استفاده کنید.";
  }
  if (message.startsWith("signal_") || message === "Failed to fetch") {
    return "اتصال پخش برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.";
  }
  return "دسترسی به دوربین برقرار نشد. مجوزها و اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.";
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function WebinarBroadcast({ slug, title }: { slug: string; title: string }) {
  const [status, setStatus] = useState<BroadcastStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [qa, setQa] = useState<QAQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<"chat" | "qa">("chat");
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [turnConfigured, setTurnConfigured] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);
  // Map viewerId → RTCPeerConnection
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track which viewer answers we've already processed
  const processedAnswersRef = useRef<Set<string>>(new Set());
  const liveRef = useRef(false);
  const endBroadcastRef = useRef<() => Promise<void>>(async () => undefined);
  useEffect(() => { liveRef.current = status === "live"; }, [status]);

  const signalUrl = `/api/webinar/${encodeURIComponent(slug)}/signal`;
  const attendeeUrl = typeof window !== "undefined"
    ? `${window.location.origin}/fa/academy/${slug}/live`
    : `/fa/academy/${slug}/live`;

  const copyAttendeeLink = async () => {
    setShareError(false);
    try {
      await navigator.clipboard.writeText(attendeeUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2500);
    } catch {
      setShareError(true);
    }
  };

  /* ── helpers ─────────────────────────────────────────────────── */

  async function postSignal(body: Record<string, unknown>) {
    const res = await fetch(signalUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null) as { error?: unknown } | null;
    if (!res.ok) {
      throw new Error(typeof payload?.error === "string" ? payload.error : `signal_${res.status}`);
    }
    return payload ?? {};
  }

  async function loadIceServers() {
    try {
      const response = await fetch(`${signalUrl}?role=ice&client=broadcaster`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("ice_configuration_unavailable");
      const data = await response.json() as { iceServers?: RTCIceServer[]; turnConfigured?: boolean };
      iceServersRef.current = data.iceServers?.length ? data.iceServers : DEFAULT_ICE_SERVERS;
      setTurnConfigured(Boolean(data.turnConfigured));
    } catch {
      iceServersRef.current = DEFAULT_ICE_SERVERS;
      setTurnConfigured(false);
    }
  }

  const createPcForViewer = useCallback(
    (viewerId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

      // Add local tracks
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          pc.addTrack(track, streamRef.current);
        }
      }

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          postSignal({
            type: "ice-broadcaster",
            viewerId,
            candidate: {
              candidate: ev.candidate.candidate,
              sdpMid: ev.candidate.sdpMid,
              sdpMLineIndex: ev.candidate.sdpMLineIndex,
            },
          }).catch(console.error);
        }
      };

      pcsRef.current.set(viewerId, pc);
      return pc;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* ── poll broadcaster endpoint ───────────────────────────────── */

  const pollBroadcaster = useCallback(async () => {
    try {
      const res = await fetch(`${signalUrl}?role=broadcaster`, { credentials: "include", cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as {
        viewers: { viewerId: string; answer: RTCSessionDescriptionInit | null; newIce: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }[] }[];
        status: string;
        chat: ChatMessage[];
        qa: QAQuestion[];
      };

      if (data.status === "ended") {
        void endBroadcastRef.current();
        return;
      }

      setViewerCount(data.viewers.length);
      setChat(data.chat ?? []);
      setQa(data.qa ?? []);

      for (const v of data.viewers) {
        let pc = pcsRef.current.get(v.viewerId);

        // New viewer joined — create PC + offer
        if (!pc) {
          pc = createPcForViewer(v.viewerId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await postSignal({ type: "offer", sdp: pc.localDescription, viewerId: v.viewerId });
        }

        // Process their answer (once)
        if (v.answer && !processedAnswersRef.current.has(v.viewerId) && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(v.answer));
          processedAnswersRef.current.add(v.viewerId);
        }

        // Add new ICE from viewer
        for (const ice of v.newIce ?? []) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(ice));
          } catch { /* ignore stale candidates */ }
        }
      }
    } catch (e) {
      console.error("[broadcast poll]", e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createPcForViewer, slug]);

  /* ── start broadcast ─────────────────────────────────────────── */

  const startBroadcast = useCallback(async () => {
    setStatus("starting");
    setError(null);
    let stream: MediaStream | null = null;
    let startRequested = false;
    try {
      if (!window.isSecureContext) throw new Error("https_required");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("media_api_unsupported");
      if (!("RTCPeerConnection" in window)) throw new Error("webrtc_unsupported");

      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      for (const track of stream.getTracks()) {
        track.onended = () => { void endBroadcastRef.current(); };
      }

      // Start the browser permission prompt immediately from the button gesture;
      // load optional ICE settings only after the camera is available.
      await loadIceServers();
      await postSignal({ type: "start" });
      startRequested = true;
      liveRef.current = true;
      setStatus("live");
      pollTimerRef.current = setInterval(pollBroadcaster, 2000);
      void pollBroadcaster();
    } catch (e) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (startRequested) await postSignal({ type: "end" }).catch(() => undefined);
      if (stream) {
        for (const track of stream.getTracks()) {
          track.onended = null;
          track.stop();
        }
      }
      if (streamRef.current === stream) streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setStatus("error");
      setError(broadcastErrorMessage(e));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollBroadcaster]);

  /* ── end broadcast ───────────────────────────────────────────── */

  const endBroadcast = useCallback(async () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
    liveRef.current = false;

    // Stop the camera immediately on click, even if the network is slow.
    for (const pc of pcsRef.current.values()) pc.close();
    pcsRef.current.clear();
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.onended = null;
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("ended");

    try {
      await postSignal({ type: "end" });
    } catch (error) {
      setError(broadcastErrorMessage(error));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  useEffect(() => { endBroadcastRef.current = endBroadcast; }, [endBroadcast]);

  /* ── audio / video toggle ────────────────────────────────────── */

  const toggleAudio = useCallback(() => {
    if (!streamRef.current) return;
    for (const t of streamRef.current.getAudioTracks()) {
      t.enabled = !t.enabled;
    }
    setAudioOn((v) => !v);
  }, []);

  const toggleVideo = useCallback(() => {
    if (!streamRef.current) return;
    for (const t of streamRef.current.getVideoTracks()) {
      t.enabled = !t.enabled;
    }
    setVideoOn((v) => !v);
  }, []);

  /* ── cleanup on unmount ──────────────────────────────────────── */

  useEffect(() => {
    const peerConnections = pcsRef.current;
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (liveRef.current) {
        void fetch(signalUrl, {
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "end" }),
        }).catch(() => undefined);
      }
      for (const pc of peerConnections.values()) pc.close();
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.onended = null;
          track.stop();
        }
      }
    };
  }, [signalUrl]);

  /* ── answer Q&A ──────────────────────────────────────────────── */

  const markAnswered = async (id: string) => {
    try {
      await postSignal({ type: "qa-answer", questionId: id });
      setQa((prev) => prev.map((question) => question.id === id ? { ...question, answered: true } : question));
    } catch {
      setError("ثبت وضعیت پاسخ پرسش انجام نشد؛ دوباره تلاش کنید.");
    }
  };

  /* ─── render ─────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col" dir="rtl">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <MonitorPlay className="w-5 h-5 text-rose-400" />
          <div className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="font-bold text-base">کنترل پخش زنده</span>
            <span className="truncate text-xs text-zinc-400">{title}</span>
          </div>
          {status === "live" && (
            <span className="flex items-center gap-1.5 text-xs font-semibold bg-red-600 text-white px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <button
            onClick={() => setAttendeesOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{viewerCount} بیننده</span>
            <span className="text-zinc-600">·</span>
            <span className="text-accent">مشاهده لیست</span>
          </button>
        </div>
      </div>
      <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-3 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/70 p-3">
            <p className="text-sm font-bold text-white">شروع خیلی ساده</p>
            <ol className="mt-1 grid gap-1 text-xs leading-5 text-zinc-300 sm:grid-cols-3">
              <li>۱. دکمهٔ قرمز را بزنید.</li>
              <li>۲. اجازهٔ دوربین و میکروفن را بدهید.</li>
              <li>۳. لینک مهمان‌ها را بفرستید.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-emerald-100">لینک ورود مهمان‌ها</p>
                <p className="text-[11px] text-emerald-200/70">این لینک را برای شرکت‌کنندگان بفرستید.</p>
              </div>
              <button
                type="button"
                onClick={copyAttendeeLink}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
              >
                {shareCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {shareCopied ? "کپی شد" : "کپی لینک"}
              </button>
            </div>
            <code dir="ltr" className="mt-2 block break-all rounded bg-black/20 px-2 py-1.5 text-left text-[11px] text-emerald-100">{attendeeUrl}</code>
            <p className="mt-1 text-[11px] leading-5 text-amber-200">
              برای مهمان‌های بیرون از این دستگاه، سایت باید روی اینترنت و HTTPS باشد؛ لینک localhost فقط روی همین رایانه باز می‌شود.
            </p>
            {shareError && <p role="alert" className="mt-1 text-xs text-amber-300">کپی خودکار نشد؛ لینک بالا را انتخاب و کپی کنید.</p>}
          </div>
        </div>
        <details className="mx-auto mt-2 max-w-5xl text-[11px] leading-5 text-zinc-500">
          <summary className="cursor-pointer">اطلاعات فنی پخش</summary>
          <p className="mt-1">
            این پخش مستقیم برای کلاس‌های کوچک است؛ ممکن است بعضی شبکه‌ها بدون TURN وصل نشوند و برای تعداد زیاد بیننده به زیرساخت پخش جداگانه نیاز است.
          </p>
        </details>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Video preview ── */}
        <div className="flex-1 flex flex-col">
          <div className="relative flex-1 bg-black flex items-center justify-center">
            {status === "idle" || status === "starting" ? (
              <div className="text-center space-y-4">
                {status === "idle" ? (
                  <>
                    <Radio className="w-16 h-16 mx-auto text-zinc-600" />
                    <div className="space-y-2">
                      <p className="text-zinc-200 font-medium">برای شروع، دکمهٔ قرمز پایین را بزنید و اجازهٔ دوربین و میکروفون را بدهید.</p>
                      <p className="text-xs text-zinc-500">این صفحه را تا پایان کلاس باز نگه دارید.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-zinc-400">در حال آماده‌سازی دوربین…</p>
                  </>
                )}
              </div>
            ) : status === "ended" ? (
              <div className="text-center space-y-3">
                <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500" />
                <p className="text-zinc-300 font-semibold">پخش پایان یافت</p>
                {error && <p className="max-w-lg text-xs text-amber-300">{error}</p>}
              </div>
            ) : status === "error" ? (
              <div className="text-center space-y-3 px-6">
                <AlertCircle className="w-14 h-14 mx-auto text-red-500" />
                <p className="text-red-400">{error}</p>
                <Button variant="outline" size="sm" onClick={() => { setStatus("idle"); setError(null); }}>
                  تلاش مجدد
                </Button>
              </div>
            ) : null}

            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-opacity",
                status === "live" || status === "starting" ? "opacity-100" : "opacity-0"
              )}
            />

            {/* Camera/mic indicator overlay */}
            {status === "live" && (
              <div className="absolute bottom-4 right-4 flex gap-2">
                <span className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium",
                  audioOn ? "bg-zinc-800/80 text-zinc-200" : "bg-red-900/80 text-red-300")}>
                  {audioOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                </span>
                <span className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium",
                  videoOn ? "bg-zinc-800/80 text-zinc-200" : "bg-red-900/80 text-red-300")}>
                  {videoOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
                </span>
              </div>
            )}
          </div>

          {/* Controls bar */}
          <div className="bg-zinc-900 border-t border-zinc-800 px-6 py-4 flex items-center justify-center gap-4">
            {status === "idle" || status === "error" ? (
              <Button
                onClick={startBroadcast}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-base font-semibold rounded-xl"
              >
                <Radio className="w-5 h-5 ml-2" />
                روشن کردن دوربین و شروع پخش
              </Button>
            ) : status === "starting" ? (
              <Button disabled className="px-8 py-3 text-base">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2 inline-block" />
                در حال اتصال…
              </Button>
            ) : status === "live" ? (
              <>
                <button
                  onClick={toggleAudio}
                  aria-label={audioOn ? "خاموش کردن میکروفون" : "روشن کردن میکروفون"}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                    audioOn ? "bg-zinc-700 hover:bg-zinc-600" : "bg-red-700 hover:bg-red-600"
                  )}
                  title={audioOn ? "خاموش کردن میکروفون" : "روشن کردن میکروفون"}
                >
                  {audioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  <span className="sr-only">{audioOn ? "میکروفون روشن" : "میکروفون خاموش"}</span>
                </button>
                <button
                  onClick={toggleVideo}
                  aria-label={videoOn ? "خاموش کردن دوربین" : "روشن کردن دوربین"}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                    videoOn ? "bg-zinc-700 hover:bg-zinc-600" : "bg-red-700 hover:bg-red-600"
                  )}
                  title={videoOn ? "خاموش کردن دوربین" : "روشن کردن دوربین"}
                >
                  {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("پخش را تمام کنیم؟ شرکت‌کنندگان دیگر تصویر زنده را نمی‌بینند.")) {
                      void endBroadcast();
                    }
                  }}
                  aria-label="پایان پخش"
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-red-700 px-5 font-semibold hover:bg-red-600"
                  title="پایان پخش"
                >
                  <PhoneOff className="w-5 h-5" />
                  <span>پایان پخش</span>
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* ── Side panel (chat + Q&A) ── */}
        {status === "live" && (
          <div className="w-80 flex flex-col bg-zinc-900 border-r border-zinc-800">
            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
              {(["chat", "qa"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-3 text-sm font-medium transition-colors",
                    activeTab === tab
                      ? "text-white border-b-2 border-rose-500"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {tab === "chat" ? "چت" : `سؤالات (${qa.filter(q => !q.answered).length})`}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
              {activeTab === "chat" ? (
                chat.length === 0 ? (
                  <p className="text-zinc-500 text-center mt-8">هنوز پیامی نیست</p>
                ) : (
                  chat.map((m) => (
                    <div key={m.id} className="space-y-0.5">
                      <span className="text-rose-400 font-medium text-xs">{m.name}</span>
                      <p className="text-zinc-200 bg-zinc-800 rounded-lg px-3 py-1.5">{m.text}</p>
                    </div>
                  ))
                )
              ) : (
                qa.length === 0 ? (
                  <p className="text-zinc-500 text-center mt-8">سؤالی ارسال نشده</p>
                ) : (
                  qa.map((q) => (
                    <div key={q.id} className={cn("rounded-lg p-3 space-y-2", q.answered ? "bg-zinc-800/40 opacity-60" : "bg-zinc-800")}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs text-rose-400 font-medium">{q.name}</span>
                          <p className="text-zinc-200 mt-0.5">{q.question}</p>
                        </div>
                        {!q.answered && (
                          <button
                            onClick={() => markAnswered(q.id)}
                            className="shrink-0 text-emerald-400 hover:text-emerald-300"
                            title="علامت‌گذاری به عنوان پاسخ داده شده"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {q.answered && (
                        <span className="text-xs text-emerald-500 font-medium">✓ پاسخ داده شد</span>
                      )}
                    </div>
                  ))
                )
              )}
            </div>

            {/* Read-only footer note */}
            <div className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-600 text-center">
              چت و سؤالات از بینندگان دریافت می‌شود
            </div>
          </div>
        )}
      </div>
      {/* Attendees panel modal */}
      {attendeesOpen && (
        <WebinarAttendeesPanel
          slug={slug}
          modal
          onClose={() => setAttendeesOpen(false)}
        />
      )}
    </div>
  );
}
