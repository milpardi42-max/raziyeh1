"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useAuth, useLocale } from "@/components/providers/AppProviders";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { TermsModal } from "@/components/ui/TermsModal";
import { GoogleButton } from "./GoogleButton";
import { EmailCodeForm } from "./EmailCodeForm";
import { RolePicker } from "./RolePicker";
import { href } from "@/lib/utils";

interface AuthFormProps {
  mode: "login" | "signup";
  /** Role pre-selected for signup (e.g. "artist" from /creators/join) */
  defaultRole?: "user" | "artist";
  /** Called with credentials right after a successful signup, before navigation */
  onSignupSuccess?: (email: string, password: string) => void;
  /** Pre-filled values (used when arriving from signup → login transition) */
  prefill?: { email?: string; password?: string };
  /** When true the submit button shows a loading-like state */
  autoSubmitting?: boolean;
}

const ERROR_MESSAGES: Record<string, { fa: string; en: string }> = {
  invalid: { fa: "اطلاعات وارد شده معتبر نیست.", en: "Please check your details." },
  invalid_credentials: { fa: "ایمیل یا رمز عبور اشتباه است.", en: "Incorrect email or password." },
  email_taken: { fa: "این ایمیل قبلاً ثبت شده است.", en: "This email is already registered." },
  password_too_short: { fa: "رمز عبور باید حداقل ۶ کاراکتر باشد.", en: "Password must be at least 6 characters." },
  password_mismatch: { fa: "رمز عبور و تکرار آن یکسان نیستند.", en: "Passwords do not match." },
  terms_required: { fa: "برای تکمیل ثبت‌نام باید شرایط و مقررات را بخوانید و با آن موافقت کنید.", en: "Please read and agree to the terms & conditions to complete signup." },
  admin_not_configured: { fa: "حساب مدیر روی سرور پیکربندی نشده است.", en: "Admin account is not configured on the server." },
  too_many_attempts: { fa: "تعداد تلاش‌های زیاد. لطفاً کمی صبر کنید.", en: "Too many attempts. Please wait a moment." },
  network: { fa: "خطای شبکه. لطفاً دوباره تلاش کنید.", en: "Network error. Please try again." },
  server_error: { fa: "خطای سرور. لطفاً بعداً دوباره تلاش کنید.", en: "Server error. Please try again later." },
  google_not_configured: { fa: "ورود با گوگل هنوز برای این سایت فعال نشده است.", en: "Google sign-in is not configured for this site yet." },
  google_cancelled: { fa: "ورود با گوگل لغو شد.", en: "Google sign-in was cancelled." },
  google_failed: { fa: "ورود با گوگل انجام نشد. لطفاً دوباره تلاش کنید.", en: "Google sign-in failed. Please try again." },
  google_state: { fa: "نشست ورود منقضی شد. لطفاً دوباره روی دکمه گوگل بزنید.", en: "The sign-in session expired. Please press the Google button again." },
  google_email_unverified: { fa: "ایمیل حساب گوگل شما تأیید نشده است.", en: "Your Google account e-mail is not verified." },
  google_no_account: { fa: "حسابی با این ایمیل وجود ندارد؛ ابتدا ثبت‌نام کنید.", en: "No account exists for this e-mail yet — please sign up first." },
};

export function AuthForm({ mode, defaultRole, onSignupSuccess, prefill, autoSubmitting }: AuthFormProps) {
  const { locale, dict } = useLocale();
  const { login, signup } = useAuth();
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<"user" | "artist">(defaultRole ?? "user");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  /** "code" shows the password-less e-mail form instead of e-mail + password. */
  const [method, setMethod] = useState<"password" | "code">("password");
  const fa = locale === "fa";

  function getError(code: string): string {
    const msg = ERROR_MESSAGES[code];
    if (msg) return fa ? msg.fa : msg.en;
    return fa ? "خطایی رخ داد." : "An error occurred.";
  }

  /**
   * The Google round-trip ends in a redirect back to this page with
   * ?google_error=<code>; show it once, then strip it from the address bar.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // A failed magic link returns with ?email_error=… — open the code form so
    // the notice has somewhere to appear.
    if (params.get("email_error")) {
      setMethod("code");
      return;
    }
    const code = params.get("google_error");
    if (!code) return;
    const msg = ERROR_MESSAGES[code];
    setErr(msg ? (fa ? msg.fa : msg.en) : fa ? "خطایی رخ داد." : "An error occurred.");
    const clean = new URL(window.location.href);
    clean.searchParams.delete("google_error");
    window.history.replaceState(null, "", clean.toString());
  }, [fa]);

  /** Signup requires the terms checkbox — same gate as the e-mail form. */
  const allowGoogleStart = useCallback(() => {
    if (mode === "signup" && !termsAccepted) {
      setErr(fa ? ERROR_MESSAGES.terms_required.fa : ERROR_MESSAGES.terms_required.en);
      setTermsOpen(true);
      return false;
    }
    return true;
  }, [fa, mode, termsAccepted]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));

    if (mode === "signup") {
      const confirm = String(fd.get("confirm") || "");
      if (password !== confirm) {
        setBusy(false);
        return setErr(getError("password_mismatch"));
      }
      // Terms & conditions must be accepted before creating an account
      if (!termsAccepted) {
        setBusy(false);
        setErr(getError("terms_required"));
        setTermsOpen(true); // open the modal so the user can read and agree
        return;
      }
    }

    if (mode === "login") {
      const r = await login(email, password);
      setBusy(false);
      if (!r.ok) return setErr(getError(r.error ?? "invalid"));
      // Redirect based on role
      router.push(href(locale, "/account"));
      return;
    }

    // signup
    const name = String(fd.get("name") || "");
    const r = await signup(name, email, password, role);
    setBusy(false);
    if (!r.ok) return setErr(getError(r.error ?? "invalid"));
    if (onSignupSuccess) {
      onSignupSuccess(email, password);
      return;
    }
    router.push(href(locale, "/account"));
  };

  /* Password-less e-mail sign-in replaces the whole password form. */
  if (method === "code") {
    return (
      <EmailCodeForm
        entry={mode}
        role={role}
        onRoleChange={setRole}
        onBack={() => {
          setMethod("password");
          setErr("");
        }}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {mode === "signup" && (
        <Field label={dict.common.name}>
          <Input name="name" required autoComplete="name" />
        </Field>
      )}
      <Field label={dict.common.email}>
        <Input
          name="email"
          type="email"
          required
          dir="ltr"
          autoComplete="email"
          defaultValue={prefill?.email}
        />
      </Field>
      <Field label={dict.common.password}>
        <div className="relative">
          <Input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            dir="ltr"
            minLength={mode === "signup" ? 6 : 4}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            defaultValue={prefill?.password}
            className="pr-10"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-foreground transition-colors"
            aria-label={showPassword ? (fa ? "پنهان کردن رمز" : "Hide password") : (fa ? "نمایش رمز" : "Show password")}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      {mode === "login" && (
        <div className="flex justify-end">
          <Link
            href={href(locale, "/forgot-password")}
            className="text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            {fa ? "فراموشی رمز عبور؟" : "Forgot password?"}
          </Link>
        </div>
      )}

      {mode === "signup" && (
        <Field label={fa ? "تکرار رمز عبور" : "Confirm password"}>
          <div className="relative">
            <Input
              name="confirm"
              type={showConfirm ? "text" : "password"}
              required
              dir="ltr"
              minLength={6}
              autoComplete="new-password"
              className="pr-10"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-foreground transition-colors"
              aria-label={showConfirm ? (fa ? "پنهان کردن رمز" : "Hide password") : (fa ? "نمایش رمز" : "Show password")}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
      )}

      {/* Role selector — only on signup, shared with the e-mail code and Google methods */}
      {mode === "signup" && (
        <Field label={fa ? "نوع حساب" : "Account type"}>
          <RolePicker value={role} onChange={setRole} disabled={busy || autoSubmitting} />
        </Field>
      )}

      {/* Terms & conditions — required on signup, with a modal to read them */}
      {mode === "signup" && (
        <div className="rounded-lg border border-border bg-surface p-3.5">
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
      )}

      {err && (
        <p role="alert" className="text-sm text-error">
          {err}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={busy || autoSubmitting}
      >
        {mode === "login" ? dict.nav.login : dict.nav.signup}
      </Button>

      <div className="auth-form-divider" aria-hidden="true">
        <span>{fa ? "یا" : "or"}</span>
      </div>

      <GoogleButton
        locale={locale}
        entry={mode}
        role={role}
        disabled={busy || autoSubmitting}
        beforeStart={allowGoogleStart}
        onError={setErr}
      />

      {/* Password-less alternative for visitors who would rather not type a password. */}
      <button
        type="button"
        onClick={() => {
          setErr("");
          setMethod("code");
        }}
        disabled={busy || autoSubmitting}
        className="auth-alt-method"
      >
        <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {mode === "login"
            ? fa
              ? "ورود با کد یک‌بارمصرف ایمیلی"
              : "Sign in with an e-mail code"
            : fa
              ? "ثبت‌نام با کد یک‌بارمصرف ایمیلی"
              : "Sign up with an e-mail code"}
        </span>
      </button>

      <p className="text-center text-sm text-foreground-secondary">
        {mode === "login" ? (
          <>
            {fa ? "حساب ندارید؟" : "No account?"}{" "}
            <Link
              href={href(locale, "/signup")}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {dict.nav.signup}
            </Link>
          </>
        ) : (
          <>
            {fa ? "حساب دارید؟" : "Already have an account?"}{" "}
            <Link
              href={href(locale, "/login")}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {dict.nav.login}
            </Link>
          </>
        )}
      </p>

      {mode === "signup" && (
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
      )}
    </form>
  );
}
