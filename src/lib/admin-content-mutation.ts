import type { Artist } from "@/lib/types";

/** Persisted SiteContent changes made by a focused admin API operation. */
export type AdminContentMutation = {
  etag: string | null;
  artist?:
    | { kind: "upsert"; value: Artist }
    | { kind: "patch"; id: string; value: Partial<Artist> }
    | { kind: "remove"; ids: string[] };
};
