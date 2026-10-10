import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { getContent, updateCollection } from "./store";

/**
 * User store — same dual-backend pattern as the content store.
 *  1. Upstash Redis  (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *  2. Local file     data/users.json
 *
 * Passwords are hashed with PBKDF2-SHA256. No plain-text is ever persisted.
 */

export type UserRole = "user" | "artist" | "admin";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** PBKDF2 hash: "pbkdf2:iterations:salt:hash" */
  passwordHash: string;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: string;
  artistId?: string; // linked Artist record if role === "artist"
  createdAt: string;
}

export type PublicUser = Omit<
  StoredUser,
  "passwordHash" | "passwordResetTokenHash" | "passwordResetExpiresAt"
>;

/* ---------- helpers ---------- */
const ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, 32, "sha256", (err, key) => {
      if (err) reject(err);
      else resolve(key.toString("hex"));
    });
  });
  return `pbkdf2:${ITERATIONS}:${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const [, iter, salt, expected] = parts;
  const hash = await new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(password, salt, Number(iter), 32, "sha256", (err, key) => {
      if (err) reject(err);
      else resolve(key.toString("hex"));
    });
  });
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
}

/* ---------- Redis backend ---------- */
const USER_KEY = "rosie-atelier:users";
const FILE_PATH = path.join(process.cwd(), "data", "users.json");

function redisEnabled() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisCmd(args: string[]) {
  const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()) as { result: unknown };
}

/* ---------- file backend ---------- */
async function fileRead(): Promise<StoredUser[]> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf8");
    return JSON.parse(raw) as StoredUser[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function fileWrite(users: StoredUser[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(users, null, 2), "utf8");
}

/* ---------- public API ---------- */
export async function getAllUsers(options: { strict?: boolean } = {}): Promise<StoredUser[]> {
  try {
    if (redisEnabled()) {
      const { result } = await redisCmd(["GET", USER_KEY]);
      if (typeof result === "string") return JSON.parse(result) as StoredUser[];
      return [];
    }
    return await fileRead();
  } catch (error) {
    if (options.strict) throw error;
    return [];
  }
}

export async function saveAllUsers(users: StoredUser[]): Promise<void> {
  if (redisEnabled()) {
    await redisCmd(["SET", USER_KEY, JSON.stringify(users)]);
  } else {
    await fileWrite(users);
  }
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const users = await getAllUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  const users = await getAllUsers();
  return users.find((u) => u.id === id) ?? null;
}

export interface ArtistSignupExtra {
  phone?: string;
  city?: string;
  specialty?: string;
  instagram?: string;
  portfolioUrl?: string;
  /** Studio / brand name (seller registration) */
  studioName?: string;
  /** Years of practice (seller registration) */
  experience?: string;
  /** Short "about" written by the designer — becomes the public bio */
  bio?: string;
  /** Selected membership plan */
  planId?: "starter" | "pro" | "studio";
  /** Delivery formats the designer declared (format ids, already validated) */
  formats?: string[];
  /** Product families the designer works in (family ids, already validated) */
  families?: string[];
  /** Timestamp of the accepted seller terms */
  termsAt?: string;
}

export async function createUser(
  name: string,
  email: string,
  password: string,
  role: UserRole = "user",
  artistId?: string,
  signupExtra?: ArtistSignupExtra,
): Promise<StoredUser> {
  const users = await getAllUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("email_taken");
  }

  const userId = `usr-${crypto.randomBytes(8).toString("hex")}`;

  let resolvedArtistId: string | undefined;

  if (role === "artist") {
    if (artistId) {
      // Explicitly provided (admin assigning an existing Artist record)
      resolvedArtistId = artistId;
    } else {
      // Self-registration via /creators/join — create a fresh "pending" Artist record
      resolvedArtistId = await createPendingArtist(userId, name, email, signupExtra);
    }
  }

  const user: StoredUser = {
    id: userId,
    name,
    email: email.toLowerCase().trim(),
    role,
    passwordHash: await hashPassword(password),
    ...(resolvedArtistId ? { artistId: resolvedArtistId } : {}),
    createdAt: new Date().toISOString(),
  };
  await saveAllUsers([...users, user]);
  return user;
}

/**
 * Creates a new Artist record with status "pending" linked to the given user.
 * Called automatically during artist self-registration.
 */
async function createPendingArtist(
  userId: string,
  name: string,
  _email: string,
  extra?: ArtistSignupExtra,
): Promise<string> {
  const content = await getContent();

  // Derive a unique slug from the name
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "artist";

  let slug = base;
  let i = 1;
  while (content.artists.some((a) => a.slug === slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }

  const artistId = `artist-${crypto.randomBytes(8).toString("hex")}`;

  const cityVal = extra?.city?.trim() || "";
  const instagramHandle = extra?.instagram?.replace(/^@/, "").trim() || undefined;
  const planId = extra?.planId || "pro";

  const planNames: Record<"starter" | "pro" | "studio", { fa: string; en: string }> = {
    starter: { fa: "عضویت پایه (Basic)", en: "Basic Membership" },
    pro: { fa: "عضویت حرفه‌ای هنرمند (Artist Pro)", en: "Artist Pro Membership" },
    studio: { fa: "عضویت استودیو ویژه اساتید (Studio VIP)", en: "Studio VIP Master Membership" },
  };

  const defaultServices = [
    {
      id: `srv-${crypto.randomBytes(6).toString("hex")}`,
      title: {
        fa: extra?.specialty?.includes("پتینه")
          ? "اجرای پتینه دکوراتیو و بافت لوکس دیوار"
          : "طراحی پترن اختصاصی و انحصاری پروژه",
        en: extra?.specialty?.includes("پتینه")
          ? "Custom Decorative Patina & Wall Texture"
          : "Bespoke Architectural Pattern Design",
      },
      category: extra?.specialty?.includes("پتینه") ? ("patina" as const) : ("custom_pattern" as const),
      categoryLabel: {
        fa: extra?.specialty?.includes("پتینه") ? "پتینه و بافت دیوار" : "طراحی پترن و پترن",
        en: extra?.specialty?.includes("پتینه") ? "Wall Patina" : "Custom Pattern",
      },
      description: {
        fa: "ارائه خدمات سفارشی و اجرای پروژه منطبق با سلیقه کارفرما و مشخصات فضا.",
        en: "Custom bespoke execution tailored to client aesthetic and architectural specifications.",
      },
      price: { fa: 450000, en: 18 },
      priceUnit: { fa: "به ازای هر متر مربع / واحد", en: "per sq.m / unit" },
      deliveryTime: { fa: "۷ تا ۱۰ روز کاری", en: "7-10 business days" },
      image: "/images/products/wallpaper-botanical.jpg",
      featured: true,
      active: true,
    },
  ];

  const newArtist = {
    id: artistId,
    slug,
    name: { fa: name, en: name },
    profession: {
      fa: extra?.specialty || "هنرمند طراح و مجری پتینه",
      en: extra?.specialty || "Designer & Patina Artist",
    },
    bio: { fa: extra?.bio?.trim() ?? "", en: extra?.bio?.trim() ?? "" },
    avatar: "/images/placeholders/artist-avatar.svg",
    cover: "/images/placeholders/artist-cover.svg",
    location: { fa: cityVal, en: cityVal },
    social: {
      ...(instagramHandle ? { instagram: instagramHandle } : {}),
      ...(extra?.portfolioUrl ? { website: extra.portfolioUrl } : {}),
    },
    featured: false,
    followers: 0,
    rating: 0,
    reviewsCount: 0,
    tags: [
      extra?.specialty?.includes("پتینه") ? "patina" : "surface-design",
      "custom-art",
    ],
    userId,
    status: "approved" as const, // approved so new artists immediately appear on the artists page!
    revenueSharePct: content.financialConfig?.defaultArtistSharePct ?? 35,
    licenseType: "standard" as const,
    acceptsCommissions: true,
    commissionNotice: {
      fa: "آماده پذیرش سفارش‌های اختصاصی و پروژه‌های طراحی و اجرا.",
      en: "Accepting custom commissions and bespoke design/execution projects.",
    },
    subscription: {
      planId,
      planName: planNames[planId],
      status: "active" as const,
      validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      autoRenew: true,
      badge: {
        fa: planId === "studio" ? "استاد برگزیده VIP" : planId === "pro" ? "هنرمند ویژه Pro" : "طراح عضو",
        en: planId === "studio" ? "Master VIP" : planId === "pro" ? "Pro Artist" : "Member Designer",
      },
    },
    services: defaultServices,
    inquiries: [],
    ...(extra?.phone ? { signupPhone: extra.phone } : {}),
    ...(extra?.city ? { signupCity: extra.city } : {}),
    ...(extra?.specialty ? { signupSpecialty: extra.specialty } : {}),
    ...(extra?.portfolioUrl ? { signupPortfolioUrl: extra.portfolioUrl } : {}),
    ...(extra?.studioName ? { signupStudio: extra.studioName } : {}),
    ...(extra?.experience ? { signupExperience: extra.experience } : {}),
    ...(extra?.formats?.length ? { signupFormats: extra.formats } : {}),
    ...(extra?.families?.length ? { signupFamilies: extra.families } : {}),
    ...(extra?.termsAt ? { signupTermsAt: extra.termsAt } : {}),
  };

  await updateCollection("artists", [...content.artists, newArtist]);
  return artistId;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<StoredUser, "name" | "artistId" | "role" | "passwordHash" | "passwordResetTokenHash" | "passwordResetExpiresAt">>,
): Promise<StoredUser | null> {
  const users = await getAllUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;

  // No fallback to artists[0] — adminAssigning role must provide an explicit artistId,
  // or leave it blank (the artist may not yet have a linked profile).

  const updated = { ...users[idx], ...patch };
  users[idx] = updated;
  await saveAllUsers(users);
  return updated;
}

export function toPublicUser(u: StoredUser): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, passwordResetTokenHash, passwordResetExpiresAt, ...pub } = u;
  return pub;
}
