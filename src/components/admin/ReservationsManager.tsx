"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, RefreshCw, Users } from "lucide-react";
import { faNum } from "@/lib/utils";
import type { AcademyReservation, ReservationStatus } from "@/lib/types";

export function ReservationsManager() {
  const [reservations, setReservations] = useState<AcademyReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReservationStatus>("reserved");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/admin/reservations", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("load_failed");
      const data = (await response.json()) as { reservations?: AcademyReservation[] };
      setReservations(data.reservations ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateReservation = async (id: string, payload: { status?: ReservationStatus; accessGranted?: boolean }) => {
    setBusyId(id);
    setActionError("");
    try {
      const response = await fetch("/api/admin/reservations", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      const result = await response.json() as { reservation?: AcademyReservation; error?: string };
      if (!response.ok || !result.reservation) throw new Error(result.error ?? "ذخیره تغییر رزرو ناموفق بود.");
      setReservations((current) => current.map((reservation) => reservation.id === id ? result.reservation! : reservation));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "ذخیره تغییر رزرو ناموفق بود.");
    } finally {
      setBusyId("");
    }
  };
  const changeStatus = (id: string, status: ReservationStatus) => updateReservation(id, { status });
  const changeAccess = (id: string, accessGranted: boolean) => updateReservation(id, { accessGranted });

  const active = reservations.filter((reservation) => reservation.status === "reserved");
  const visible = reservations.filter((reservation) => reservation.status === statusFilter);
  const grouped = visible.reduce<Record<string, AcademyReservation[]>>((groups, reservation) => {
    (groups[reservation.eventSlug] ??= []).push(reservation);
    return groups;
  }, {});
  const statusLabels: Record<ReservationStatus, string> = { reserved: "رزروهای فعال", attended: "حاضرشده", cancelled: "لغوشده" };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><CalendarClock className="h-5 w-5" /></div>
          <div>
            <h1 className="text-base font-bold text-gray-900">رزروهای رویدادها</h1>
            <p className="text-xs text-gray-400">{loading ? "در حال بارگذاری…" : `${faNum(active.length)} رزرو فعال`}</p>
          </div>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> بارگذاری
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["reserved", "attended", "cancelled"] as ReservationStatus[]).map((status) => {
          const count = reservations.filter((reservation) => reservation.status === status).length;
          return <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${statusFilter === status ? "border-[#283044] bg-[#283044] text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>{statusLabels[status]} · {faNum(count)}</button>;
        })}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">دریافت رزروها با خطا مواجه شد.</div>}
      {actionError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

      {!loading && !error && Object.keys(grouped).length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 py-20 text-center text-sm text-gray-400">رکوردی در بخش «{statusLabels[statusFilter]}» وجود ندارد.</div>
      )}

      <div className="space-y-4">
        {Object.entries(grouped).map(([slug, items]) => {
          const first = items[0];
          return (
            <section key={slug} className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-5 py-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{first.eventTitle.fa}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><CalendarClock className="h-3.5 w-3.5" />{new Date(first.startsAt).toLocaleString("fa-IR", { dateStyle: "full", timeStyle: "short" })}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"><Users className="h-3.5 w-3.5" />{faNum(items.length)} رزرو</span>
              </div>
              <div className="divide-y divide-gray-100">
                {items.map((reservation) => (
                  <div key={reservation.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{reservation.name}</p>
                      <p className="text-xs text-gray-500" dir="ltr">{reservation.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span dir="ltr">{new Date(reservation.createdAt).toLocaleString("fa-IR")}</span>
                      {reservation.status === "reserved" && <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">رزرو فعال</span>}
                      {reservation.paymentRequired ? (
                        <>
                          <span className={`rounded-full px-2 py-1 font-medium ${reservation.accessGranted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                            {reservation.accessGranted ? "دسترسی فعال" : "در انتظار تأیید پرداخت"}
                          </span>
                          {reservation.status !== "cancelled" && (
                            <button type="button" disabled={busyId === reservation.id} onClick={() => void changeAccess(reservation.id, !reservation.accessGranted)} className={`rounded-md border px-2.5 py-1.5 font-medium disabled:opacity-50 ${reservation.accessGranted ? "border-red-200 bg-white text-red-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                              {reservation.accessGranted ? "لغو دسترسی" : "تأیید پرداخت و فعال‌سازی"}
                            </button>
                          )}
                        </>
                      ) : <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">رایگان / دسترسی باز</span>}
                      {reservation.status === "reserved" && <>
                        <button type="button" disabled={busyId === reservation.id} onClick={() => void changeStatus(reservation.id, "attended")} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-medium text-emerald-700 disabled:opacity-50">ثبت حضور</button>
                        <button type="button" disabled={busyId === reservation.id} onClick={() => { if (confirm("رزرو این شرکت‌کننده لغو شود؟")) void changeStatus(reservation.id, "cancelled"); }} className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 font-medium text-red-600 disabled:opacity-50">لغو رزرو</button>
                      </>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
