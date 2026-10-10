import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export interface ChatMessage {
  id: string;
  sender: "customer" | "admin";
  body: string;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  name: string;
  email: string;
  status: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const KEY = "rosie-atelier:chats";
const FILE = path.join(process.cwd(), "data", "chat-conversations.json");
const redisEnabled = () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

async function redisCommand(args: string[]) {
  const response = await fetch(String(process.env.UPSTASH_REDIS_REST_URL), {
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

async function readAll(): Promise<ChatConversation[]> {
  if (redisEnabled()) {
    const { result } = await redisCommand(["GET", KEY]);
    return typeof result === "string" ? JSON.parse(result) as ChatConversation[] : [];
  }
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as ChatConversation[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(chats: ChatConversation[]) {
  const json = JSON.stringify(chats);
  if (redisEnabled()) {
    await redisCommand(["SET", KEY, json]);
    return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, json, "utf8");
}

export async function listChats(): Promise<ChatConversation[]> {
  return (await readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function findChat(id: string): Promise<ChatConversation | null> {
  return (await readAll()).find((chat) => chat.id === id) ?? null;
}

export async function createChat(name: string, email: string, body: string): Promise<ChatConversation> {
  const chats = await readAll();
  const now = new Date().toISOString();
  const chat: ChatConversation = {
    // This unguessable id doubles as the visitor's access token; no account is needed to chat.
    id: crypto.randomBytes(24).toString("hex"),
    name,
    email,
    status: "open",
    createdAt: now,
    updatedAt: now,
    messages: [{ id: crypto.randomUUID(), sender: "customer", body, createdAt: now }],
  };
  await writeAll([chat, ...chats]);
  return chat;
}

export async function addChatMessage(id: string, sender: ChatMessage["sender"], body: string): Promise<ChatConversation | null> {
  const chats = await readAll();
  const index = chats.findIndex((chat) => chat.id === id);
  if (index < 0) return null;
  const chat = chats[index];
  if (chat.status === "closed" && sender === "customer") return null;
  const now = new Date().toISOString();
  const updated = {
    ...chat,
    status: sender === "customer" ? "open" as const : chat.status,
    updatedAt: now,
    messages: [...chat.messages, { id: crypto.randomUUID(), sender, body, createdAt: now }],
  };
  chats[index] = updated;
  await writeAll(chats);
  return updated;
}

export async function setChatStatus(id: string, status: ChatConversation["status"]): Promise<ChatConversation | null> {
  const chats = await readAll();
  const index = chats.findIndex((chat) => chat.id === id);
  if (index < 0) return null;
  chats[index] = { ...chats[index], status, updatedAt: new Date().toISOString() };
  await writeAll(chats);
  return chats[index];
}
