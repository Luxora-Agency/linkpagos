import type { NextAuthConfig } from "next-auth";

// Edge-compatible auth config (no Node.js modules)
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Public routes
      const publicRoutes = ["/login", "/pay"];
      const isPublicRoute = publicRoutes.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
      );

      // API routes for webhook (must be public)
      const isWebhookRoute = pathname.startsWith("/api/webhook");

      // Static files and API auth routes
      const isStaticOrAuth =
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api/auth") ||
        pathname.includes(".");

      if (isStaticOrAuth || isWebhookRoute || isPublicRoute) {
        return true;
      }

      // If trying to access login while logged in, redirect to dashboard
      if (isLoggedIn && pathname === "/login") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      // If not logged in and trying to access protected route
      if (!isLoggedIn && !isPublicRoute) {
        return false; // Redirect to signIn page
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email!;
        token.name = user.name!;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as "SUPERADMIN" | "ADMIN" | "GESTOR";
      }
      return session;
    },
  },
  providers: [], // Providers are added in the full auth.ts
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
} satisfies NextAuthConfig;
