"use client";

import {
  CalendarClock,
  Home,
  LayoutDashboard,
  Menu,
  Palette,
  Save,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

/** Mobile quick navigation for the admin console (< lg breakpoint). */
export function MobileAdminNav({
  activeSection,
  onSelect,
  onOpenMenu,
  dirty,
  saving,
  onSave,
  pendingCount,
}: {
  activeSection: string;
  onSelect: (id: string) => void;
  onOpenMenu: () => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  pendingCount: number;
}) {
  const primary: NavItem[] = [
    { id: "dashboard", label: "داشبورد", icon: <LayoutDashboard className="h-5 w-5" /> },
    { id: "reservations", label: "رزروها", icon: <CalendarClock className="h-5 w-5" /> },
    { id: "home", label: "خانه", icon: <Home className="h-5 w-5" /> },
    { id: "patterns", label: "پترن‌ها", icon: <Palette className="h-5 w-5" /> },
    { id: "buyers", label: "خریداران", icon: <ShoppingBag className="h-5 w-5" /> },
  ];

  const isActive = (id: string) => activeSection === id;
  const moreActive = !primary.some((item) => item.id === activeSection);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e2e6ea] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="منوی مدیریت موبایل"
      >
        <div className="flex items-stretch">
          {primary.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                isActive(item.id) ? "text-accent" : "text-foreground-secondary",
              )}
              aria-current={isActive(item.id) ? "page" : undefined}
            >
              {item.icon}
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenMenu}
            className={cn(
              "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
              moreActive ? "text-accent" : "text-foreground-secondary",
            )}
            aria-label={pendingCount > 0 ? `سایر بخش‌ها؛ ${pendingCount} طراح در انتظار بررسی` : "سایر بخش‌ها"}
            aria-haspopup="true"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-tight">بیشتر</span>
            {pendingCount > 0 && (
              <span className="absolute top-1 right-1/2 translate-x-3 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {dirty && (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          aria-label={saving ? "در حال ذخیره تغییرات" : "ذخیره تغییرات"}
          aria-busy={saving}
          className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-4 z-30 flex min-h-[48px] items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition-transform active:scale-95 disabled:opacity-60 lg:hidden"
        >
          <Save className="h-4 w-4" />
          {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
        </button>
      )}

      {/* Keep page content clear of the fixed bottom bar and iOS home indicator. */}
      <div className="h-[calc(72px+env(safe-area-inset-bottom))] shrink-0 lg:hidden" aria-hidden="true" />
    </>
  );
}
