import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { AcademyReservation, ReservationStatus } from "../types";
import type { Localized } from "../i18n/types";

const KEY = "rosie-atelier:academy-reservations";
const FILE = path.join(process.cwd(), "data", "reservations.json");
const LOCK_FILE = `${FILE}.lock`;
const LOCK_WAIT_MS = 5_000;
const LOCK_STALE_MS = 5 * 60_000;

function redisEnabled() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisCmd(args: string[]) {
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL!, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`redis ${response.status}`);
  return (await response.json()) as { result: unknown };
}

async function read(): Promise<AcademyReservation[]> {
  let raw: unknown;
  if (redisEnabled()) {
    raw = (await redisCmd(["GET", KEY])).result;
    if (raw === null || raw === undefined) return [];
  } else {
    try {
      raw = await fs.readFile(FILE, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  if (typeof raw !== "string") throw new Error("invalid_reservations_store");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("invalid_reservations_store");
  return parsed as AcademyReservation[];
}

async function writeLocal(reservations: AcademyReservation[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const temporary = `${FILE}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(reservations, null, 2), { encoding: "utf8", flag: "wx" });
    await fs.rename(temporary, FILE);
  } finally {
    await fs.unlink(temporary).catch(() => undefined);
  }
}

/** Serialize file-backed read/modify/write operations across concurrent local requests. */
async function withFileLock<T>(operation: () => Promise<T>): Promise<T> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;
  let lock: Awaited<ReturnType<typeof fs.open>> | null = null;

  while (!lock) {
    try {
      const opened = await fs.open(LOCK_FILE, "wx");
      try {
        await opened.writeFile(`${process.pid}:${Date.now()}`);
        lock = opened;
      } catch (error) {
        await opened.close().catch(() => undefined);
        await fs.unlink(LOCK_FILE).catch(() => undefined);
        throw error;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;

      try {
        const stat = await fs.stat(LOCK_FILE);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.unlink(LOCK_FILE).catch(() => undefined);
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw statError;
      }

      if (Date.now() >= deadline) throw new Error("reservation_store_busy");
      await new Promise<void>((resolve) => setTimeout(resolve, 25 + Math.random() * 50));
    }
  }

  try {
    return await operation();
  } finally {
    await lock.close().catch(() => undefined);
    await fs.unlink(LOCK_FILE).catch(() => undefined);
  }
}

const CREATE_RESERVATION_LUA = `
local reservations = cjson.decode(redis.call('GET', KEYS[1]) or '[]')
local input = cjson.decode(ARGV[1])
local email = string.lower(tostring(input.email or ''))
local userId = input.userId

for _, reservation in ipairs(reservations) do
  local sameEmail = string.lower(tostring(reservation.email or '')) == email
  local sameUser = userId ~= nil and reservation.userId == userId
  if reservation.eventSlug == input.eventSlug and reservation.status ~= 'cancelled' and (sameEmail or sameUser) then
    local changed = false
    if input.accessGranted == true and reservation.accessGranted ~= true then
      reservation.accessGranted = true
      changed = true
    end
    if input.paymentRequired ~= nil and reservation.paymentRequired ~= input.paymentRequired then
      reservation.paymentRequired = input.paymentRequired
      changed = true
    end
    if changed then redis.call('SET', KEYS[1], cjson.encode(reservations)) end
    return cjson.encode({ kind = 'duplicate', reservation = reservation })
  end
end

local capacity = tonumber(ARGV[2]) or 0
local activeCount = 0
for _, reservation in ipairs(reservations) do
  if reservation.eventSlug == input.eventSlug and reservation.status ~= 'cancelled' then
    activeCount = activeCount + 1
  end
end
if capacity > 0 and activeCount >= capacity then
  return cjson.encode({ kind = 'event_full' })
end

table.insert(reservations, input)
redis.call('SET', KEYS[1], cjson.encode(reservations))
return cjson.encode({ kind = 'created', reservation = input })
`;

const UPDATE_RESERVATION_LUA = `
local reservations = cjson.decode(redis.call('GET', KEYS[1]) or '[]')
local value = cjson.decode(ARGV[3])
for _, reservation in ipairs(reservations) do
  if reservation.id == ARGV[1] then
    reservation[ARGV[2]] = value
    redis.call('SET', KEYS[1], cjson.encode(reservations))
    return cjson.encode(reservation)
  end
end
return ''
`;

function parseRedisJson<T>(value: unknown, label: string): T {
  if (typeof value !== "string") throw new Error(`invalid_${label}_response`);
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`invalid_${label}_response`);
  }
}

async function updateRedisReservation<K extends "status" | "accessGranted">(
  id: string,
  field: K,
  value: K extends "status" ? ReservationStatus : boolean,
): Promise<AcademyReservation | null> {
  const result = await redisCmd([
    "EVAL", UPDATE_RESERVATION_LUA, "1", KEY, id, field, JSON.stringify(value),
  ]);
  if (result.result === "") return null;
  return parseRedisJson<AcademyReservation>(result.result, "reservation_update");
}

export async function getAllReservations(): Promise<AcademyReservation[]> {
  return read();
}

export async function updateReservationStatus(id: string, status: ReservationStatus): Promise<AcademyReservation | null> {
  if (redisEnabled()) return updateRedisReservation(id, "status", status);
  return withFileLock(async () => {
    const reservations = await read();
    const index = reservations.findIndex((reservation) => reservation.id === id);
    if (index < 0) return null;
    const updated = { ...reservations[index], status };
    reservations[index] = updated;
    await writeLocal(reservations);
    return updated;
  });
}

export async function updateReservationAccess(id: string, accessGranted: boolean): Promise<AcademyReservation | null> {
  if (redisEnabled()) return updateRedisReservation(id, "accessGranted", accessGranted);
  return withFileLock(async () => {
    const reservations = await read();
    const index = reservations.findIndex((reservation) => reservation.id === id);
    if (index < 0) return null;
    const updated = { ...reservations[index], accessGranted };
    reservations[index] = updated;
    await writeLocal(reservations);
    return updated;
  });
}

export async function getUserReservations(userId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return (await read())
    .filter((reservation) => reservation.userId === userId || reservation.email.trim().toLowerCase() === normalizedEmail)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export async function createReservation(input: {
  eventSlug: string;
  eventType: "course" | "workshop" | "webinar";
  eventTitle: Localized;
  startsAt: string;
  capacity: number;
  userId?: string;
  name: string;
  email: string;
  accessGranted?: boolean;
  paymentRequired?: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  const capacity = Number.isFinite(input.capacity) ? Math.max(0, Math.floor(input.capacity)) : 0;
  const reservation: AcademyReservation = {
    id: `res-${crypto.randomBytes(8).toString("hex")}`,
    eventSlug: input.eventSlug,
    eventType: input.eventType,
    eventTitle: input.eventTitle,
    startsAt: input.startsAt,
    ...(input.userId ? { userId: input.userId } : {}),
    name: input.name.trim().slice(0, 80),
    email,
    createdAt: new Date().toISOString(),
    status: "reserved",
    ...(input.accessGranted !== undefined ? { accessGranted: input.accessGranted } : {}),
    ...(input.paymentRequired !== undefined ? { paymentRequired: input.paymentRequired } : {}),
  };

  if (redisEnabled()) {
    const { result } = await redisCmd([
      "EVAL", CREATE_RESERVATION_LUA, "1", KEY, JSON.stringify(reservation), String(capacity),
    ]);
    const outcome = parseRedisJson<{ kind: "created" | "duplicate" | "event_full"; reservation?: AcademyReservation }>(result, "reservation_create");
    if (outcome.kind === "event_full") throw new Error("event_full");
    if ((outcome.kind !== "created" && outcome.kind !== "duplicate") || !outcome.reservation) {
      throw new Error("invalid_reservation_create_response");
    }
    return outcome.reservation;
  }

  return withFileLock(async () => {
    const reservations = await read();
    const duplicate = reservations.find((existing) =>
      existing.eventSlug === input.eventSlug &&
      existing.status !== "cancelled" &&
      (existing.email.trim().toLowerCase() === email || (input.userId && existing.userId === input.userId)),
    );
    if (duplicate) {
      const updated = {
        ...duplicate,
        ...(input.accessGranted ? { accessGranted: true } : {}),
        ...(input.paymentRequired !== undefined ? { paymentRequired: input.paymentRequired } : {}),
      };
      if (updated.accessGranted !== duplicate.accessGranted || updated.paymentRequired !== duplicate.paymentRequired) {
        await writeLocal(reservations.map((existing) => existing.id === duplicate.id ? updated : existing));
      }
      return updated;
    }

    const activeCount = reservations.filter(
      (existing) => existing.eventSlug === input.eventSlug && existing.status !== "cancelled",
    ).length;
    // Courses are self-paced: unlimited seats, no schedule.
    if (capacity > 0 && activeCount >= capacity) throw new Error("event_full");

    await writeLocal([...reservations, reservation]);
    return reservation;
  });
}
