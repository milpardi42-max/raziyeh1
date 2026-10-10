import { AsyncLocalStorage } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Concurrent probes: success in a single request alone can hide context leaks. */
export async function diagnose() {
  const request = new AsyncLocalStorage();
  const render = new AsyncLocalStorage();
  const failures = new Set();
  const check = (label, id) => {
    if (request.getStore() !== id || render.getStore() !== `render-${id}`) failures.add(label);
  };
  await Promise.all(Array.from({ length: 12 }, (_, id) => request.run(id, () => render.run(`render-${id}`, async () => {
    check("nested.run", id);
    await Promise.resolve();
    check("promise/await", id);
    const tasks = [
      ["queueMicrotask", queueMicrotask],
      ["nextTick", process.nextTick],
      ["setImmediate", setImmediate],
      ["setTimeout", callback => setTimeout(callback, id % 3)],
    ];
    await Promise.all(tasks.map(([label, schedule]) => new Promise(resolve => {
      schedule(() => { check(label, id); resolve(); });
    })));
    check("Promise.all", id);
    await readFile(fileURLToPath(import.meta.url));
    check("fs.readFile", id);
    const snapshot = AsyncLocalStorage.snapshot();
    request.run("other", () => snapshot(() => check("snapshot", id)));
  }))));
  if (request.getStore() !== undefined || render.getStore() !== undefined) failures.add("outside-request-isolation");
  return [...failures];
}

export async function report() {
  const failures = await diagnose();
  console.log(`[StackBlitz check] Node ${process.version}; Next is not running yet.`);
  if (failures.length) {
    console.error(`[StackBlitz check] Async context failed: ${failures.join(", ")}`);
    console.error("");
    console.error("[StackBlitz check] This is a known Next.js 15.5.x <-> WebContainer runtime incompatibility,");
    console.error("[StackBlitz check] NOT a bug in this project, and no in-project code change can fix it:");
    console.error("[StackBlitz check]   - https://github.com/vercel/next.js/issues/84026");
    console.error("[StackBlitz check]   - https://github.com/stackblitz/webcontainer-core/issues/1978");
    console.error("[StackBlitz check] The context loss happens in the runtime itself (native await/fs scope tracking,");
    console.error("[StackBlitz check] below the preload), so do NOT remove Next's request-store checks as a shortcut.");
    console.error("");
    console.error("[StackBlitz check] Working options:");
    console.error("[StackBlitz check]   1. Real Node runtime: the project's live Arena preview, or GitHub Codespaces:");
    console.error("[StackBlitz check]      open milpardi42-max/raziye1 -> Codespace on branch arena/01a0f283-raziye1,");
    console.error("[StackBlitz check]      then: npm install && npm run dev  (forward port 3000).");
    console.error("[StackBlitz check]   2. Deploy: one-click Netlify or Vercel (README.md, section \"Live / Deploy\").");
    console.error("[StackBlitz check]   3. Keep this WebContainer as a code editor only: edits are saved locally;");
    console.error("[StackBlitz check]      run and test the app in a real Node environment.");
    console.error("");
    console.error("[StackBlitz check] پروب‌های حافظهٔ async در WebContainer شکست خوردند. این یک ناسازگاری شناخته‌شده");
    console.error("[StackBlitz check] بین Next.js 15.5.x و WebContainer است (باگ آپ‌استریم، نه مشکل کد پروژه) و با");
    console.error("[StackBlitz check] هیچ تغییری داخل پروژه برطرف نمی‌شود. راه‌های کارکردن:");
    console.error("[StackBlitz check]   ۱) محیط Node واقعی: پیش‌نمایش زندهٔ همین پروژه یا GitHub Codespaces");
    console.error("[StackBlitz check]      (npm install && npm run dev و فوروارد پورت 3000)");
    console.error("[StackBlitz check]   ۲) دیپلوی رایگان روی Netlify یا Vercel (بخش Live / Deploy در README)");
    console.error("[StackBlitz check]   ۳) این WebContainer را فقط برای ویرایش کد نگه دارید و اجرا/تست را در Node واقعی انجام دهید.");
    return false;
  }
  console.log("[StackBlitz check] Async context/isolation probes passed. This is not a complete Next.js compatibility guarantee.");
  return true;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (!await report()) process.exitCode = 1;
}
