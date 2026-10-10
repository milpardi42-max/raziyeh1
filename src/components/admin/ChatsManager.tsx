"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, MessageCircle, RefreshCw, Send, X } from "lucide-react";
import type { ChatConversation } from "@/lib/data/chats";
import { SESSION_FETCH } from "@/lib/http";

export function ChatsManager() {
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(() => chats.find((chat) => chat.id === selectedId) ?? null, [chats, selectedId]);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/admin/chats", { ...SESSION_FETCH, signal });
      if (!response.ok) throw new Error(response.status === 401 ? "نشست ادمین منقضی شده است." : "بارگذاری گفتگوها ناموفق بود.");
      const data = await response.json() as { chats: ChatConversation[] };
      setChats(data.chats);
      setSelectedId((current) => current && data.chats.some((item) => item.id === current) ? current : data.chats[0]?.id ?? "");
      setError("");
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "ارتباط با سرور برقرار نشد.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => void load(controller.signal), 5000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [load]);

  async function action(payload: { action: "reply"; id: string; message: string } | { action: "close" | "reopen"; id: string }) {
    const response = await fetch("/api/admin/chats", {
      ...SESSION_FETCH,
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json() as { chat?: ChatConversation; error?: string };
    if (!response.ok || !data.chat) throw new Error(data.error === "unauthorized" ? "نشست ادمین منقضی شده است." : "انجام عملیات ناموفق بود.");
    setChats((items) => [data.chat!, ...items.filter((item) => item.id !== data.chat!.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      await action({ action: "reply", id: selected.id, message: reply.trim() });
      setReply("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ارسال پاسخ ناموفق بود.");
    } finally {
      setSending(false);
    }
  }

  const formatDate = (date: string) => new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(date));

  return (
    <section dir="rtl" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#202434]">گفتگوهای آنلاین</h1>
          <p className="mt-1 text-sm text-[#737989]">پیام‌های کاربران را ببینید و از همین‌جا پاسخ دهید.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">{chats.filter((chat) => chat.status === "open").length} گفتگوی باز</span>
          <button type="button" onClick={() => void load()} className="flex h-9 items-center gap-2 rounded-lg border border-[#e1e4e9] bg-white px-3 text-sm text-[#52596a] hover:bg-[#f7f8fa]"><RefreshCw className="h-4 w-4" /> تازه‌سازی</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid min-h-[600px] overflow-hidden rounded-2xl border border-[#e1e4e9] bg-white shadow-sm lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="border-b border-[#e8eaee] lg:border-b-0 lg:border-l">
          <div className="border-b border-[#e8eaee] px-4 py-4">
            <p className="font-semibold text-[#252a38]">صندوق پیام‌ها</p>
            <p className="mt-1 text-xs text-[#858a98]">{chats.length} گفتگو · به‌روزرسانی خودکار</p>
          </div>
          <div className="max-h-[420px] overflow-y-auto lg:max-h-[540px]">
            {loading && chats.length === 0 ? <p className="p-5 text-sm text-[#858a98]">در حال دریافت گفتگوها…</p>
              : chats.length === 0 ? <div className="px-5 py-12 text-center text-sm text-[#858a98]"><MessageCircle className="mx-auto mb-3 h-8 w-8 opacity-30" />هنوز گفتگویی ثبت نشده است.</div>
                : chats.map((chat) => {
                  const last = chat.messages[chat.messages.length - 1];
                  return <button type="button" key={chat.id} onClick={() => setSelectedId(chat.id)} className={`block w-full border-b border-[#f0f1f4] px-4 py-4 text-right transition hover:bg-[#f8f9fb] ${selectedId === chat.id ? "bg-[#f4f6fa]" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[#252a38]">{chat.name}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${chat.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{chat.status === "open" ? "باز" : "بسته"}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="truncate text-xs text-[#747a89]">{last?.sender === "admin" ? "شما: " : ""}{last?.body}</span>
                      <time className="shrink-0 text-[10px] text-[#9297a3]">{formatDate(chat.updatedAt)}</time>
                    </div>
                  </button>;
                })}
          </div>
        </aside>

        {selected ? <div className="flex min-h-[480px] min-w-0 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eaee] px-5 py-4">
            <div className="min-w-0"><p className="truncate font-semibold text-[#252a38]">{selected.name}</p><a href={`mailto:${selected.email}`} className="mt-1 block truncate text-xs text-[#747a89] hover:text-accent">{selected.email}</a></div>
            <button type="button" onClick={async () => { try { await action({ id: selected.id, action: selected.status === "open" ? "close" : "reopen" }); } catch (err) { setError(err instanceof Error ? err.message : "عملیات ناموفق بود."); } }} className="flex items-center gap-1.5 rounded-lg border border-[#e1e4e9] px-3 py-2 text-xs font-medium text-[#52596a] hover:bg-[#f7f8fa]">
              {selected.status === "open" ? <><X className="h-3.5 w-3.5" /> بستن گفتگو</> : <><Check className="h-3.5 w-3.5" /> بازگشایی گفتگو</>}
            </button>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto bg-[#fafbfc] p-5">
            {selected.messages.map((item) => <div key={item.id} className={`flex ${item.sender === "admin" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${item.sender === "admin" ? "rounded-tr-sm bg-[#283044] text-white" : "rounded-tl-sm border border-[#e7e9ed] bg-white text-[#303647]"}`}>
                <p className="mb-1 text-[10px] font-semibold opacity-60">{item.sender === "admin" ? "پشتیبانی" : selected.name}</p>
                <p className="whitespace-pre-wrap break-words text-sm leading-6">{item.body}</p>
                <time className="mt-2 block text-left text-[10px] opacity-55">{formatDate(item.createdAt)}</time>
              </div>
            </div>)}
          </div>
          {selected.status === "open" ? <form onSubmit={submit} className="flex items-end gap-3 border-t border-[#e8eaee] p-4">
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={2000} rows={2} placeholder="پاسخ خود را بنویسید…" className="min-h-12 flex-1 resize-y rounded-xl border border-[#dfe2e8] px-4 py-3 text-sm outline-none focus:border-accent" />
            <button disabled={sending || !reply.trim()} className="flex h-11 items-center gap-2 rounded-xl bg-[#283044] px-4 text-sm font-semibold text-white hover:bg-[#38435c] disabled:opacity-50"><Send className="h-4 w-4" />{sending ? "در حال ارسال…" : "ارسال پاسخ"}</button>
          </form> : <div className="border-t border-[#e8eaee] bg-gray-50 p-4 text-center text-sm text-[#777d8b]">این گفتگو بسته شده است. برای پاسخ، ابتدا آن را بازگشایی کنید.</div>}
        </div> : <div className="flex min-h-[350px] items-center justify-center p-6 text-center text-sm text-[#858a98]"><div><MessageCircle className="mx-auto mb-3 h-10 w-10 opacity-25" />{loading ? "در حال بارگذاری…" : "برای مشاهده پیام‌ها، یک گفتگو را انتخاب کنید."}</div></div>}
      </div>
    </section>
  );
}
