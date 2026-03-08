# Flagbase

Open-source feature flags and A/B testing platform. A self-hosted alternative to LaunchDarkly and Optimizely.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/adrian-popescu-dev/flagbase)

---

## What it does

- **Feature flags** — toggle features on/off per environment, with % rollouts and attribute-based targeting rules
- **A/B experiments** — run split tests, assign users to variants, track impressions and conversions
- **Results dashboard** — see conversion rates, uplift, and statistical significance per variant
- **API key management** — generate scoped keys to connect your apps
- **SDK** — drop-in helpers for server components, client components, and middleware

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via [Neon](https://neon.tech) |
| Cache | Redis via [Upstash](https://upstash.com) |
| Auth | NextAuth.js v5 |
| ORM | Prisma 7 |

---

## Quickstart

### 1. Clone and install

```bash
git clone https://github.com/adrian-popescu-dev/flagbase.git
cd flagbase
npm install
```

### 2. Set up services

You need two free services:

- **Database** — create a project at [neon.tech](https://neon.tech). Copy both the pooled and direct connection strings.
- **Cache** — create a database at [upstash.com](https://upstash.com). Copy the Redis URL.

### 3. Configure env vars

```bash
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL="postgresql://..."   # Neon pooled connection
DIRECT_URL="postgresql://..."     # Neon direct connection
REDIS_URL="rediss://..."          # Upstash Redis

AUTH_SECRET="..."                 # openssl rand -base64 32
AUTH_URL="http://localhost:3000"
```

### 4. Set up the database

```bash
npx prisma db push    # push schema to your database
npx prisma db seed    # populate with example data
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with:

```
Email:    admin@flagbase.dev
Password: password123
```

---

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/adrian-popescu-dev/flagbase)

1. Click the button above
2. Fill in the five environment variables when prompted
3. After deploy, run `npx prisma db push` against your Neon database
4. Optionally run `npx prisma db seed` for example data

---

## SDK usage

Copy the SDK files from the `sdk/` folder into your app.

### Server components and route handlers (`sdk/server.ts`)

```ts
import { getFlag, track } from "@/lib/flagbase";

// Evaluate a flag
const showNewUI = await getFlag("new-dashboard", { userId: session.user.id });

// Track a conversion
await track({
  type: "CONVERSION",
  experimentId: "exp_123",
  variantId: "var_456",
  userId: session.user.id,
});
```

### Client components (`sdk/client.tsx`)

```tsx
"use client";
import { useFlag } from "@/lib/flagbase-client";

export function Banner({ userId }: { userId: string }) {
  const { value: showBanner, loading } = useFlag("promo-banner", { userId }, false);
  if (loading) return null;
  return showBanner ? <Promo /> : null;
}
```

### Middleware (`sdk/middleware.ts`)

```ts
// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { withFlag, getUserIdFromRequest } from "@/lib/flagbase-middleware";

export async function middleware(req: NextRequest) {
  const userId = getUserIdFromRequest(req);
  const enabled = await withFlag("new-checkout", { userId });
  if (!enabled) return NextResponse.redirect(new URL("/checkout-v1", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/checkout/:path*"] };
```

### Required env vars for your app

```env
FLAGBASE_URL=https://your-flagbase.vercel.app
FLAGBASE_API_KEY=fb_xxxxxxxxxxxxxxxx
FLAGBASE_PROJECT_ID=<from dashboard>
FLAGBASE_ENVIRONMENT_ID=<from dashboard>
```

For client components, prefix with `NEXT_PUBLIC_`.

---

## Architecture

```
flagbase/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Login page
│   │   ├── (dashboard)/         # Dashboard layout + pages
│   │   │   └── dashboard/
│   │   │       ├── flags/       # Feature flags CRUD
│   │   │       ├── experiments/ # A/B experiment management
│   │   │       │   └── [id]/results/  # Results page
│   │   │       └── settings/    # API key management
│   │   └── api/
│   │       ├── evaluate/        # POST — flag evaluation
│   │       ├── flags/           # CRUD
│   │       ├── experiments/     # CRUD + results
│   │       ├── events/          # POST — impression/conversion tracking
│   │       └── keys/            # API key management
│   ├── components/              # Shared UI (Field, Modal, NavLinks)
│   └── lib/                     # prisma, auth, redis, apiKey, stats
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── sdk/
    ├── server.ts                # getFlag() + track() for server
    ├── client.tsx               # useFlag() + track() for client
    └── middleware.ts            # withFlag() for middleware
```

## License

MIT
