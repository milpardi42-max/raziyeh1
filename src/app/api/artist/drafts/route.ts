import { NextResponse } from "next/server";
import { requireArtistOrAdmin as requireApprovedArtistOrAdmin } from "@/lib/marketplace/guard";
import { getContent, mutateCollection } from "@/lib/data/store";
import { withNoStore } from "@/lib/http";
import crypto from "crypto";
import type { DraftStatus, EducationItem, Portfolio } from "@/lib/types";

export const dynamic = "force-dynamic";

function withContentEtag(response: NextResponse, etag: string) {
  response.headers.set("ETag", `"${etag}"`);
  return response;
}

function mutationErrorResponse(error: unknown, operation: string) {
  const code = error instanceof Error ? error.message : "";
  if (code === "not_found") {
    return NextResponse.json({ ok: false, error: code }, withNoStore({ status: 404 }));
  }
  if (code === "forbidden") return unauthorized();
  if (code === "invalid_status_transition") {
    return NextResponse.json({ ok: false, error: code }, withNoStore({ status: 400 }));
  }
  if (code === "cannot_delete_published") {
    return NextResponse.json({ ok: false, error: code }, withNoStore({ status: 403 }));
  }

  console.error(`Failed to ${operation} artist draft`, error);
  return NextResponse.json({ ok: false, error: "mutation_failed" }, withNoStore({ status: 500 }));
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, withNoStore({ status: 401 }));
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "item";
}

function makeUniqueSlug(base: string, existing: Array<{ slug: string }>) {
  const slug = toSlug(base) || `item-${Date.now().toString(36)}`;
  let candidate = slug;
  let i = 1;
  while (existing.some((x) => x.slug === candidate)) {
    candidate = `${slug}-${i}`;
    i += 1;
  }
  return candidate;
}

/**
 * GET /api/artist/drafts?type=portfolio|education
 * Returns the artist's own drafts (all statuses).
 * Admin gets everything.
 */
export async function GET(req: Request) {
  const auth = await requireApprovedArtistOrAdmin();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "portfolio";

  const content = await getContent();

  if (type === "education") {
    const items =
      session.role === "admin"
        ? content.education
        : content.education.filter((e) => e.authorId === session.artistId);
    return NextResponse.json({ ok: true, items }, withNoStore());
  }

  // portfolio (default)
  const items =
    session.role === "admin"
      ? content.portfolios
      : content.portfolios.filter((p) => p.artistId === session.artistId);
  return NextResponse.json({ ok: true, items }, withNoStore());
}

/**
 * POST /api/artist/drafts?type=portfolio|education
 * Creates a new draft. draftStatus defaults to "draft".
 */
export async function POST(req: Request) {
  const auth = await requireApprovedArtistOrAdmin();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "portfolio";

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));
  }

  const artistId = session.role === "admin"
    ? ((body.artistId as string | null) ?? null)
    : (session.artistId ?? null);

  const now = new Date();

  if (type === "education") {
    const title = (body.title as EducationItem["title"]) ?? { fa: "درس جدید", en: "New lesson" };
    const itemId = `edu-${crypto.randomBytes(6).toString("hex")}`;
    try {
      const { result: item, etag } = await mutateCollection("education", (education, content) => {
        const item: EducationItem = {
          id: itemId,
          slug: makeUniqueSlug(
            (body.slug as string) || title.en || title.fa,
            education,
          ),
          type: (body.type as EducationItem["type"]) ?? "article",
          title,
          excerpt: (body.excerpt as EducationItem["excerpt"]) ?? { fa: "", en: "" },
          body: (body.body as EducationItem["body"]) ?? { fa: "", en: "" },
          image: (body.image as string) ?? "/images/collections/s01.jpg",
          authorId: artistId ?? "",
          difficulty: (body.difficulty as EducationItem["difficulty"]) ?? "beginner",
          durationMin: Number(body.durationMin ?? 30),
          lessons: Number(body.lessons ?? 1),
          categoryId: (body.categoryId as string) ?? content.categories[0]?.id ?? "",
          patternIds: (body.patternIds as string[]) ?? [],
          productIds: (body.productIds as string[]) ?? [],
          featured: false,
          popular: false,
          publishedAt: now.toISOString(),
          draftStatus: (body.draftStatus as DraftStatus) ?? "draft",
        };
        return { items: [...education, item], result: item };
      });
      return withContentEtag(NextResponse.json({ ok: true, item }, withNoStore()), etag);
    } catch (error) {
      return mutationErrorResponse(error, "create");
    }
  }

  // portfolio
  const title = (body.title as Portfolio["title"]) ?? { fa: "پروژه جدید", en: "New project" };
  const portfolioId = `pf-${crypto.randomBytes(6).toString("hex")}`;
  try {
    const { result: portfolio, etag } = await mutateCollection("portfolios", (portfolios, content) => {
      const portfolio: Portfolio = {
        showcase: "artist",
        id: portfolioId,
        slug: makeUniqueSlug(
          (body.slug as string) || title.en || title.fa,
          portfolios,
        ),
        title,
        subtitle: (body.subtitle as Portfolio["subtitle"]) ?? { fa: "", en: "" },
        intro: (body.intro as Portfolio["intro"]) ?? { fa: "", en: "" },
        story: (body.story as Portfolio["story"]) ?? [],
        cover: (body.cover as string) ?? "/images/portfolios/pf-bedroom.jpg",
        gallery: (body.gallery as string[]) ?? [],
        artistId,
        patternIds: (body.patternIds as string[]) ?? [],
        productIds: (body.productIds as string[]) ?? [],
        client: (body.client as Portfolio["client"]) ?? { fa: "خصوصی", en: "Private" },
        location: (body.location as Portfolio["location"]) ?? { fa: "", en: "" },
        year: Number(body.year ?? now.getFullYear()),
        scope: (body.scope as Portfolio["scope"]) ?? { fa: "", en: "" },
        categoryId: (body.categoryId as string) ?? content.categories[0]?.id ?? "",
        featured: false,
        isProject: Boolean(body.isProject ?? false),
        size: (body.size as Portfolio["size"]) ?? "square",
        draftStatus: session.role === "admin" ? (body.draftStatus as DraftStatus) ?? "draft" : "draft",
      };
      return { items: [...portfolios, portfolio], result: portfolio };
    });
    return withContentEtag(NextResponse.json({ ok: true, portfolio }, withNoStore()), etag);
  } catch (error) {
    return mutationErrorResponse(error, "create");
  }
}

/**
 * PATCH /api/artist/drafts
 * Update a draft (edit fields) or change its draftStatus.
 * Artist can: draft → pending_review (submit), pending_review → draft (withdraw).
 * Admin can: pending_review → published | rejected, and set rejectionNote.
 */
export async function PATCH(req: Request) {
  const auth = await requireApprovedArtistOrAdmin();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> & {
    id?: string;
    _type?: "portfolio" | "education";
  } | null;
  if (!body?.id) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));
  }

  const type = body._type ?? "portfolio";

  if (type === "education") {
    try {
      const { result: item, etag } = await mutateCollection("education", (education) => {
        const index = education.findIndex((candidate) => candidate.id === body.id);
        if (index < 0) throw new Error("not_found");
        const existing = education[index];

        if (session.role !== "admin" && existing.authorId !== session.artistId) {
          throw new Error("forbidden");
        }

        if (session.role !== "admin" && body.draftStatus !== undefined) {
          const allowed: Partial<Record<DraftStatus, DraftStatus[]>> = {
            draft: ["pending_review"],
            pending_review: ["draft"],
          };
          const from = existing.draftStatus ?? "draft";
          const to = body.draftStatus as DraftStatus;
          if (!allowed[from]?.includes(to)) throw new Error("invalid_status_transition");
        }

        const updated: EducationItem = {
          ...existing,
          ...body,
          id: existing.id,
          authorId: existing.authorId,
        } as EducationItem;
        const nextEducation = [...education];
        nextEducation[index] = updated;
        return { items: nextEducation, result: updated };
      });
      return withContentEtag(NextResponse.json({ ok: true, item }, withNoStore()), etag);
    } catch (error) {
      return mutationErrorResponse(error, "update");
    }
  }

  // portfolio
  try {
    const { result: portfolio, etag } = await mutateCollection("portfolios", (portfolios) => {
      const index = portfolios.findIndex((candidate) => candidate.id === body.id);
      if (index < 0) throw new Error("not_found");
      const existing = portfolios[index];

      if (session.role !== "admin" && existing.artistId !== session.artistId) {
        throw new Error("forbidden");
      }

      if (session.role !== "admin" && body.draftStatus !== undefined) {
        const allowed: Partial<Record<DraftStatus, DraftStatus[]>> = {
          draft: ["pending_review"],
          pending_review: ["draft"],
        };
        const from = existing.draftStatus ?? "draft";
        const to = body.draftStatus as DraftStatus;
        if (!allowed[from]?.includes(to)) throw new Error("invalid_status_transition");
      }

      const updated: Portfolio = {
        ...existing,
        ...body,
        id: existing.id,
        artistId: existing.artistId,
        showcase: existing.showcase ?? (existing.draftStatus === undefined ? "site" : "artist"),
      } as Portfolio;
      const nextPortfolios = [...portfolios];
      nextPortfolios[index] = updated;
      return { items: nextPortfolios, result: updated };
    });
    return withContentEtag(NextResponse.json({ ok: true, portfolio }, withNoStore()), etag);
  } catch (error) {
    return mutationErrorResponse(error, "update");
  }
}

/** DELETE /api/artist/drafts?id=…&type=portfolio|education */
export async function DELETE(req: Request) {
  const auth = await requireApprovedArtistOrAdmin();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type") ?? "portfolio";
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, withNoStore({ status: 400 }));
  }

  if (type === "education") {
    try {
      const { etag } = await mutateCollection("education", (education) => {
        const item = education.find((candidate) => candidate.id === id);
        if (!item) throw new Error("not_found");
        if (session.role !== "admin" && item.authorId !== session.artistId) throw new Error("forbidden");
        // Only allow deleting drafts (not published content).
        if (session.role !== "admin" && item.draftStatus === "published") {
          throw new Error("cannot_delete_published");
        }
        return { items: education.filter((candidate) => candidate.id !== id), result: undefined };
      });
      return withContentEtag(NextResponse.json({ ok: true }, withNoStore()), etag);
    } catch (error) {
      return mutationErrorResponse(error, "delete");
    }
  }

  try {
    const { etag } = await mutateCollection("portfolios", (portfolios) => {
      const item = portfolios.find((candidate) => candidate.id === id);
      if (!item) throw new Error("not_found");
      if (session.role !== "admin" && item.artistId !== session.artistId) throw new Error("forbidden");
      if (session.role !== "admin" && item.draftStatus === "published") {
        throw new Error("cannot_delete_published");
      }
      return { items: portfolios.filter((candidate) => candidate.id !== id), result: undefined };
    });
    return withContentEtag(NextResponse.json({ ok: true }, withNoStore()), etag);
  } catch (error) {
    return mutationErrorResponse(error, "delete");
  }
}
