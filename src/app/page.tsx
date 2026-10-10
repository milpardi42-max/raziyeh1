import { redirect } from "next/navigation";

export default function RootPage(): never {
  // Locale selection is normally handled by middleware; keep this safe server-side fallback.
  redirect("/fa");
}
