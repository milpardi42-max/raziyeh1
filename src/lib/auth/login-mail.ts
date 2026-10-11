import "server-only";
import { queueMessage } from "@/lib/marketplace/email";
import { siteUrl } from "@/lib/marketplace/config";
import type { Locale } from "@/lib/i18n/types";
import { LOGIN_CODE_TTL_MS } from "./email-code";

/**
 * The sign-in e-mail: one message carrying both the 6-digit code and the
 * one-click link, so the visitor can use whichever is easier (a phone that
 * previews the message can tap the link; a desktop user types the code).
 *
 * Delivery goes through the project's transactional e-mail stack
 * (Resend → SMTP → outbox); with only the outbox configured — the default in
 * development — the message is stored and visible to the admin panel, which is
 * exactly how the flow is tested before a provider is connected.
 */

const BRAND = "#b5713a";
const INK = "#0f172a";

/** Latin digits → Persian digits for the Persian template. */
function faDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
}

function ttlMinutes(): number {
  return Math.round(LOGIN_CODE_TTL_MS / 60_000);
}

function shell(body: string, dir: "rtl" | "ltr"): string {
  return `<!doctype html>
<html dir="${dir}" lang="${dir === "rtl" ? "fa" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f6f7f9;font-family:${dir === "rtl" ? "Tahoma, 'IranSans', sans-serif" : "Helvetica, Arial, sans-serif"};color:${INK}">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6e9ef">
      <div style="background:${INK};padding:22px 28px">
        <p style="margin:0;color:#fff;font-size:18px;font-weight:700">Rosie Atelier · آتلیه رزی</p>
        <p style="margin:6px 0 0;color:rgba(255,255,255,.7);font-size:12px">${dir === "rtl" ? "ورود به حساب کاربری" : "Account sign-in"}</p>
      </div>
      <div style="padding:26px 28px;line-height:1.9;font-size:14px">${body}</div>
      <div style="background:#faf7f3;padding:16px 28px;font-size:11px;color:#667085;border-top:1px solid #efe7dd">
        Rosie Atelier · <a href="${siteUrl()}" style="color:${BRAND}">${siteUrl().replace(/^https?:\/\//, "")}</a>
      </div>
    </div>
  </div>
</body></html>`;
}

export interface LoginMailInput {
  email: string;
  code: string;
  link: string;
  locale: Locale;
  /** true when the address had no account and one is created on verification */
  isNewAccount: boolean;
}

export interface LoginMail extends LoginMailInput {
  subject: string;
  html: string;
  text: string;
}

export function buildLoginMail(input: LoginMailInput): LoginMail {
  const fa = input.locale === "fa";
  const minutes = ttlMinutes();

  if (!fa) {
    const subject = `Your Rosie Atelier sign-in code: ${input.code}`;
    const html = shell(
      `<p style="margin:0 0 14px">Hello,</p>
       <p style="margin:0 0 14px">Use the code below to sign in${input.isNewAccount ? " and finish creating your account" : ""}:</p>
       <p style="margin:0 0 18px;text-align:center">
         <span style="display:inline-block;padding:14px 26px;border-radius:12px;background:#faf7f3;border:1px solid #efe7dd;font-size:28px;font-weight:700;letter-spacing:6px;color:${INK}">${input.code}</span>
       </p>
       <p style="margin:0 0 18px;text-align:center">
         <a href="${input.link}" style="display:inline-block;padding:12px 26px;border-radius:10px;background:${BRAND};color:#fff;text-decoration:none;font-weight:700">Sign in with one click</a>
       </p>
       <p style="margin:0 0 8px;color:#667085;font-size:12px">The code and the link both expire in ${minutes} minutes and can be used once.</p>
       <p style="margin:0;color:#667085;font-size:12px">If you did not request this, you can safely ignore this e-mail — nobody can sign in without the code.</p>`,
      "ltr",
    );
    const text = `Your Rosie Atelier sign-in code: ${input.code}
Or sign in with one click: ${input.link}
Valid for ${minutes} minutes, single use. If you did not request it, ignore this e-mail.`;
    return { ...input, subject, html, text };
  }

  const subject = `کد ورود شما به آتلیه رزی: ${input.code}`;
  const html = shell(
    `<p style="margin:0 0 14px">سلام،</p>
     <p style="margin:0 0 14px">برای ورود${input.isNewAccount ? " و تکمیل ساخت حساب" : ""} از کد زیر استفاده کنید:</p>
     <p style="margin:0 0 18px;text-align:center">
       <span style="display:inline-block;padding:14px 26px;border-radius:12px;background:#faf7f3;border:1px solid #efe7dd;font-size:28px;font-weight:700;letter-spacing:6px;color:${INK}">${input.code}</span>
     </p>
     <p style="margin:0 0 18px;text-align:center">
       <a href="${input.link}" style="display:inline-block;padding:12px 26px;border-radius:10px;background:${BRAND};color:#fff;text-decoration:none;font-weight:700">ورود با یک کلیک</a>
     </p>
     <p style="margin:0 0 8px;color:#667085;font-size:12px">کد و لینک تا ${faDigits(minutes)} دقیقه اعتبار دارند و فقط یک‌بار قابل استفاده‌اند.</p>
     <p style="margin:0;color:#667085;font-size:12px">اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید؛ بدون کد، ورود ممکن نیست.</p>`,
    "rtl",
  );
  const text = `کد ورود شما به آتلیه رزی: ${input.code}
ورود با یک کلیک: ${input.link}
اعتبار: ${minutes} دقیقه، فقط یک‌بار. اگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید.`;

  return { ...input, subject, html, text };
}

/** Queues the sign-in e-mail; returns the outbox record id (useful in tests). */
export async function sendLoginMail(
  input: LoginMailInput,
): Promise<{ id: string; status: string; error?: string }> {
  const mail = buildLoginMail(input);
  const message = await queueMessage({
    to: input.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    kind: "auth",
    meta: { purpose: "email-login", locale: input.locale },
  });
  return { id: message.id, status: message.status, error: message.error };
}
