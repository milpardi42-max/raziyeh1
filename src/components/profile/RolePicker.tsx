"use client";

import { Palette, ShoppingBag } from "lucide-react";
import { useLocale } from "@/components/providers/AppProviders";

export type AccountRole = "user" | "artist";

interface RolePickerProps {
  value: AccountRole;
  onChange: (role: AccountRole) => void;
  disabled?: boolean;
}

/**
 * "نوع حساب" — the buyer / artist choice.
 *
 * Shared by every signup method (password, e-mail code, Google) so the choice
 * means the same thing everywhere: "artist" creates a seller account together
 * with a *pending* showcase profile, "buyer" a plain customer account.
 */
export function RolePicker({ value, onChange, disabled }: RolePickerProps) {
  const { locale } = useLocale();
  const fa = locale === "fa";

  const options: { id: AccountRole; label: string; hint: string; icon: typeof ShoppingBag }[] = [
    {
      id: "user",
      label: fa ? "خریدار" : "Buyer",
      hint: fa ? "خرید پترن و شرکت در دوره‌ها" : "Buy patterns and join classes",
      icon: ShoppingBag,
    },
    {
      id: "artist",
      label: fa ? "هنرمند / طراح" : "Artist / Designer",
      hint: fa ? "فروش طرح و دریافت پروژه" : "Sell designs and take commissions",
      icon: Palette,
    },
  ];

  return (
    <div role="radiogroup" aria-label={fa ? "نوع حساب" : "Account type"} className="auth-role">
      {options.map((option) => {
        const Icon = option.icon;
        const selected = value === option.id;
        return (
          <label
            key={option.id}
            className="auth-role__option"
            data-selected={selected ? "true" : "false"}
            data-disabled={disabled ? "true" : "false"}
          >
            <input
              type="radio"
              name="account_role"
              value={option.id}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option.id)}
              className="sr-only"
            />
            <Icon className="auth-role__icon" aria-hidden="true" />
            <span className="min-w-0">
              <span className="auth-role__label">{option.label}</span>
              <span className="auth-role__hint">{option.hint}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
