"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { useLocale } from "@/components/providers/AppProviders";
import type { ChatConversation } from "@/lib/data/chats";

const STORAGE_KEY = "ra-live-chat-id";

export function LiveChatWidget() {
  const { locale } = useLocale();
  const fa = locale === "fa";
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<ChatConversation | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const refreshChat = useCallback(async (id: string, signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/chat?id=${encodeURIComponent(id)}`, { cache: "no-store", signal });
      if (!response.ok) {
        if (response.status === 404) {
          localStorage.removeItem(STORAGE_KEY);
          setChat(null);
        }
        return;
      }
      const result = await response.json() as { chat: ChatConversation };
      setChat(result.chat);
    } catch {
      // Polling is best effort; show the last messages and retry next interval.
    }
  }, []);

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (id) void refreshChat(id);
  }, [refreshChat]);

  const chatId = chat?.id;
  useEffect(() => {
    if (!open || !chatId) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => void refreshChat(chatId, controller.signal), 4000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [open, chatId, refreshChat]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, chat?.messages.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(chat
          ? { id: chat.id, message: text }
          : { name, email, message: text }),
      });
      const result = await response.json() as { ok?: boolean; chat?: ChatConversation; error?: string };
      if (!response.ok || !result.chat) {
        setError(result.error === "chat_closed"
          ? (fa ? "این گفتگو بسته شده است." : "This conversation is closed.")
          : (fa ? "ارسال پیام انجام نشد. دوباره تلاش کنید." : "Could not send your message. Please try again."));
        return;
      }
      setChat(result.chat);
      localStorage.setItem(STORAGE_KEY, result.chat.id);
      setMessage("");
    } catch {
      setError(fa ? "ارتباط برقرار نشد. دوباره تلاش کنید." : "Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`fixed bottom-5 z-[60] ${fa ? "left-5" : "right-5"}`} dir={fa ? "rtl" : "ltr"}>
      {open && (
        <section className="mb-3 flex h-[min(560px,calc(100dvh-110px))] w-[min(370px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_18px_70px_rgba(18,24,40,.22)]" aria-label={fa ? "گفتگوی آنلاین" : "Live chat"}>
          <header className="flex items-center gap-3 bg-[#1e2230] px-4 py-4 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><MessageCircle className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{fa ? "گفتگوی آنلاین" : "Live chat"}</p>
              <p className="mt-0.5 text-xs text-white/65">{fa ? "معمولاً در کوتاه‌ترین زمان پاسخ می‌دهیم" : "We usually reply as soon as possible"}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={fa ? "بستن گفتگو" : "Close chat"} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8f8fa] p-4">
            {!chat && (
              <div className="max-w-[90%] rounded-2xl rounded-tr-sm bg-white p-3 text-sm leading-6 text-[#323747] shadow-sm">
                {fa ? "سلام! برای شروع گفتگو نام و ایمیل خود را وارد کنید. چطور می‌توانیم کمک کنیم؟" : "Hello! Enter your name and email to start a conversation. How can we help?"}
              </div>
            )}
            {chat?.messages.map((item) => (
              <div key={item.id} className={`flex ${item.sender === "customer" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${item.sender === "customer" ? "rounded-tr-sm bg-white text-[#323747]" : "rounded-tl-sm bg-accent text-white"}`}>
                  <p className="whitespace-pre-wrap break-words">{item.body}</p>
                  <time className={`mt-1 block text-[10px] ${item.sender === "customer" ? "text-[#888d99]" : "text-white/70"}`}>
                    {new Intl.DateTimeFormat(fa ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}
                  </time>
                </div>
              </div>
            ))}
            {chat?.status === "closed" && <div className="rounded-lg bg-amber-50 p-3 text-center text-xs text-amber-800">{fa ? "این گفتگو بسته شده است." : "This conversation is closed."}<button type="button" onClick={() => { localStorage.removeItem(STORAGE_KEY); setChat(null); setError(""); }} className="ms-2 font-semibold underline underline-offset-2">{fa ? "شروع گفتگوی تازه" : "Start a new chat"}</button></div>}
            <div ref={endRef} />
          </div>

          {error && <p role="alert" className="bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
          <form onSubmit={submit} className="border-t border-border bg-background p-3">
            {!chat && (
              <div className="mb-2 grid grid-cols-2 gap-2">
                <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder={fa ? "نام شما" : "Your name"} aria-label={fa ? "نام" : "Name"} className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent" />
                <input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={fa ? "ایمیل" : "Email"} aria-label={fa ? "ایمیل" : "Email"} className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-accent" />
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea required rows={1} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} disabled={chat?.status === "closed"} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder={fa ? "پیام خود را بنویسید…" : "Write your message…"} aria-label={fa ? "پیام" : "Message"} className="max-h-28 min-h-10 flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-60" />
              <button type="submit" disabled={loading || !message.trim() || chat?.status === "closed"} aria-label={fa ? "ارسال پیام" : "Send message"} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted">{fa ? "پیام‌ها برای پیگیری در این مرورگر ذخیره می‌شوند." : "Your conversation is saved in this browser for follow-up."}</p>
          </form>
        </section>
      )}
      <a
        href={process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/989128800000"}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={fa ? "پیام‌رسانی واتساپ" : "Chat on WhatsApp"}
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_30px_rgba(28,36,52,.25)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(28,36,52,.32)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366]"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      </a>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? (fa ? "بستن گفتگو" : "Close chat") : (fa ? "شروع گفتگوی آنلاین" : "Open live chat")} className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_30px_rgba(28,36,52,.25)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(28,36,52,.32)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        {open ? <X className="h-6 w-6" /> : <><MessageCircle className="h-6 w-6" /><span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-400" /></>}
      </button>
    </div>
  );
}
