import { createServerFn } from "@tanstack/react-start";
import { deployedWithoutDatabase } from "../db-availability";

/** True when the header can offer sign-in (Neon, or local PGLite). */
export const getAccountsAvailable = createServerFn({ method: "GET" }).handler(() => {
  return !deployedWithoutDatabase();
});
