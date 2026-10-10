const origin = process.env.SMOKE_ORIGIN ?? "http://localhost:3000";
let failed = false;
let hasAdminAccess = false;

try {
  const response = await fetch(new URL("/api/admin/session", origin), { signal: AbortSignal.timeout(180_000) });
  const body = await response.json();
  hasAdminAccess = response.ok && body.user?.role === "admin";
  const ok = response.ok && Object.hasOwn(body, "user");
  console.log(`${ok ? "PASS" : "FAIL"} /api/admin/session: HTTP ${response.status}`);
  if (!ok) failed = true;
} catch (error) {
  console.error(`FAIL /api/admin/session: ${error.message}`);
  failed = true;
}

const routes = [
  ["/fa", 200],
  ["/en", 200],
  ["/fa/portfolio", 200],
  ["/fa/artists", 200],
  ["/admin", 200],
  ["/api/auth/me", 200],
  ["/api/admin/stats", hasAdminAccess ? 200 : 401],
];

for (const [path, expected] of routes) {
  try {
    const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(180_000) });
    const body = await response.text();
    const ok = response.status === expected && !/Expected workUnitAsyncStorage to have a store|InvariantError|"__NEXT_ERROR_CODE":"E696"/.test(body);
    console.log(`${ok ? "PASS" : "FAIL"} ${path}: HTTP ${response.status} (expected ${expected})`);
    if (!ok) failed = true;
  } catch (error) {
    console.error(`FAIL ${path}: ${error.message}`);
    failed = true;
  }
}
if (failed) {
  console.error("Smoke test failed. Inspect these results and the Next terminal log; do not mask runtime or authorization errors.");
  process.exitCode = 1;
} else console.log("HTTP checks passed. Browser hydration/playback and native upload processing are separate checks.");
