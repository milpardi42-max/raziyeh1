import type { SessionUser } from "./session";

/**
 * Admin bypass. By default the admin panel requires a signed-in admin session.
 *
 *   ROSIE_ADMIN_BYPASS=1   — opens the admin panel without authentication.
 *                            ONLY use for local development / Stackblitz preview,
 *                            NEVER in production. When NODE_ENV=production this
 *                            flag is FORCIBLY IGNORED regardless of the env var.
 */
export const ADMIN_LOGIN_DISABLED =
  process.env.NODE_ENV !== "production" && process.env.ROSIE_ADMIN_BYPASS === "1";

export const TEMPORARY_ADMIN_SESSION: SessionUser = {
  id: "temporary-admin",
  name: "Temporary Admin",
  email: "temporary-admin@local.invalid",
  role: "admin",
};
