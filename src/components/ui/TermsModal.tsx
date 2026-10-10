"use client";

import { Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TERMS } from "@/lib/legal/terms";
import type { Locale } from "@/lib/i18n/types";

interface TermsModalProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  /** When provided, the modal shows a "read it, I agree" action */
  onAgree?: () => void;
}

/**
 * Clear, scrollable modal presenting the site terms & conditions.
 * Used from the signup form so users can read before (or while) agreeing.
 */
export function TermsModal({ open, onClose, locale, onAgree }: TermsModalProps) {
  const fa = locale === "fa";
  const t = TERMS[locale];

  return (
    <Modal open={open} onClose={onClose} label={t.title} className="max-w-2xl">
      <div className="px-6 pb-5 pt-14 md:px-10">
        {/* header */}
        <header className="border-b border-border pb-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            {fa ? "مقررات رسمی سایت" : "Official site policy"}
          </p>
          <h2 className="mt-1.5 text-xl font-bold text-foreground">{t.title}</h2>
          <p className="mt-1 text-xs text-muted">
            {fa ? "آخرین به‌روزرسانی: " : "Last updated: "}
            {t.lastUpdated}
          </p>
        </header>

        {/* intro */}
        {t.intro.map((p, i) => (
          <p key={i} className="mt-4 text-sm leading-7 text-foreground-secondary">
            {p}
          </p>
        ))}

        {/* sections */}
        {t.sections.map((s) => (
          <section key={s.title} className="mt-6">
            <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
            {s.paragraphs?.map((p, i) => (
              <p key={i} className="mt-2 text-sm leading-7 text-foreground-secondary">
                {p}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-2 space-y-2">
                {s.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-7 text-foreground-secondary">
                    <span aria-hidden className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className="mt-8 border-t border-border pt-4 text-xs leading-6 text-muted">
          {t.contactNote}
        </p>
      </div>

      {/* sticky footer: always visible while scrolling */}
      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-surface px-6 py-4 md:flex-row md:items-center md:justify-between md:px-10">
        <p className="text-xs leading-5 text-muted">
          {fa
            ? "تیک‌زدن گزینهٔ «موافقم» یعنی پذیرش کامل این متن."
            : "Checking the “I agree” box means you accept this document in full."}
        </p>
        {onAgree ? (
          <Button size="sm" onClick={onAgree} className="shrink-0">
            <Check className="h-4 w-4" />
            {fa ? "خواندم، موافقم" : "Read it — I agree"}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onClose} className="shrink-0">
            {fa ? "بستن" : "Close"}
          </Button>
        )}
      </div>
    </Modal>
  );
}
