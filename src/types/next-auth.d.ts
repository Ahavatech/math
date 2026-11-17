import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: Role[];
      isActive: boolean;
    } & DefaultSession["user"];
    /** Signed in with two factors (password and code) or a passkey. */
    strong?: boolean;
    sessionId?: string;
    sessionExpiresAt?: number;
  }

  interface User {
    id: string;
    roles: Role[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    sid?: string;
    strong?: boolean;
    sessionExpiresAt?: number;
    roles?: Role[];
    isActive?: boolean;
    rolesCheckedAt?: number;
  }
}
