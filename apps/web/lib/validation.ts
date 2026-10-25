import { z } from "zod";
import type { MessageAction, Priority } from "./types";

export const TOPIC_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 32;
export const MAX_TITLE_LENGTH = 200;

const PRIORITY_NAMES: Record<string, Priority> = {
  min: 1,
  low: 2,
  default: 3,
  high: 4,
  max: 5,
};

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function parsePriority(value: unknown): Priority | null {
  if (value === undefined || value === null || value === "") return 3;
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 && value <= 5
      ? (value as Priority)
      : null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized in PRIORITY_NAMES) return PRIORITY_NAMES[normalized];
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) {
    return numeric as Priority;
  }
  return null;
}

export function parseTags(value: unknown): string[] | null {
  if (value === undefined || value === null || value === "") return [];
  const raw = Array.isArray(value) ? value : String(value).split(",");
  const tags: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") return null;
    const tag = entry.trim();
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) return null;
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > MAX_TAGS) return null;
  return tags;
}

export function parseClick(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  return isHttpUrl(value) ? value : undefined;
}

export const actionSchema = z.object({
  action: z.literal("view"),
  label: z.string().min(1).max(40),
  url: z.string().refine(isHttpUrl),
  clear: z.boolean().optional(),
});

export const jsonPublishSchema = z
  .object({
    title: z.string().max(MAX_TITLE_LENGTH).nullish(),
    body: z.string().optional(),
    message: z.string().optional(),
    priority: z.union([z.string(), z.number()]).nullish(),
    tags: z.union([z.string(), z.array(z.string())]).nullish(),
    click: z.string().nullish(),
    actions: z.array(actionSchema).max(3).nullish(),
    idempotencyKey: z.string().min(1).max(128).optional(),
  })
  .passthrough();

export function parseActions(value: unknown): MessageAction[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = z.array(actionSchema).max(3).safeParse(value);
  return parsed.success ? (parsed.data as MessageAction[]) : undefined;
}

export function normalizeTitle(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_TITLE_LENGTH) return undefined;
  return trimmed;
}
