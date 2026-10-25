import "server-only";
import { hasSupabase, isDevMode } from "../auth";
import { FileStore } from "./file";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

export class StoreNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured for this instance.");
    this.name = "StoreNotConfiguredError";
  }
}

const globalForStore = globalThis as unknown as { bellcastStore?: Store };

export function getStore(): Store {
  if (globalForStore.bellcastStore) return globalForStore.bellcastStore;

  if (hasSupabase()) {
    globalForStore.bellcastStore = new SupabaseStore(
      process.env.SUPABASE_URL!.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    );
    return globalForStore.bellcastStore;
  }

  if (isDevMode()) {
    globalForStore.bellcastStore = new FileStore();
    return globalForStore.bellcastStore;
  }

  throw new StoreNotConfiguredError();
}

export type { Store } from "./types";
