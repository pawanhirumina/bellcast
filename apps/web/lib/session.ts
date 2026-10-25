import { cookies } from "next/headers";
import { SESSION_COOKIE, verifyKey } from "./auth";

/** Server components and layouts only. */
export async function isAuthenticated() {
  const store = await cookies();
  return verifyKey(store.get(SESSION_COOKIE)?.value);
}
