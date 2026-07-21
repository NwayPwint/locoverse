# LocoVerse — Production Notes

## Current Architecture (MVP)

```
client/ ─── Next.js (App Router) ─── Vercel / any Node host
server/ ─── Express.js + Socket.io ─── Node host (Railway, Fly.io, Render)
               │
               ├── PostgreSQL ─── Neon (serverless Postgres)
               │
               └── File attachments ─── Cloudinary (avatars, messages, recordings)
```

### Auth Flow
- JWT tokens stored in httpOnly cookie `locoverse_token` (7-day expiry)
- Google OAuth: `@react-oauth/google` (client) → `google-auth-library` (server)
- Email/password with bcrypt hashing
- `authMiddleware` reads cookie or Bearer header

### Hosting (Current Dev)
| Service | What |
|---------|------|
| Neon (free) | PostgreSQL database |
| Google Cloud | OAuth client IDs (free) |
| Resend (free) | Password reset emails (only console.log in dev) |
| Localhost | Both client (:3000) and server (:5000) |

---

## Things to Change for Production

### 1. Secrets & Environment

| Variable | Current | Production |
|----------|---------|------------|
| `JWT_SECRET` | `locoverse_jwt_secret_dev_...` | Generate a strong random secret (64+ chars) |
| `GOOGLE_CLIENT_ID/SECRET` | Dev OAuth app | Create a **production** Google Cloud OAuth consent screen app |
| `RESEND_API_KEY` | Empty (dev fallback) | Add real Resend API key + verified domain |
| `DATABASE_URL` | Neon free tier | Upgrade to Neon paid pooler or migrate to self-hosted/RDS |

Store all via deployment platform's env vars, never in `.env` committed to repo.

### 2. Database

| Issue | Fix |
|-------|-----|
| Neon free tier sleeps after inactivity | Upgrade to paid Neon or switch to AWS RDS / DigitalOcean Managed DB |
| No connection pooling limits | Add `pgBouncer` or use Neon's built-in pooled connection string |
| No migrations versioning | Current system runs all `.sql` files in order. Replace with dedicated migration tool (e.g. `node-pg-migrate` or `drizzle-kit`) with up/down tracking |
| `pg` logs all queries in console | Remove `console.log('Executed query', ...)` in production |
| No read replicas | Add read replica for `/users` discovery queries if needed |

### 3. Authentication

| Issue | Fix |
|-------|-----|
| ~~JWT in `localStorage`~~ | **Done** — switched to httpOnly, Secure, SameSite=Strict cookies (`locoverse_token`) |
| No token refresh/rotation | Implement refresh token flow: short-lived access tokens (15min) + long-lived refresh tokens (30d) stored in DB |
| ~~No rate limiting on login~~ | **Done** — `express-rate-limit` (5 attempts per email per 15min) |
| No brute-force protection | Add account lockout after 10 failed attempts |
| Google OAuth in dev mode | Publish OAuth consent screen to "Production" status and add production domain to authorized redirect URIs |
| Password reset token in DB with no cleanup | Add a cron job or cleanup query to delete expired tokens |

### 4. Server Hardening

| Issue | Fix |
|-------|-----|
| `cors({ origin: env.CLIENT_URL })` | Set to exact production client URL |
| ~~No request validation~~ | **Done** — `express-validator` on auth routes + profile update |
| No SQL injection protection | Already good (parameterized queries with `pg`) |
| ~~No helmet~~ | **Done** — `helmet` middleware added |
| No HTTPS in dev | Production must terminate TLS via reverse proxy or platform (Railway/Vercel handle this) |
| `console.error` exposes stack traces | Use a logging service (Sentry, Datadog, or structured JSON logging) |
| ~~No request body size limit~~ | **Done** — `express.json({ limit: '10mb' })` |

### 5. File Attachments

**Current:** Cloudinary (avatars, message attachments, composition recordings).

| Option | When to use |
|--------|------------|
| **Cloudinary free tier** (current) | MVP — quick setup, 25GB storage, auto-optimization |
| **AWS S3 + CloudFront** | Production scale — cheaper at volume, full control |
| **Direct upload to S3** | Best practice — presigned URLs so files go directly from client to S3, bypassing your server |

If migrating away from Cloudinary:
- Update `config/cloudinary.ts` → S3 client config
- Update upload endpoints (messages, avatars, recordings)
- Update delete logic (Cloudinary cleanup → S3 deleteObject)
- Update `next.config.js` remote patterns for S3 URLs

### 6. Real-Time Chat (Socket.io)

| Issue | Fix |
|-------|-----|
| No message persistence after socket delivery | Already solved — REST POST persists, socket is just real-time delivery |
| No offline message queue | Already solved — messages exist in DB, fetched on conversation open |
| No typing indicator debounce on server | Client-side debounce is in place (2s throttle). Server could add per-user rate limiting |
| Socket.io in dev uses long-polling fallback | In production, ensure WebSocket transport works (check proxy/load balancer config) |

### 7. Frontend

| Issue | Fix |
|-------|-----|
| No error boundaries | Wrap each page in a `React.ErrorBoundary` |
| No loading skeletons for chat | Partial (equalizer for load, no skeleton) |
| No image optimization for avatar uploads | Cloudinary auto-optimizes; with S3, add image resizing via sharp or Imgix |
| Next.js static generation | Chat, Discover, Profile are all `'use client'` — fine, but `/` landing is also client. Could make it static with ISR or SSG |
| No PWA/offline support | Out of scope for MVP |
| No accessibility audit | Add `aria-*` attributes, keyboard navigation, focus management for chat |

### 8. Monitoring & Observability

| Tool | What it tracks |
|------|---------------|
| **Sentry** | Error tracking (free tier: 5k events/mo) |
| **Logtail / Better Stack** | Structured log aggregation |
| **Uptime Robot** | Free HTTP health check on `/api/health` |
| **Neon monitoring** | Built-in DB dashboards |

### 9. CI/CD

| Step | Tool |
|------|------|
| Lint + typecheck | GitHub Actions (already have `lint` scripts) |
| Build | `npm run build` on both client and server |
| Migrate + seed | Run on deploy via `npm run migrate` |
| Deploy | Auto-deploy via Vercel (client) + Railway/Render (server) |
| Preview envs | Vercel Preview Deployments per PR |

### 10. Scaling Concerns

| Concern | Current State | Growth Plan |
|---------|--------------|-------------|
| DB queries per user discovery | Full table scan with JSON aggregation | Add `pg_trgm` for ILIKE index, paginate properly (already has LIMIT/OFFSET) |
| Messages table growth | No index on `(sender_id, receiver_id, created_at)` | Add composite index for conversation queries |
| Socket.io sticky sessions | N/A (single instance) | Add Redis adapter for Socket.io when scaling to multiple server instances |
| File uploads | Cloudinary (works well) | Migrate to S3 if cost becomes an issue |
| CDN for static assets | Vercel handles by default | No action needed |

### 11. Dependency Cleanup

| Package | Status |
|---------|--------|
| `nodemailer` + `@types/nodemailer` | **Removed** — was replaced by Resend |
| `zustand` | **Removed** — was installed but never used |

---

## Quick Migration Checklist

```bash
[ ] Generate new JWT_SECRET (openssl rand -hex 64)
[ ] Create production Google OAuth app + consent screen
[ ] Set up Neon paid plan or AWS RDS
[ ] Add RESEND_API_KEY for password emails
[ ] Configure environment variables on deployment platform
[✓] Switch JWT from localStorage to httpOnly cookies
[✓] Add rate limiting middleware
[✓] Add helmet middleware
[✓] Remove unused deps (nodemailer, zustand removed)
[✓] Implement file attachments with Cloudinary
[ ] Add Sentry error monitoring
[ ] Set up GitHub Actions CI pipeline
[ ] Deploy server (Railway/Fly.io/Render) + client (Vercel)
[ ] Set up custom domain + SSL
[ ] Test Google OAuth with production credentials
```
