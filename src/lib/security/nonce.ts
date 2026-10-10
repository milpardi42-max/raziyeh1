import "server-only";
import { headers } from "next/headers";

/** Nonce forwarded by middleware for inline scripts rendered by Server Components. */
export async function getCspNonce(): Promise<string | undefined> {
  return (await headers()).get("x-nonce") ?? undefined;
}
