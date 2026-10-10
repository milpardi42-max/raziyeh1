import "server-only";
import type { SiteContent } from "../types";
import type { ProfileStat } from "../razieh-profile";
import { getAllReservations } from "./reservations";

export async function founderStatistics(site: SiteContent): Promise<ProfileStat[]> {
  const id = "artist-razieh-khairipour";
  const courses = site.education.filter((item) => item.authorId === id);
  const slugs = new Set(courses.map((item) => item.slug));
  const reservations = await getAllReservations();
  const students = new Set(reservations.filter((r) => r.status !== "cancelled" && slugs.has(r.eventSlug)).map((r) => r.email.trim().toLowerCase())).size;
  return [
    [site.patterns.filter((p) => p.artistId === id).length, "پترن منتشرشده", "Published patterns"],
    [site.portfolios.filter((p) => p.artistId === id).length, "نمونه‌کار منتشرشده", "Published portfolios"],
    [courses.length, "محتوای آموزشی", "Academy items"],
    [students, "ثبت‌نام‌کننده در سایت", "Registered participants"],
  ].map(([value, fa, en]) => ({
    value: { fa: Number(value).toLocaleString("fa-IR"), en: Number(value).toLocaleString("en-US") },
    label: { fa: String(fa), en: String(en) },
  }));
}
