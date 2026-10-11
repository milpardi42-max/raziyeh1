"use client";

import { useCallback, useEffect, useState } from "react";
import { MailCheck, PencilLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { RolePicker, type AccountRole } from "./RolePicker";
import { TermsModal } from "@/components/ui/TermsModal";
import { useLocale } from "@/components/providers/AppProviders";
import { withCsrf } from "@/lib/security/csrf-client";
import { sessionCookieWorks } from "@/lib/auth/session-client";
import { SESSION_FETCH } from "@/lib/http";
import { href } from "@/lib/utils";

const CODE_LENGTH = 6;

const MESSAGES: Record<string, { fa: string; en: string }> = {
  invalid_email: { fa: "ایمیل معتبر وارد کنید.", en: "Please enter a valid e-mail address." },
  email_no_account: {
    fa: "با این ایمیل حسابی وجود ندارد؛ از صفحهٔ ثبت‌نام ثبت‌نام کنید.",
    en: "No account exists for this e-mail yet — please sign up first.",
  },
  email_signup_disabled: {
    fa: "ثبت‌نام با کد ایمیلی در حال حاضر غیرفعال است.",
    en: "Signing up with an e-mail code is currently disabled.",
  },
  email_login_disabled: { fa: "ورود با کد ایمیلی غیرفعال است.", en: "E-mail code sign-in is disabled." },
  invalid_code: { fa: "کد وارد‌شده درست نیست.", en: "That code is not correct." },
  code_expired: { fa: "کد منقضی شده است؛ کد تازه بگیرید.", en: "The code expired — request a new one." },
  too_many_attempts: { fa: "تلاش‌های زیاد. کمی بعد دوباره امتحان کنید.", en: "Too many attempts. Please try again later." },
  cooldown: { fa: "کد قبلی هنوز معتبر است؛ چند لحظه صبر کنید.", en: "A code was just sent — please wait a moment." },
  email_invalid: { fa: "لینک ورود معتبر نیست یا منقضی شده است.", en: "That sign-in link is invalid or has expired." },
  email_expired: { fa: "لینک ورود منقضی شده است؛ لینک تازه بگیرید.", en: "The sign-in link expired — request a new one." },
  email_failed: { fa: "ورود انجام نشد. لطفاً دوباره تلاش کنید.", en: "Sign-in failed. Please try again." },
  network: { fa: "خطای شبکه. لطفاً دوباره تلاش کنید.", en: "Network error. Please try again." },
  csrf_missing: {
    fa: "به‌دلیل تنظیمات امنیتی این پیش‌نمایش، درخواست تأیید نشد. صفحه را یک‌بار دوباره بارگذاری کنید و سپس تلاش کنید (یا پیش‌نمایش را در تب جداگانه باز کنید).",
    en: "The request was blocked by this preview's security settings. Please reload the page and try again (or open the preview in its own tab).",
  },
  csrf_mismatch: {
    fa: "نشست امنیتی منقضی شده است. صفحه را دوباره بارگذاری کنید.",
    en: "The security session expired. Please reload the page.",
  },
  session_cookie_blocked: {
    fa: "حساب شما ساخته شد و کد درست بود، اما مرورگر این پیش‌نمایش اجازهٔ ذخیرهٔ کوکی ورود را نمی‌دهد؛ به همین دلیل در صفحهٔ بعد از حساب خارج می‌شوید. لطفاً پیش‌نمایش را در یک تب جداگانه باز کنید یا از دامنهٔ اصلی سایت استفاده کنید.",
    en: "Your account is created and the code was correct, but this preview browser is blocking the sign-in cookie, so you would be signed out on the next page. Please open the preview in its own tab, or use the site's real domain.",
  },
  server_error: { fa: "خطای سرور. لطفاً بعداً تلاش کنید.", en: "Server error. Please try again later." },
  terms_required: { fa: "برای ساخت حساب باید شرایط و مقررات را بپذیرید.", en: "Please accept the terms & conditions to create an account." },
  email_no_account_seller: {
    fa: "با این ایمیل حسابی وجود ندارد؛ از صفحهٔ ثبت‌نام، ثبت‌نام کنید.",
    en: "No account exists for this e-mail yet — please sign up first.",
  },
};

interface EmailCodeFormProps {
  /** "signup" asks for the terms checkbox and creates the account after verification. */
  entry: "login" | "signup";
  /** Role chosen on the signup form ("artist" asks for a seller account). */
  role: AccountRole;
  onRoleChange: (role: AccountRole) => void;
  /** Same-origin path to open after a successful sign-in. */
  returnTo?: string;
  /** Back to the e-mail + password form. */
  onBack: () => void;
}

/**
 * Password-less e-mail sign-in.
 *
 * Step 1 asks for the address and mails a 6-digit code plus a one-click link;
 * step 2 verifies the code in the page (the link in the mail is handled by
 * /api/auth/email/verify and lands the visitor straight in their account).
 *
 * While no mail provider is configured the API runs in outbox mode and returns
 * `devCode`, which is shown in a clearly-marked test notice — that is how the
 * flow can be exercised before Resend/SMTP credentials exist.
 */
export function EmailCodeForm({ entry, role, onRoleChange, returnTo, onBack }: EmailCodeFormProps) {
  const { locale } = useLocale();
  const fa = locale === "fa";

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const t = useCallback(
    (key: string) => {
      const msg = MESSAGES[key];
      if (msg) return fa ? msg.fa : msg.en;
      return fa ? "خطایی رخ داد." : "An error occurred.";
    },
    [fa],
  );

  /** A failed magic link lands back here with ?email_error=<code>. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const failed = params.get("email_error");
    if (!failed) return;
    setErr(t(failed));
    const clean = new URL(window.location.href);
    clean.searchParams.delete("email_error");
    window.history.replaceState(null, "", clean.toString());
  }, [t]);

  /** Resend countdown. */
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => (value <= 1 ? 0 : value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const requestCode = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      if (busy) return;

      const address = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
        setErr(t("invalid_email"));
        return;
      }
      if (entry === "signup" && !termsAccepted) {
        setErr(t("terms_required"));
        setTermsOpen(true);
        return;
      }

      setBusy(true);
      setErr("");
      setNotice("");
      try {
        const res = await fetch("/api/auth/email/request", withCsrf({
          ...SESSION_FETCH,
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: address, locale, entry, role, returnTo }),
        }));
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; retryAfterS?: number; devCode?: string }
          | null;

        setBusy(false);

        if (!res.ok || !data?.ok) {
          if (data?.error === "cooldown" && data.retryAfterS) setCooldown(data.retryAfterS);
          setErr(t(data?.error ?? "network"));
          return;
        }

        setEmail(address);
        setCode("");
        setStep("code");
        setCooldown(30);
        setDevCode(data.devCode ?? "");
        setNotice(
          fa
            ? `کد ${CODE_LENGTH} رقمی به ${address} ایمیل شد.`
            : `A ${CODE_LENGTH}-digit code was e-mailed to ${address}.`,
        );
      } catch {
        setBusy(false);
        setErr(t("network"));
      }
    },
    [busy, email, entry, fa, locale, returnTo, role, t, termsAccepted],
  );

  const verifyCode = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (busy) return;
      const digits = code.replace(/\D/g, "");
      if (digits.length !== CODE_LENGTH) {
        setErr(t("invalid_code"));
        return;
      }

      setBusy(true);
      setErr("");
      try {
        const res = await fetch("/api/auth/email/verify", withCsrf({
          ...SESSION_FETCH,
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, code: digits, locale, returnTo }),
        }));
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; returnTo?: string }
          | null;

        if (!res.ok || !data?.ok) {
          setBusy(false);
          setErr(t(data?.error ?? "network"));
          setCode("");
          return;
        }

        // The cookie must actually have survived, otherwise the visitor would be
        // bounced to the login page one click later, with no explanation.
        if (!(await sessionCookieWorks())) {
          setBusy(false);
          setErr(t("session_cookie_blocked"));
          return;
        }

        // Full navigation: the server renders the account page from the fresh
        // session cookie, so the header/user state is correct immediately.
        // `data.returnTo` is the path the server validated (never a raw client value).
        window.location.assign(data.returnTo || href(locale, "/account"));
      } catch {
        setBusy(false);
        setErr(t("network"));
      }
    },
    [busy, code, email, locale, returnTo, t],
  );

  /* ---------------------------------------------------------------- */

  if (step === "code") {
    return (
      <div className="space-y-4">
        <div className="auth-code__notice" role="status">
          <MailCheck className="auth-code__notice-icon" aria-hidden="true" />
          <p>{notice}</p>
        </div>

        <form onSubmit={verifyCode} className="space-y-4" noValidate>
          <Field label={fa ? "کد ورود" : "Sign-in code"}>
            <Input
              name="code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              autoFocus
              maxLength={CODE_LENGTH}
              placeholder={"·".repeat(CODE_LENGTH)}
              className="auth-code__input"
              aria-label={fa ? "کد شش رقمی" : "Six-digit code"}
            />
          </Field>

          {devCode && (
            <p className="auth-code__dev">
              <ShieldCheck aria-hidden="true" />
              <span>
                {fa
                  ? `حالت آزمایشی — ایمیل واقعی ارسال نشده است. کد شما: ${devCode}`
                  : `Test mode — no real e-mail was sent. Your code: ${devCode}`}
              </span>
            </p>
          )}

          {err && (
            <p role="alert" className="text-sm text-error">
              {err}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== CODE_LENGTH}>
            {busy ? (fa ? "در حال بررسی…" : "Checking…") : fa ? "تأیید و ورود" : "Verify and sign in"}
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setErr("");
              setCode("");
              setDevCode("");
            }}
            className="inline-flex items-center gap-1.5 font-medium text-foreground-secondary underline-offset-4 hover:text-foreground hover:underline"
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            {fa ? "تغییر ایمیل" : "Change e-mail"}
          </button>

          {cooldown > 0 ? (
            <span className="text-xs text-muted">
              {fa ? `ارسال دوباره کد تا ${cooldown} ثانیه` : `Resend in ${cooldown}s`}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => requestCode()}
              disabled={busy}
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              {fa ? "ارسال دوباره کد" : "Resend code"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4" noValidate>
      {entry === "signup" && (
        <Field label={fa ? "نوع حساب" : "Account type"}>
          <RolePicker value={role} onChange={onRoleChange} disabled={busy} />
        </Field>
      )}

      <Field
        label={entry === "signup" ? (fa ? "ایمیل" : "E-mail") : fa ? "ایمیل حساب" : "Account e-mail"}
        hint={
          entry === "signup"
            ? fa
              ? "این ایمیل نام کاربری شما می‌شود."
              : "This address becomes your username."
            : fa
              ? "کد ورود به همین ایمیل فرستاده می‌شود."
              : "The sign-in code is sent to this address."
        }
      >
        <Input
          name="email"
          type="email"
          required
          dir="ltr"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
        />
      </Field>

      {entry === "signup" && (
        <div className="rounded-lg border border-border bg-surface p-3.5">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6 text-foreground">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
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
      )}

      {err && (
        <p role="alert" className="text-sm text-error">
          {err}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? (fa ? "در حال ارسال…" : "Sending…") : fa ? "ارسال کد ورود" : "Send sign-in code"}
      </Button>

      <p className="text-center text-sm">
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-foreground-secondary underline-offset-4 hover:text-foreground hover:underline"
        >
          {fa ? "ورود با ایمیل و رمز عبور" : "Sign in with e-mail & password"}
        </button>
      </p>

      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        locale={locale}
        onAgree={() => {
          setTermsAccepted(true);
          setTermsOpen(false);
          setErr("");
        }}
      />
    </form>
  );
}
