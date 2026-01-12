# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LinkPagos is a payment link management platform built with Next.js 16. It allows users to create, manage, and track payment links through two Colombian payment providers: Bold and Wompi.

## Commands

```bash
# Development
pnpm dev              # Start dev server on localhost:3000

# Build & Production
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint

# Database
pnpm db:push          # Push Prisma schema to database
pnpm db:generate      # Generate Prisma client
pnpm db:seed          # Seed database with initial data
pnpm db:studio        # Open Prisma Studio GUI
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth v5 (beta) with credentials provider
- **UI**: Radix UI primitives + Tailwind CSS 4 + shadcn/ui components
- **State**: TanStack Query for server state
- **Validation**: Zod

### Route Structure (App Router)

- `src/app/(auth)/` - Auth pages (login). Has its own layout.
- `src/app/(dashboard)/` - Protected dashboard pages (dashboard, links, users, settings). Uses sidebar layout.
- `src/app/pay/[linkId]/` - Public payment page for customers.
- `src/app/api/` - API routes.

### Key Files

- `src/lib/auth.ts` - NextAuth configuration with credentials provider
- `src/lib/auth.config.ts` - Auth config shared between middleware and auth
- `src/lib/prisma.ts` - Prisma client singleton
- `src/lib/bold.ts` - Bold payment API integration
- `src/lib/wompi.ts` - Wompi payment API integration
- `src/middleware.ts` - NextAuth middleware for route protection
- `src/components/providers.tsx` - Root providers (SessionProvider, QueryClientProvider)
- `src/types/index.ts` - Shared TypeScript types including Bold API types

### Database Models (Prisma)

- **User**: Admin/Gestor accounts with role-based access (SUPERADMIN, ADMIN, GESTOR)
- **PaymentLink**: Payment links with status tracking (ACTIVE, PROCESSING, PAID, EXPIRED)
- **WebhookLog**: Payment webhook event storage for idempotency

### Payment Provider Integration

Two providers are supported via `PaymentProvider` enum:
- **Bold**: Uses `src/lib/bold.ts` - API key auth, timestamps in nanoseconds
- **Wompi**: Uses `src/lib/wompi.ts` - Bearer token auth, has HMAC webhook verification

Webhooks are received at:
- `/api/webhook/bold` - Bold payment notifications
- `/api/webhook/wompi` - Wompi payment notifications

### Path Alias

The `@/*` alias maps to `./src/*` (configured in tsconfig.json).

### Environment Variables

Required variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Auth session encryption key
- `BOLD_API_KEY`, `BOLD_SECRET_KEY` - Bold API credentials
- `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` - Wompi credentials
- `CLOUDINARY_*` - Image upload credentials
