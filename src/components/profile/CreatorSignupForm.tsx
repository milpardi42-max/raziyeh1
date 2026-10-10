"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Loader2 } from "lucide-react";
import { useAuth, useLocale } from "@/components/providers/AppProviders";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";
import { SuccessState } from "@/components/ui/States";
import { TermsModal } from "@/components/ui/TermsModal";
import { href } from "@/lib/utils";

interface CreatorSignupFormProps {
  options: string[];
}

export function CreatorSignupForm({ options }: CreatorSignupFormProps) {
  const { locale } = useLocale();
  const { signup, user } = useAuth();
  const router = useRouter();
  const fa = locale === "fa";

  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "pro" | "studio">("pro");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Already logged in as artist
  if (user?.role === "artist" || user?.role === "admin") {
    return (
      <div className="space-y-4">
        <SuccessState
          message={
            fa
              ? `شما با عنوان هنرمند طراح وارد شده‌اید. اکنون به داشبورد و غرفه اختصاصی خود بروید.`
              : `You're already registered as an artist. Go to your dashboard.`
          }
        />
        <Button href={href(locale, "/artist")} className="mt-4">
          {fa ? "ورود به داشبورد و غرفه هنرمند" : "Go to Artist Dashboard"}
        </Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("loading");
    setErrMsg("");
    const fd = new FormData(e.currentTarget);

    const name = String(fd.get("name") || "");
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");
    const phone = String(fd.get("phone") || "");
    const city = String(fd.get("city") || "");
    const specialty = String(fd.get("type") || "");
    const instagram = String(fd.get("instagram") || "");
    const portfolioUrl = String(fd.get("portfolio") || "");
    const bio = String(fd.get("bio") || "");

    if (password !== confirm) {
      setState("idle");
      setErrMsg(fa ? "رمز عبور و تکرار آن یکسان نیستند." : "Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setState("idle");
      setErrMsg(fa ? "رمز عبور باید حداقل ۶ کاراکتر باشد." : "Password must be at least 6 characters.");
      return;
    }

    // Terms & conditions must be accepted before creating an account
    if (!termsAccepted) {
      setState("idle");
      setErrMsg(
        fa
          ? "برای تکمیل ثبت‌نام باید شرایط و مقررات را بخوانید و با آن موافقت کنید."
          : "Please read and agree to the terms & conditions to complete signup.",
      );
      setTermsOpen(true); // open the modal so the user can read and agree
      return;
    }

    const r = await signup(name, email, password, "artist", {
      phone,
      city,
      specialty,
      instagram,
      portfolioUrl,
      bio,
      planId: selectedPlan,
    });

    if (!r.ok) {
      setState("error");
      const errorMap: Record<string, string> = {
        email_taken: fa ? "این ایمیل قبلاً ثبت شده است. لطفاً وارد حساب خود شوید." : "This email is already registered.",
        invalid: fa ? "اطلاعات وارد شده معتبر نیست." : "Please check your details.",
        network: fa ? "خطای شبکه. لطفاً دوباره تلاش کنید." : "Network error. Please try again.",
        server_error: fa ? "خطای سرور. لطفاً بعداً تلاش کنید." : "Server error. Please try again later.",
      };
      setErrMsg(errorMap[r.error ?? ""] ?? (fa ? "خطایی رخ داد." : "An error occurred."));
      return;
    }

    setState("ok");
    setTimeout(() => {
      router.push(href(locale, "/artist"));
    }, 1200);
  };

  if (state === "ok") {
    return (
      <div className="rounded-3xl border border-accent/40 bg-accent/5 p-8 text-center space-y-4 anim-fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-medium">
          <Check className="h-7 w-7" />
        </div>
        <h3 className="font-display text-xl font-bold text-foreground">
          {fa ? "ثبت‌نام شما با موفقیت انجام شد!" : "Welcome to Rosie Atelier!"}
        </h3>
        <p className="text-xs sm:text-sm text-foreground-secondary max-w-md mx-auto leading-relaxed">
          {fa
            ? "پروفایل اختصاصی شما در صفحه هنرمندان ایجاد گردید و تب اقتصادی و غرفه اختصاصی شما در پنل فعال شد. در حال انتقال به داشبورد…"
            : "Your dedicated profile has been created on the Artists Hub, and your Pro Showcase tab is active. Redirecting to your dashboard…"}
        </p>
        <div className="flex justify-center pt-2">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Plan Selector */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-foreground">
          {fa ? "انتخاب سطح عضویت و غرفه در صفحه هنرمندان:" : "Choose Membership & Storefront Tier:"}
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Pro Plan */}
          <div
            onClick={() => setSelectedPlan("pro")}
            className={`cursor-pointer rounded-2xl border-2 p-3.5 transition ${
              selectedPlan === "pro"
                ? "border-accent bg-accent/10 shadow-sm"
                : "border-border bg-surface hover:border-foreground/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-accent">{fa ? "پلن هنرمند Pro" : "Artist Pro"}</span>
              <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold text-accent">VIP</span>
            </div>
            <p className="mt-1 font-display text-sm font-bold text-foreground">{fa ? "۲۹۰٬۰۰۰ ت / ماه" : "$9 / mo"}</p>
            <p className="mt-1 text-[11px] text-foreground-secondary leading-tight">
              {fa ? "غرفه اختصاصی، فروش پتینه و دریافت استعلام مستقیم" : "Dedicated showcase, sell patina & direct leads"}
            </p>
          </div>

          {/* Starter Plan */}
          <div
            onClick={() => setSelectedPlan("starter")}
            className={`cursor-pointer rounded-2xl border-2 p-3.5 transition ${
              selectedPlan === "starter"
                ? "border-accent bg-accent/10 shadow-sm"
                : "border-border bg-surface hover:border-foreground/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">{fa ? "عضویت پایه" : "Basic"}</span>
              <span className="text-[10px] text-muted">{fa ? "رایگان" : "Free"}</span>
            </div>
            <p className="mt-1 font-display text-sm font-bold text-foreground">{fa ? "رایگان" : "Free"}</p>
            <p className="mt-1 text-[11px] text-foreground-secondary leading-tight">
              {fa ? "فقط فروش پترن دیجیتال در مارکت‌پلیس" : "Digital pattern marketplace only"}
            </p>
          </div>

          {/* Studio VIP Plan */}
          <div
            onClick={() => setSelectedPlan("studio")}
            className={`cursor-pointer rounded-2xl border-2 p-3.5 transition ${
              selectedPlan === "studio"
                ? "border-accent bg-accent/10 shadow-sm"
                : "border-border bg-surface hover:border-foreground/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">{fa ? "استودیو VIP" : "Studio VIP"}</span>
              <Crown className="h-3.5 w-3.5 text-accent" />
            </div>
            <p className="mt-1 font-display text-sm font-bold text-foreground">{fa ? "۶۹۰٬۰۰۰ ت / ماه" : "$24 / mo"}</p>
            <p className="mt-1 text-[11px] text-foreground-secondary leading-tight">
              {fa ? "معرفی به پروژه‌های بزرگ معماری و هتل" : "Hospitality & luxury project dispatch"}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Form Fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={fa ? "نام و نام خانوادگی یا نام استودیو" : "Full name or Studio name"} className="sm:col-span-2">
          <Input name="name" required autoComplete="name" placeholder={fa ? "مثلاً: نیلوفر راد" : "e.g. Niloufar Rad"} />
        </Field>
        <Field label={fa ? "ایمیل" : "Email"}>
          <Input name="email" type="email" required dir="ltr" autoComplete="email" placeholder="artist@example.com" />
        </Field>
        <Field label={fa ? "شماره تماس" : "Phone"}>
          <Input name="phone" type="tel" dir="ltr" autoComplete="tel" placeholder="0912..." />
        </Field>
        <Field label={fa ? "حوزه فعالیت و تخصص" : "Specialty"}>
          <Select name="type">
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
        <Field label={fa ? "شهر محل فعالیت" : "City"}>
          <Input name="city" autoComplete="address-level2" placeholder={fa ? "مثلاً: تهران، اصفهان، شیراز…" : "e.g. Tehran"} />
        </Field>
        <Field label={fa ? "آیدی اینستاگرام (اختیاری)" : "Instagram handle (optional)"}>
          <Input name="instagram" dir="ltr" placeholder="@username" />
        </Field>
        <Field label={fa ? "لینک وب‌سایت یا پورتفولیو (اختیاری)" : "Portfolio link (optional)"}>
          <Input name="portfolio" type="url" dir="ltr" placeholder="https://..." />
        </Field>
        <Field label={fa ? "درباره سبک کار و خدمات شما (بیوگرافی)" : "About your craft & services"} className="sm:col-span-2">
          <Textarea
            name="bio"
            rows={2}
            placeholder={fa ? "درباره سابقه کاری، تکنیک‌های پتینه، طراحی پترن یا سبک هنری خود بنویسید…" : "Describe your techniques, patina experience or design style…"}
          />
        </Field>
        <Field label={fa ? "رمز عبور (حداقل ۶ کاراکتر)" : "Password (min 6 chars)"}>
          <Input name="password" type="password" required dir="ltr" minLength={6} autoComplete="new-password" />
        </Field>
        <Field label={fa ? "تکرار رمز عبور" : "Confirm password"}>
          <Input name="confirm" type="password" required dir="ltr" minLength={6} autoComplete="new-password" />
        </Field>
      </div>

      {/* Terms & conditions — required, with a modal to read them */}
      <div className="rounded-xl border border-border bg-surface p-3.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6 text-foreground">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-accent"
          />
          <span>
            {fa
              ? "شرایط و مقررات سایت را (بر اساس قوانین جمهوری اسلامی ایران) خواندم و با آن موافقم."
              : "I have read the site terms & conditions (per the laws of the Islamic Republic of Iran) and agree to them."}{" "}
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              {fa ? "مشاهده متن کامل" : "Read the full text"}
            </button>
          </span>
        </label>
      </div>

      {state === "error" && errMsg && (
        <div>
          <p className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-xs text-error">{errMsg}</p>
        </div>
      )}

      <div>
        <Button type="submit" size="lg" disabled={state === "loading"} className="w-full sm:w-auto min-w-44">
          {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
          {fa ? "ثبت‌نام و ایجاد غرفه اختصاصی" : "Register & Open Storefront"}
        </Button>
        <p className="mt-3 text-caption text-foreground-secondary">
          {fa ? "قبلاً ثبت‌نام کرده‌اید؟" : "Already have an account?"}{" "}
          <a href={href(locale, "/login")} className="font-medium text-foreground underline-offset-4 hover:underline">
            {fa ? "ورود به حساب" : "Sign in"}
          </a>
        </p>
      </div>

      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        locale={locale}
        onAgree={() => {
          setTermsAccepted(true);
          setTermsOpen(false);
          setErrMsg("");
        }}
      />
    </form>
  );
}
