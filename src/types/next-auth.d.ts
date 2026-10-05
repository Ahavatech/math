import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: Role[];
      isActive: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    roles: Role[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    roles?: Role[];
    isActive?: boolean;
    rolesCheckedAt?: number;
  }
}
