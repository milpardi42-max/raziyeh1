import { NextResponse } from "next/server";
import { requireArtistOrAdmin as requireApprovedArtistOrAdmin } from "@/lib/marketplace/guard";
import { getContent, mutateCollection } from "@/lib/data/store";
import { withNoStore } from "@/lib/http";
import type { Pattern, Product } from "@/lib/types";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function withContentEtag(response: NextResponse, etag: string) {
  response.headers.set("ETag", `"${etag}"`);
  return response;
}

function mutationErrorResponse(error: unknown, operation: string) {
  const code = error instanceof Error ? error.message : "";
  if (code === "invalid_category") {
    return NextResponse.json({ ok: false, error: code }, withNoStore({ status: 400 }));
  }
  if (code === "not_found") {
    return NextResponse.json({ ok: false, error: code }, withNoStore({ status: 404 }));
  }
  if (code === "forbidden") return unauthorized();

  console.error(`Failed to ${operation} artist pattern data`, error);
  return NextResponse.json({ ok: false, error: "mutation_failed" }, withNoStore({ status: 500 }));
}

function requireArtist() {
  return requireApprovedArtistOrAdmin();
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
  let index = 1;

  while (existing.some((item) => item.slug === candidate)) {
    candidate = `${slug}-${index}`;
    index += 1;
  }

  return candidate;
}

/** GET /api/artist/patterns — returns patterns belonging to the logged-in artist */
export async function GET() {
  const auth = await requireArtist();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const content = await getContent();

  if (session.role === "admin") {
    return NextResponse.json({ ok: true, patterns: content.patterns, products: content.products, categories: content.categories, spaces: content.spaces }, withNoStore());
  }

  const artistId = session.artistId;
  if (!artistId) {
    return NextResponse.json({ ok: true, patterns: [], products: [], categories: content.categories, spaces: content.spaces }, withNoStore());
  }

  return NextResponse.json(
    {
      ok: true,
      patterns: content.patterns.filter((p) => p.artistId === artistId),
      products: content.products.filter((p) => p.artistId === artistId),
      categories: content.categories,
      spaces: content.spaces,
    },
    withNoStore(),
  );
}

/** POST /api/artist/patterns — create a new pattern */
export async function POST(req: Request) {
  const auth = await requireArtist();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> & { _type?: "pattern" | "product" } | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));

  const artistId = session.role === "admin" ? ((body.artistId as string | null) ?? null) : (session.artistId ?? null);
  const requestedCategoryId = (body.categoryId as string | null) ?? null;
  const now = Date.now();

  if (body._type === "product") {
    const title = (body.title as Product["title"]) ?? { fa: "محصول جدید", en: "New product" };
    const productId = `prod-${crypto.randomBytes(6).toString("hex")}`;
    const sku = (body.sku as string) ?? `SKU-${now.toString(36).toUpperCase()}`;
    try {
      const { result: product, etag } = await mutateCollection("products", (products, content) => {
        const categoryId = requestedCategoryId ?? (content.categories[0]?.id ?? "");
        if (!categoryId || !content.categories.some((category) => category.id === categoryId)) {
          throw new Error("invalid_category");
        }

        const product: Product = {
          id: productId,
          sku,
          slug: makeUniqueSlug(
            ((body.slug as string) || title.fa || title.en || `product-${now.toString(36)}`),
            [...content.products, ...content.patterns],
          ),
          title,
          description: (body.description as Product["description"]) ?? { fa: "", en: "" },
          categoryId,
          patternId: (body.patternId as string | null) ?? null,
          artistId,
          price: (body.price as Product["price"]) ?? { fa: 0, en: 0 },
          compareAt: body.compareAt as Product["compareAt"],
          colors: (body.colors as Product["colors"]) ?? [],
          sizes: (body.sizes as Product["sizes"]) ?? [],
          specs: (body.specs as Product["specs"]) ?? [],
          materials: (body.materials as Product["materials"]) ?? { fa: "", en: "" },
          featured: false,
          bestSeller: false,
          isNew: true,
          order: products.length + 1,
        };
        return { items: [...products, product], result: product };
      });
      return withContentEtag(NextResponse.json({ ok: true, product }, withNoStore()), etag);
    } catch (error) {
      return mutationErrorResponse(error, "create");
    }
  }

  const b = body as Record<string, unknown>;
  const colorways = (b.colorways as Pattern["colorways"]) ?? [];
  const defaultImage =
    colorways.find((colorway) => colorway.isDefault)?.image ||
    colorways[0]?.image ||
    (b.image as string) ||
    "/images/collections/s01.jpg";
  const title = (b.title as Pattern["title"]) ?? { fa: "پترن جدید", en: "New pattern" };
  const patternId = `pat-${crypto.randomBytes(6).toString("hex")}`;
  const sku = (b.sku as string) ?? `PAT-${now.toString(36).toUpperCase()}`;
  const createdAt = new Date(now).toISOString();

  try {
    const { result: pattern, etag } = await mutateCollection("patterns", (patterns, content) => {
      const categoryId = requestedCategoryId ?? (content.categories[0]?.id ?? "");
      if (!categoryId || !content.categories.some((category) => category.id === categoryId)) {
        throw new Error("invalid_category");
      }

      const pattern: Pattern = {
        id: patternId,
        sku,
        slug: makeUniqueSlug(
          (b.slug as string) || title.fa || title.en || `pattern-${now.toString(36)}`,
          [...content.products, ...content.patterns],
        ),
        title,
        description: (b.description as Pattern["description"]) ?? { fa: "", en: "" },
        image: defaultImage,
        gallery: (b.gallery as string[]) ?? (colorways.map((colorway) => colorway.image).filter(Boolean) as string[]),
        categoryId,
        spaceIds: (b.spaceIds as string[]) ?? [],
        artistId,
        price: (b.price as Pattern["price"]) ?? { fa: 0, en: 0 },
        specs: (b.specs as Pattern["specs"]) ?? {
          repeat: { fa: "تکرار کامل", en: "Full repeat" },
          dpi: "300",
          formats: "PNG, PDF",
          colors: colorways.length || 4,
          scale: { fa: "بزرگ", en: "Large" },
        },
        palette: (b.palette as string[]) ?? colorways.map((colorway) => colorway.hex),
        colorways: colorways.length ? colorways : undefined,
        tags: (b.tags as string[]) ?? [],
        featured: false,
        trending: false,
        bestSeller: false,
        isNew: true,
        createdAt,
        likes: 0,
      };
      return { items: [...patterns, pattern], result: pattern };
    });
    return withContentEtag(NextResponse.json({ ok: true, pattern }, withNoStore()), etag);
  } catch (error) {
    return mutationErrorResponse(error, "create");
  }
}

/** PUT /api/artist/patterns — update an existing item */
export async function PUT(req: Request) {
  const auth = await requireArtist();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> & { _type?: "pattern" | "product"; id?: string } | null;
  if (!body?.id) return NextResponse.json({ ok: false, error: "invalid_payload" }, withNoStore({ status: 400 }));

  if (body._type === "product") {
    try {
      const { result: product, etag } = await mutateCollection("products", (products) => {
        const index = products.findIndex((item) => item.id === body.id);
        if (index < 0) throw new Error("not_found");
        if (session.role !== "admin" && products[index].artistId !== session.artistId) {
          throw new Error("forbidden");
        }

        const updated: Product = { ...products[index], ...body } as Product;
        const nextProducts = [...products];
        nextProducts[index] = updated;
        return { items: nextProducts, result: updated };
      });
      return withContentEtag(NextResponse.json({ ok: true, product }, withNoStore()), etag);
    } catch (error) {
      return mutationErrorResponse(error, "update");
    }
  }

  try {
    const { result: pattern, etag } = await mutateCollection("patterns", (patterns) => {
      const index = patterns.findIndex((item) => item.id === body.id);
      if (index < 0) throw new Error("not_found");
      if (session.role !== "admin" && patterns[index].artistId !== session.artistId) {
        throw new Error("forbidden");
      }

      const updated: Pattern = { ...patterns[index], ...body } as Pattern;
      const nextPatterns = [...patterns];
      nextPatterns[index] = updated;
      return { items: nextPatterns, result: updated };
    });
    return withContentEtag(NextResponse.json({ ok: true, pattern }, withNoStore()), etag);
  } catch (error) {
    return mutationErrorResponse(error, "update");
  }
}

/** DELETE /api/artist/patterns?id=…&type=pattern|product */
export async function DELETE(req: Request) {
  const auth = await requireArtist();
  if ("response" in auth) return auth.response;
  const session = auth.user;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const type = searchParams.get("type") ?? "pattern";
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, withNoStore({ status: 400 }));

  if (type === "product") {
    try {
      const { etag } = await mutateCollection("products", (products) => {
        const item = products.find((product) => product.id === id);
        if (!item) throw new Error("not_found");
        if (session.role !== "admin" && item.artistId !== session.artistId) throw new Error("forbidden");
        return { items: products.filter((product) => product.id !== id), result: undefined };
      });
      return withContentEtag(NextResponse.json({ ok: true }, withNoStore()), etag);
    } catch (error) {
      return mutationErrorResponse(error, "delete");
    }
  }

  try {
    const { etag } = await mutateCollection("patterns", (patterns) => {
      const item = patterns.find((pattern) => pattern.id === id);
      if (!item) throw new Error("not_found");
      if (session.role !== "admin" && item.artistId !== session.artistId) throw new Error("forbidden");
      return { items: patterns.filter((pattern) => pattern.id !== id), result: undefined };
    });
    return withContentEtag(NextResponse.json({ ok: true }, withNoStore()), etag);
  } catch (error) {
    return mutationErrorResponse(error, "delete");
  }
}
