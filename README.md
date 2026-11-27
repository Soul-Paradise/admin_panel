# Soul Paradise — Admin Panel

The staff back office for **Soul Paradise Travels**. Admins use it to see every booking and payment,
download customers' tickets / vouchers / policies, manage commissions, coupons and offers, verify travel
agents (B2B partners), answer contact messages, and edit the public website's content, images and policies
without a code change. Built with **React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + React Router 7**.

It is a single-page app that talks only to the
[`soul_paradise_backend`](https://github.com/Soul-Paradise/soul_paradise_backend) API (`/api/v1/admin/*` and
friends). What staff edit here appears on the public
[`soul_paradise_frontend`](https://github.com/Soul-Paradise/soul_paradise_frontend) website.

| Repo | What it is | Local URL |
|---|---|---|
| `soul_paradise_admin_panel` (this) | Staff admin panel | http://localhost:5173 |
| `soul_paradise_backend` | REST API (`/api/v1`) | http://localhost:8080 |
| `soul_paradise_frontend` | Customer & agent website | http://localhost:3000 |

---

## Quick start (from scratch)

### 1. Prerequisites

- **Node.js 24** and **Yarn 4** (`corepack enable`)
- The **backend running locally** (see its README) and an account with admin access (step 5)

### 2. Install

```bash
git clone https://github.com/Soul-Paradise/admin_panel.git soul_paradise_admin_panel
cd soul_paradise_admin_panel
corepack enable
yarn install
```

### 3. Configure

```bash
cp .env.example .env.local
```

```dotenv
VITE_API_URL=http://localhost:8080/api/v1     # required; a production build fails without it
# VITE_SITE_URL=http://localhost:3000         # public website, for "View live" links
# VITE_APP_ENV=development                    # "staging" on the staging deployment (shows a banner)
```

`VITE_*` values are compiled into the browser bundle — **never put a secret in one**. `.env.local` /
`.env.production` are git-ignored; only `.env.example` is tracked.

### 4. Run

```bash
yarn dev            # http://localhost:5173
```

### 5. Get admin access

The panel signs in with **email + password** (an account registered on the website / backend). Access is
granted from the backend:

```bash
# in soul_paradise_backend/
npx tsx scripts/grant-admin-access.ts promote you@example.com    # first SUPER_ADMIN
```

From then on a super admin grants other admins access from **User Access** inside the panel.

---

## Access model

- Roles (backend): `USER`, `AGENT`, `ADMIN`, `SUPER_ADMIN`. Only `ADMIN` and `SUPER_ADMIN` can sign in here.
- `SUPER_ADMIN` sees and can change everything, and is the only one who can grant access.
- An `ADMIN` sees only the pages they were granted, each as **READ** (all editing controls hidden) or
  **WRITE**. No grant = the page doesn't appear in the sidebar at all (deny by default).
- The backend enforces the same rules on every `admin/*` API call; the panel hiding a button is only UX.
- Admin API requests are recorded by the backend's audit interceptor and listed under **Audit Logs**.

---

## Pages

| Page (route) | Access key | What staff do there |
|---|---|---|
| Dashboard (`/`) | DASHBOARD | Sales, bookings and commission at a glance |
| Orders (`/orders`) | ORDERS | Every flight, hotel and insurance booking: status, customer price vs supplier price and commission, the full booking timeline, payments, and one-click **ticket / voucher / policy PDF** download (the same file the customer received) |
| Custom Payments (`/custom-payments`) | CUSTOM_PAYMENTS | Payments made from the website's Custom Payment tab |
| Users (`/users`, `/users/:id`) | USERS | Customers and agents, their bookings and activity |
| Booking Partners (`/partners`; `/agents` redirects here) | BOOKING_PARTNERS | Review travel-agent registrations and KYC documents; approve, reject or request resubmission |
| Commissions (`/commissions`) | COMMISSION | Commission rates per service (flight domestic/international, hotel, insurance) and audience (customer / agent) |
| Coupons (`/coupons`) | COUPONS | Promo codes |
| Offers (`/offers`) | OFFERS | Offer cards shown on the website |
| Reviews (`/reviews`) | REVIEWS | Testimonials shown on the website |
| Customer Messages (`/messages`) | CUSTOMER_MESSAGES | Contact-form messages and which inboxes receive them |
| Site Content (`/site-content`, `/site-content/:page`), Media (`/media`), Destinations (`/destinations`) | SITE_CONTENT | Text, sections and images of every public page; the media library (uploads to the public bucket); featured destinations |
| Policies (`/policies`, `/policies/:slug`) | POLICIES | Terms, privacy, refund and other legal pages, with revisions |
| Utilities (`/utilities`) | UTILITIES | Operational stats at a glance (users, bookings) |
| User Access (`/user-access`) | USER_ACCESS | Grant / revoke page access (super admin) |
| Audit Logs (`/audit-logs`) | AUDIT_LOGS | Who changed what, when |

Supplier prices and commission are visible here (and only here) — the public website never receives them.

---

## Project structure

```
src/
  main.tsx              Entry: router, providers, staging banner
  App.tsx               Routes (each wrapped in ProtectedRoute / SectionRoute for access checks)
  pages/                One file per page (see the table above)
  components/
    Layout.tsx          Sidebar (filtered by access) + header
    OrderDetail.tsx     Booking detail drawer: references, timeline, payments, documents
    TicketButton.tsx    Downloads the customer's e-ticket / voucher / policy PDF
    ContentForm.tsx, ContentView.tsx, ImagePicker.tsx   Site Content editing
    ui.tsx              Shared UI components (mirrors the website's design)
  contexts/, hooks/     Auth (tokens), page access, site images
  lib/
    api.ts              Typed client for every backend call (auth header, token refresh, downloads)
    ui-styles.ts        Shared Tailwind class sets
    site-content.ts, content-form.ts, image-upload.ts, safe-document.ts
vercel.json             SPA rewrite + strict security headers (CSP allows only the backend + GCS)
vite.config.ts          Fails a production build when VITE_API_URL is missing
```

---

## Scripts

| Command | What it does |
|---|---|
| `yarn dev` | Development server on port 5173 (also reachable on your LAN: `--host`) |
| `yarn build` | Type-check (`tsc -b`) + production build into `dist/` |
| `yarn preview` | Serve the production build locally |
| `yarn lint` | ESLint |

---

## Deployment

Hosted on **Vercel**, deployed by GitHub Actions with the Vercel CLI:

- **Production** — `.github/workflows/deploy-admin-panel.yml`, started by hand from `main` (dry-run builds on
  any branch). It refuses to deploy a build that points at the staging API.
- **Staging** — `.github/workflows/deploy-admin-panel-staging.yml`, on every push to `staging`, into a separate
  Vercel project that must have `VITE_APP_ENV=staging`.

When the backend's URL changes, update `VITE_API_URL` in the Vercel project **and** the `connect-src` list in
`vercel.json`, otherwise the browser blocks the calls.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Login says "no access" / empty sidebar | The account isn't `ADMIN`/`SUPER_ADMIN`, or has no page grants — use `grant-admin-access.ts` or User Access. |
| Every call fails with a CORS error | The backend's `CORS_ORIGINS` must include the panel's origin (http://localhost:5173 is allowed by default in development). |
| Production build fails: "VITE_API_URL is not set" | Set it in the build environment. |
| Deployed panel can't reach the API | Backend URL missing from `connect-src` in `vercel.json`. |
