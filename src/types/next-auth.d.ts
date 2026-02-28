import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "CONTRACTOR";
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: "ADMIN" | "CONTRACTOR";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "CONTRACTOR";
  }
}
