# LocoVerse — Code Explanation

How each feature works, file by file, end to end.

---

## Table of Contents

1. [Auth Flow](#1-auth-flow)
2. [User Profile & Discovery](#2-user-profile--discovery)
3. [Connections System](#3-connections-system)
4. [Real-Time Chat](#4-real-time-chat)
5. [Landing Page](#5-landing-page)
6. [Navbar](#6-navbar)
7. [Shared UI Components](#7-shared-ui-components)
8. [Socket.io Setup](#8-socketio-setup)
9. [Project Structure](#9-project-structure)
10. [Feed Interactions](#10-feed-interactions-like--comments--contact)
11. [Community Posts](#11-community-posts-announcements)
12. [Notifications](#12-notifications)
13. [Guide Page](#13-guide-page)
14. [Footer](#14-footer)
15. [Responsive Refinements](#15-responsive-refinements)

---

## 1. Auth Flow

### Files involved

| Layer | File |
|-------|------|
| Client page | `client/src/app/login/page.tsx`, `register/page.tsx` |
| Client context | `client/src/contexts/AuthContext.tsx` |
| Client API lib | `client/src/lib/api.ts` |
| Server route | `server/src/routes/auth.ts` |
| Server middleware | `server/src/middleware/auth.ts` |
| Server config | `server/src/config/env.ts` |
| DB table | `users` (migrations/001_initial.sql) |

### Registration flow

```
User fills form → LoginPage / RegisterPage
  → AuthContext.register(email, password, displayName)
    → api.post('/auth/register')           [lib/api.ts adds Bearer token header]
      → auth.ts POST /register             [server]
        → validate email not taken
        → bcrypt.hash(password, 10)
        → INSERT INTO users
        → jwt.sign({ userId }, JWT_SECRET)  [7-day expiry]
        → return { token, user }
    ← localStorage.setItem('token', token)
    ← setUser(user)                        [updates AuthContext state]
    ← router.push('/discover')
```

**Key points:**
- Password is never stored in plain text — bcrypt with 10 salt rounds
- JWT contains only `{ userId }` — user data fetched on demand via `GET /auth/me`
- Token stored in `localStorage` — read by api.ts interceptor on every request
- If server returns 401, interceptor clears token and redirects to `/login`

### Login flow

Same as register except `bcrypt.compare(password, hash)` instead of creating account.

### Google OAuth flow

```
User clicks "Sign in with Google" button
  → @react-oauth/google <GoogleLogin />
    → Google popup → user consents
    → returns Google credential (idToken)
  → AuthContext.googleLogin(credential)
    → api.post('/auth/google', { credential })
      → auth.ts POST /google
        → googleClient.verifyIdToken(idToken)    [verifies on Google's servers]
        → extract email, name, picture, sub
        → find user by oauth_provider='google' + oauth_id
        → if exists: update display_name, avatar_url
        → if not: check email exists → link account, or create new user
        → jwt.sign({ userId })
        → return { token, user }
```

**Key points:**
- No password_hash for OAuth users (column stays null)
- If email already registered with password, Google login links the account
- Google Client ID is shared: same ID on client (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`) and server (`GOOGLE_CLIENT_ID`)

### Forgot / Reset Password flow

```
Forgot:
  → POST /auth/forgot-password { email }
    → find user by email
    → crypto.randomBytes(32) → token
    → INSERT INTO password_reset_tokens (user_id, token, expires_at)
    → if RESEND_API_KEY set: send email via Resend
    → else: console.log(resetUrl)          [dev mode]

Reset:
  → /reset-password?token=xxx page
    → POST /auth/reset-password { token, password }
    → find token where used=false AND expires_at > NOW()
    → bcrypt.hash(new password)
    → UPDATE users SET password_hash
    → UPDATE password_reset_tokens SET used=true
```

**Key points:**
- Token expires in 1 hour
- In production, set `RESEND_API_KEY` env var — Resend sends the email
- In dev, the reset link is printed in server console

### GET /auth/me (auto-fetch on page load)

```
AuthProvider mount
  → localStorage has 'token'?
    → api.get('/auth/me')
      → auth.ts GET /me
        → authMiddleware: jwt.verify(token) → extract userId
        → SELECT user + LEFT JOIN skills + vibes (json_agg)
        → return full user object
      ← setUser(data)
    ← if 401: clear token (invalid/expired)
  ← isLoading = false
```

---

## 2. User Profile & Discovery

### Files involved

| Layer | File |
|-------|------|
| Client (profile) | `client/src/app/profile/page.tsx` |
| Client (discover) | `client/src/app/discover/page.tsx` |
| Server route | `server/src/routes/users.ts` |
| DB tables | `users`, `user_skills`, `skills`, `user_vibes`, `vibes` |

### Profile page

Three independent sections, each saves separately:

```
Display Name + Bio + Looking For:
  → PUT /users/me { displayName, bio, lookingFor }
    → UPDATE users SET ... WHERE id = $4
    → return updated user row
  ← setUser(updated)

Skills picker:
  → PUT /users/me/skills { skillIds: [1, 5, 12] }
    → DELETE FROM user_skills WHERE user_id = $1
    → INSERT INTO user_skills (user_id, skill_id) VALUES ... (batch)
  ← setUser with filtered skills array

Vibes picker:
  → PUT /users/me/vibes { vibeIds: [3, 7] }
    → same pattern as skills
```

**Key points:**
- Skills and vibes use delete-all-then-insert pattern (simpler than diffing)
- Full list of skills/vibes fetched from `GET /api/skills` and `GET /api/vibes` on mount
- Tags are rendered as buttons — selected ones get `tag-accent` class

### Discover page

```
On mount + filter change:
  → GET /users?skills[]=Guitar&vibes[]=Chill&looking_for=jam_partner&search=alex
    → users.ts GET /
      → SELECT ... LEFT JOIN skills/vibes
      → WHERE u.id != currentUser (hide self)
      → optional: EXISTS subquery for skills filter
      → optional: EXISTS subquery for vibes filter
      → optional: looking_for filter
      → optional: display_name/bio ILIKE search
      → GROUP BY + ORDER BY created_at DESC
      → LIMIT 20 OFFSET 0
    ← render user cards with avatar, bio, skills tags, vibes tags
```

**Key points:**
- Filters use subqueries with `EXISTS` (efficient for many-to-many)
- Search uses `ILIKE` (case-insensitive LIKE)
- "Connect" button calls `POST /connections` (see next section)
- Sent requests tracked in local `Set` state so button shows "Sent"

---

## 3. Connections System

### Files involved

| Layer | File |
|-------|------|
| Client (discover) | `client/src/app/discover/page.tsx` |
| Client (navbar) | `client/src/components/layout/Navbar.tsx` |
| Server route | `server/src/routes/connections.ts` |
| DB table | `connections` |

### Endpoints

```
POST /connections          { receiverId }  → create pending request
GET  /connections                          → list accepted connections (with other_user)
GET  /connections/requests                 → list incoming pending requests
PUT  /connections/:id/accept               → accept (receiver only)
PUT  /connections/:id/reject               → reject (receiver only)
DELETE /connections/:id                    → remove (either party)
```

### Connection request flow

```
Discover page → user clicks "Connect"
  → handleSendRequest(userId)
    → POST /connections { receiverId: userId }
      → check not self
      → check no existing connection (both directions)
      → INSERT INTO connections (requester_id, receiver_id) status='pending'
    ← add userId to sentRequests set → button shows "Sent"

Receiver sees request:
  Navbar mounts:
    → GET /connections/requests
      → SELECT connections WHERE receiver_id = $1 AND status = 'pending'
      → JOIN users to get requester display_name, avatar_url
    ← setRequests(data)
    ← badge count shows on UserPlus icon

  Navbar dropdown:
    → Accept: PUT /connections/:id/accept → status='accepted'
    → Reject: PUT /connections/:id/reject → status='rejected'
    ← remove from local requests array
```

**Key points:**
- `other_user` is computed via CASE statement — always the user who is NOT the current requester
- Connections are unique in both directions via `UNIQUE(requester_id, receiver_id)`
- Only the receiver can accept/reject a request

---

## 4. Real-Time Chat

### Files involved

| Layer | File |
|-------|------|
| Client page | `client/src/app/chat/page.tsx` |
| Client types | `client/src/app/chat/types.ts` |
| Client socket lib | `client/src/lib/socket.ts` |
| Server route | `server/src/routes/messages.ts` |
| Server socket | `server/src/config/socket.ts` |
| DB table | `messages` |

### Conversations list

```
ChatPage mount:
  → GET /messages/conversations/list
    → SELECT DISTINCT ON (other_user_id) ...
      → subquery: get all messages where user is sender or receiver
      → compute other_user_id via CASE
      → compute unread_count (CASE WHEN receiver_id = $1 AND read=false THEN 1 ELSE 0)
    → for each row: fetch other user's display_name, avatar_url
    ← { conversations: [{ user, lastMessage, lastMessageAt, unreadCount }] }
  ← render sidebar

Also fetch connections:
  → GET /connections → filter out already-conversation users
  ← "New Conversation" dropdown populated with available contacts
```

### Selecting a conversation

```
User clicks conversation:
  → setActiveUserId(otherUserId)
  → useEffect fires:
    → GET /messages/:userId
      → SELECT * WHERE (sender=$1 AND receiver=$2) OR (sender=$2 AND receiver=$1)
      → ORDER BY created_at DESC, LIMIT 50 OFFSET 0, then reverse()
    ← setMessages(data)

    → PUT /messages/read { senderId: otherUserId }
      → UPDATE messages SET read=true WHERE sender=$1 AND receiver=$2 AND read=false

    → setConversations(prev => mark unreadCount=0 for this conversation)
```

### Sending a message

```
User types + hits Enter / clicks Send:
  → POST /messages { receiverId, content }
    → check existing accepted connection (both directions)
    → INSERT INTO messages (sender_id, receiver_id, content)
    ← return { message }

  → if success:
    → append message to local messages array
    → emit 'send_message' via socket
      → server relays 'receive_message' to receiver's socket ID
    → move conversation to top of sidebar, update lastMessage
```

### Receiving a message in real-time

```
Socket listener (always active):
  → 'receive_message' event { senderId, content, timestamp }
    → if senderId === activeUserId:
      → append to messages array (temp id)
    → update conversations list:
      → move sender's conversation to top
      → update lastMessage, lastMessageAt
      → increment unreadCount (unless currently viewing this conversation)
```

### Typing indicator

```
User types in input:
  → handleInputChange fires
    → if 2s since last emit: socket.emit('typing', { senderId, receiverId })
    → reset 2s debounce timer
  → after 2s idle: socket.emit('typing_stop', { senderId, receiverId })

Server:
  → 'typing' → emits 'user_typing' to receiver
  → 'typing_stop' → emits 'user_typing_stop' to receiver

Receiver:
  → 'user_typing' → setTypingUserId(senderId) → show "...typing" indicator
  → 'user_typing_stop' → setTypingUserId(null) → hide indicator
```

### Online / Offline status

```
Socket connect:
  → server adds userId → socket.id to onlineUsers Map
  → server emits 'user_online' to ALL connected clients

Socket disconnect:
  → server removes from Map
  → server emits 'user_offline' to ALL

Client:
  → 'user_online' → add userId to onlineUsers Set
  → 'user_offline' → remove userId from Set
  → conversation list: green dot on avatars where isOnline(userId)
  → chat header: "Online" / "Offline" text
```

### New conversation flow

```
User clicks "+" button in sidebar header:
  → dropdown shows available contacts (connections not already in conversations list)

User clicks a contact:
  → setActiveUserId(contact.id)
  → setMessages([])  — empty chat window
  → chat window shows: header with name, empty messages area, input

User sends first message:
  → POST /messages (same as above)
  → message persists, conversation appears in sidebar
```

### Navbar unread badge

```
Navbar mount (if user logged in):
  → GET /messages/conversations/list
  ← sum all unreadCount values → setUnreadCount(total)

Socket listener:
  → 'receive_message' → increment unreadCount

When entering /chat page:
  → pathname === '/chat' → setUnreadCount(0)
```

---

## 5. Landing Page

### File

`client/src/app/page.tsx`

### Sections

```
Hero:
  → Full-viewport with hero.png background
  → Dark overlay (linear gradient black → transparent)
  → blur-[2px] on bg image
  → "For Music Hobbyists" pill badge
  → CTA button: "Get Started — It's Free" → /register
  → Secondary button: "See How It Works" → /guide
  → Social proof: avatar stack + "Joined by 2,400+ creators"

Marquee:
  → Scrolling row of skills (Guitar, Piano, Vocals, Drums, etc.)
  → Duplicated array for seamless loop
  → animate-marquee CSS animation

Features (3 cards):
  "Build Your Profile"  — skill/vibe matching
  "Discover People"     — browse by filters
  "Connect & Create"    — messaging + collaboration
  Each: icon + number (01/02/03) + title + description

Stats:
  Background photo (unsplash concert crowd)
  Overlaid stats: 2.4K+ Creators, 850+ Collaborations, 12K+ Messages, 98% Positive Vibes

Testimonials:
  3 cards with avatar photos (unsplash) + quote + name/role

CTA:
  "Ready to Find Your Sound?" → button "Join LocoVerse — Free" → /register
```

---

## 6. Navbar

### File

`client/src/components/layout/Navbar.tsx`

### Auth-aware rendering

```
Not loading:
  user is null   → show Login + Sign Up
  user exists    → show Discover, Vibes, Profile, Requests(badge), Bell(badge), Sign Out
  isLoading      → render nothing (LoadingOverlay covers page)

Desktop nav: border-bottom active state (text-accent-action + border-accent-action)
Mobile nav: border-left active state + menu closes on link click
```

### Connection requests dropdown

```
Desktop: UserPlus icon with badge count
  → onClick → show dropdown with requests
  → each request: avatar + name + accept(check) + reject(x) buttons
  → click-outside closes dropdown (useRef + mousedown listener)

Mobile: rendered inline in mobile menu (if requests.length > 0)
```

### Floating chat button

```
Fixed bottom-right (bottom-6 right-6, z-50)
MessageCircle icon with unread badge
Links to /chat
```

---

## 7. Shared UI Components

### Button (`client/src/components/ui/Button.tsx`)

```
Props: variant ('primary' | 'secondary'), size ('sm' | 'md' | 'lg')
primary:   bg-accent-action text-white   (solid seafoam fill)
secondary: bg-transparent border-border  (outlined)
All: uppercase tracking-[0.2em], min-h-[44px]
```

### LoadingOverlay (`client/src/components/ui/LoadingOverlay.tsx`)

```
Props: show (optional boolean)
  → if show is provided: use it
  → if show is not provided: use AuthContext.isLoading

Fixed full-screen overlay with equalizer bars (6 pulsing bars) + "Loading..." text
z-[100] to cover everything
```

### Tag classes (globals.css)

```
.tag:        border border-border bg-white, monospace font
.tag-accent: same + bg-accent-action/10 text-accent-action border-accent-action/20
```

---

## 8. Socket.io Setup

### Server (`server/src/config/socket.ts`)

```
initSocket(httpServer):
  → new Server(httpServer, { cors })

  On connection:
    → extract userId from handshake auth
    → store userId → socket.id in Map
    → broadcast 'user_online' { userId }

  Event handlers:
    'send_message'    → relay to receiver via 'receive_message'
    'typing'          → relay to receiver via 'user_typing'
    'typing_stop'     → relay to receiver via 'user_typing_stop'

  On disconnect:
    → remove from Map
    → broadcast 'user_offline'
```

### Client (`client/src/lib/socket.ts`)

```
connectSocket(userId):
  → io(SOCKET_URL, { auth: { userId } })
  → return socket instance (singleton)

disconnectSocket():
  → socket.disconnect()
  → socket = null

getSocket():
  → return current socket instance (for use in components)
```

### Wiring to AuthContext

```
User set (login/register/auto-fetch):
  → useEffect: connectSocket(user.id)

User cleared (logout):
  → logout() calls disconnectSocket()

On unmount (cleanup):
  → disconnectSocket()
```

---

## 9. Project Structure

```
LocoVerse/
├── client/                        # Next.js 15 (App Router)
│   ├── public/
│   │   ├── logo.svg               # Theme-colored logo (play button)
│   │   └── images/hero.png        # Landing page bg
│   └── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (fonts, Providers, Navbar, Footer)
│   │   ├── page.tsx            # Landing page
│   │   ├── guide/page.tsx      # How It Works walkthrough
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── discover/page.tsx
│   │   ├── profile/
│   │   │   ├── page.tsx        # Own profile (edit + tabs)
│   │   │   └── [id]/page.tsx   # Other user's profile
│   │   ├── vibes/page.tsx      # Merged feed (songs + posts)
│   │   ├── chat/
│   │   │   ├── page.tsx        # Chat page
│   │   │   └── types.ts        # Chat-specific types
│   │   ├── creator-hub/page.tsx # Song editor + post creation
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│       ├── components/
│       │   ├── ui/
│       │   │   ├── Button.tsx
│       │   │   └── LoadingOverlay.tsx
│       │   ├── layout/
│       │   │   ├── Navbar.tsx
│       │   │   ├── Footer.tsx
│       │   │   ├── FloatingChatButton.tsx
│       │   │   ├── NotificationBell.tsx
│       │   │   └── NotificationToast.tsx
│       │   ├── feed/
│       │   │   ├── PostCard.tsx     # Song post card
│       │   │   └── PostItem.tsx     # Community post card
│       │   └── Providers.tsx
│       ├── contexts/
│       │   └── AuthContext.tsx
│       ├── lib/
│       │   ├── api.ts             # Axios instance with interceptors
│       │   ├── socket.ts          # Socket.io client singleton
│       │   └── utils.ts           # timeAgo utility
│       ├── styles/globals.css
│       └── types/index.ts
│
├── server/                        # Express.js
│   ├── migrations/
│   │   ├── 001_initial.sql
│   │   ├── 002_password_reset.sql
│   │   ├── 003_message_features.sql
│   │   ├── 004_attachments.sql
│   │   ├── 005_cloudinary_cleanup.sql
│   │   ├── 006_per_user_delete.sql
│   │   ├── 007_compositions.sql
│   │   ├── 008_shared_songs.sql
│   │   ├── 009_share_scope.sql
│   │   ├── 010_song_likes_comments.sql
│   │   ├── 011_posts.sql
│   │   └── 012_notifications.sql
│   ├── seeds/
│   │   └── skills_vibes.sql       # 24 skills + 20 vibes
│   └── src/
│       ├── index.ts               # Express entry + skills/vibes endpoints
│       ├── config/
│       │   ├── env.ts
│       │   ├── database.ts
│       │   ├── socket.ts
│       │   ├── cloudinary.ts
│       │   ├── migrate.ts
│       │   └── seed.ts
│       ├── middleware/
│       │   └── auth.ts
│       └── routes/
│           ├── auth.ts
│           ├── users.ts
│           ├── connections.ts
│           ├── messages.ts
│           ├── compositions.ts
│           ├── sharedSongs.ts
│           ├── posts.ts
│           └── notifications.ts
│
├── FEATURES.md                    # Finished features list
├── AGENTS.md
├── CODE_EXPLANATION.md            ← You are here
├── PROJECT_DETAILS.md
└── PRODUCTION_NOTES.md
```

---

*Add notes below as features are implemented.*

### Notes

#### My Locos Tab & Unfriend — 2026-07-16

**Files:**
- `client/src/app/profile/page.tsx` — own profile
- `client/src/app/profile/[id]/page.tsx` — other user's profile
- `server/src/routes/connections.ts` — DELETE endpoint (already existed)

**Own profile (`/profile`):**
- Added `'locos'` to `profileTab` type union (Songs | Posts | Articles | **Locos**)
- New `locos` state stores the full `GET /connections` response (connection `id` + `other_user` object)
- Locos tab renders a responsive card grid — each card shows avatar, display name, **Message** link to `/chat?userId=`, and **Remove** button
- Remove calls `DELETE /connections/:id`, optimistically removes from both `locos` and `connectedIds` state

**Other user's profile (`/profile/[id]`):**
- Added `connectionsData` state to store full connection objects
- Added `removingLoco` loading state
- When connected: action area shows **Message** link + **Remove** button (instead of just Message)
- Remove calls `DELETE /connections/:id`, updates both `connectedIds` and `connectionsData`

#### Music Workspace (Phase 1) — 2026-07-13

**Migration:** `server/migrations/007_compositions.sql`

Creates `compositions` table: `id UUID PK`, `user_id UUID FK`, `title`, `lyrics TEXT`, `structure JSONB`, `created_at`, `updated_at`.

**New server endpoints** (`server/src/routes/compositions.ts`):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/compositions` | List user's compositions (ordered by updated_at DESC) |
| `POST` | `/api/compositions` | Create new composition `{ title, lyrics, structure }` |
| `GET` | `/api/compositions/:id` | Get single composition (owner only) |
| `PUT` | `/api/compositions/:id` | Update title/lyrics/structure |
| `DELETE` | `/api/compositions/:id` | Delete composition (owner only) |
| `POST` | `/api/compositions/generate-lyrics` | AI generate lyrics via OpenAI `{ prompt, style, structure }` |

**AI generation flow:**
```
POST /api/compositions/generate-lyrics { prompt, style, structure }
  → Gemini 2.0 Flash with JSON responseMimeType
  → systemInstruction for songwriting
  → returns { lyrics: string, structure: [{ section, content }] }
```

**Server deps added:** `@google/generative-ai` (was `groq-sdk`)

**Client:** `client/src/app/creator-hub/page.tsx`

- **Sidebar** — list of user's compositions with date, active state highlight, delete button on hover
- **Editor** — title input, section-based structure blocks, each with colored left border (verse=seafoam, chorus=warm, bridge=purple, intro=blue, outro=gray), textarea per section, add/remove section, save button with dirty state tracking
- **AI generate button** — opens GenerateModal with prompt input, style dropdown, structure builder (add/remove/reorder sections), calls POST /api/compositions/generate-lyrics, replaces current structure with generated result

**Components:**
- `client/src/components/workspace/StructureBlock.tsx` — single section block with colored indicator, textarea, delete button
- `client/src/components/workspace/GenerateModal.tsx` — modal with prompt, style selector, structure builder

**Navbar:** Added "Workspace" link (desktop + mobile) between Profile and connection requests dropdown.

### Notes

#### Message Features (Reply, Edit, Delete, Copy, Forward) — 2026-07-13

**Migration:** `server/migrations/003_message_features.sql`

Adds columns to `messages`: `reply_to_id`, `edited_at`, `deleted_at`, `forwarded_from_id`.

**New server endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| `PUT` | `/messages/:id/edit` | Edit content (sender only, `deleted_at` must be null) |
| `DELETE` | `/messages/:id` | Soft-delete (sender OR receiver) |
| `POST` | `/messages/forward` | Forward message `{ messageId, receiverId }` |

`GET /messages/:userId` now LEFT JOINs `reply_to_id` and `forwarded_from_id` to return preview text (`reply_to_preview`, `forwarded_from_preview`, and sender IDs).

`POST /messages` accepts optional `replyToId` field.

**Socket changes:**

- Socket.io now uses **rooms** (`socket.join(userId)`) instead of raw socket IDs for targeted emits.
- New events: `message_edited` `{ messageId, content, editedAt }` and `message_deleted` `{ messageId }` — emitted to both conversation participants via `io.to(senderId).to(receiverId)`.

**Client:**

`client/src/app/chat/page.tsx` — full rewrite adding:

- **Context menu:** Right-click on message bubble → Copy, Reply, Edit (own), Forward, Delete (both). Positioned at cursor with `fixed` positioning.
- **Reply:** Preview banner above input showing replied-to content. Cancel (X) button. `reply_to_id` sent with message POST.
- **Edit:** Message bubble turns into textarea + Save/Cancel buttons. `PUT /messages/:id/edit` persists. Real-time update via `message_edited` socket event shows "(edited)" label.
- **Delete:** Sets `deleted_at` locally via `message_deleted` socket event. Renders "This message was deleted" (italic, muted). Timestamp preserved.
- **Forward:** Modal overlay lists connected users. Select target → `POST /messages/forward` creates new message with quoted preview. Receiver sees "Forwarded" label.
- **Copy:** `navigator.clipboard.writeText()` — no server involvement.

`client/src/app/chat/types.ts` — added `reply_to_id`, `reply_to_preview`, `reply_to_sender_id`, `edited_at`, `deleted_at`, `forwarded_from_id`, `forwarded_from_preview`, `forwarded_from_sender_id` to `ChatMessage`.

#### File Attachments — 2026-07-13

**Migration:** `server/migrations/004_attachments.sql`

Adds columns to `messages`: `attachment_url TEXT`, `attachment_type VARCHAR(50)`, `attachment_name VARCHAR(255)`.

**Server deps added:** `multer` (multipart parsing), `cloudinary` (upload SDK), `streamifier` (buffer → stream).

**New config:** `server/src/config/cloudinary.ts` — configures Cloudinary SDK with env vars.

**New endpoint:**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/messages/upload` | Accepts `multipart/form-data` with `file` field. Validates type (`image/*`, `audio/*`, `application/pdf`). Max 10MB. Uploads to Cloudinary `locoverse` folder. Returns `{ url, type, name }`. |

`POST /messages` now accepts optional `attachmentUrl`, `attachmentType`, `attachmentName` fields.

**Client:**

- Paperclip button next to text input → opens file picker (`accept="image/*,audio/*,application/pdf"`)
- Uploads via `FormData` → auto-sends message with empty content + attachment URL
- **Image** attachments: rendered as `<Image>` thumbnail inside the bubble (max-height 300px)
- **Audio** attachments: rendered as `<audio>` HTML player
- **Other** files (PDF): rendered as file name link with download icon

`next.config.js` — added `res.cloudinary.com` to `remotePatterns` for Next.js Image optimization.

#### Per-User Delete & Conversation Preview — 2026-07-13

**Migrations:** `005_attachment_public_id.sql`, `006_per_user_delete.sql`

Adds `attachment_public_id` column for Cloudinary cleanup on delete. Adds `deleted_for_sender` and `deleted_for_receiver` columns.

**Server DELETE `/messages/:id` now accepts `{ scope: 'me' | 'everyone' }`:**
- **'me'** (default): Sets `deleted_for_sender=TRUE` (if sender) or `deleted_for_receiver=TRUE` (if receiver). No socket emit.
- **'everyone'** (sender only): Sets `deleted_at=NOW()`. Destroys Cloudinary file if present. Emits `message_deleted` to both participants' rooms.
- Receiver cannot delete for everyone (403).

**GET `/messages/:userId`** no longer filters `deleted_at IS NULL` — "delete for everyone" messages persist with `deleted_at` set, so the "This message was deleted" placeholder shows on every load (not just via socket).

**GET `/messages/conversations/list`** now uses a `CASE` expression for `last_message`:
- `deleted_at IS NOT NULL` → `'Deleted message'`
- `deleted_for_sender` (when current user is sender) → `'Deleted message'`
- `deleted_for_receiver` (when current user is receiver) → `'Deleted message'`
- Otherwise → actual message `content`
- No longer filters out deleted messages — all messages are candidates for the "most recent" slot.

**Client (`client/src/app/chat/page.tsx`):**
- `handleDelete` now updates local state for both scopes:
  - `'me'` → `filter` (remove from list)
  - `'everyone'` → `map` with `deleted_at` set (show placeholder immediately)
- Context menu shows two options for sender ("Delete for me" / "Delete for everyone"), one for receiver ("Delete for me").
- "This message was deleted" rendering (italic, muted, timestamp preserved).

**Client (`client/src/contexts/AuthContext.tsx`):**
- Adds `recentlyDeleted: string[]` and `recentlyEdited: MessageEdit[]` to context.
- Registers `message_deleted` and `message_edited` socket listeners globally (always active, not just on chat page).
- Chat page reads from these context values via `useEffect` sync as fallback, plus direct socket listeners for same-page real-time updates.

---

## 10. Feed Interactions (Like / Comments / Contact)

#### Song Feed Likes, Comments & Contact — 2026-07-13

**Migration:** `server/migrations/010_song_likes_comments.sql`

Adds two tables:
- `song_likes (id, song_id → shared_songs, user_id → users, created_at)` with `UNIQUE(song_id, user_id)` and index `idx_song_likes_song`.
- `song_comments (id, song_id → shared_songs, user_id → users, content, created_at, updated_at)` with index `idx_song_comments_song`.

**Server (`server/src/routes/sharedSongs.ts`):**
- `GET /shared-songs` now returns `likeCount` and `commentCount` per song via subquery aggregates (feed stays public).
- `GET /shared-songs/liked` (auth) → `{ likedSongIds }` for the current user (initial liked state on reload).
- `POST /shared-songs/:id/like` (auth) → toggles like (insert/delete), returns `{ liked }`.
- `GET /shared-songs/:id/comments` → list comments joined with author `display_name`/`avatar_url`, ordered oldest first.
- `POST /shared-songs/:id/comments` (auth) → inserts comment, returns joined comment row.
- `DELETE /shared-songs/:id/comments/:commentId` (auth) → deletes comment if comment owner OR the post author.

**Client types (`client/src/types/index.ts`):**
- `SharedSong` gains optional `likeCount`, `commentCount`.
- New `SongComment` interface.

**Client (`client/src/app/vibes/page.tsx`):**
- Per-post action bar: Like (heart, optimistic toggle + count), Comment (toggles collapsible section + count), Contact (right-aligned).
- Contact logic: if author is self → hidden; if connected → "Message" link to `/chat`; else "Contact" button that `POST /connections` (becomes "Request sent").
- Comments: lazy-loaded on open, inline composer (Enter to post), list with avatar/name/date, delete (trash) shown for comment owner or post author.
- Liked ids + connection ids fetched on mount when authenticated.

---

## 11. Community Posts (Announcements)

#### Posts feature — 2026-07-13

Social/announcement posts (e.g. "Vocalist needed for band", "Songs for sale"), separate from shared songs.

**Migration:** `server/migrations/011_posts.sql`
- `posts (id, user_id, category, title, content, visibility, created_at, updated_at)` — `category` ∈ `collab | forsale | looking | other`; `visibility` ∈ `public | connections-only`.
- `post_likes (id, post_id, user_id, created_at)` with `UNIQUE(post_id, user_id)`.
- `post_comments (id, post_id, user_id, content, created_at, updated_at)`.

**Server (`server/src/routes/posts.ts`, mounted at `/api/posts`):**
- `GET /posts` — list posts visible to the viewer. Optional auth (parsed from Bearer header). Public posts visible to all; `connections-only` posts visible only to the author or accepted connections. Returns `likeCount`/`commentCount` + author.
- `GET /posts/liked` (auth) → `{ likedPostIds }`.
- `GET /posts/user/:userId` — that user's posts, visibility-filtered for the viewer (owner sees all; connections see public+connections-only; others see public only).
- `POST /posts` (auth) → create post (validates category/visibility), returns `{ post }`.
- `POST /posts/:id/like` (auth) → toggle like.
- `GET /posts/:id/comments` / `POST /posts/:id/comments` (auth) / `DELETE /posts/:id/comments/:commentId` (auth, owner or post author).
- `DELETE /posts/:id` (auth, owner only).

**Client types:** `Post` and `PostComment` interfaces added to `client/src/types/index.ts`.

**Client (`client/src/components/feed/PostItem.tsx`):** reusable card for posts — category badge, title, content, visibility badge, Like / Comment / Contact action bar, comment thread, delete (owner). Mirrors `PostCard` but for posts (no audio/structure).

**Client (`client/src/app/creator-hub/page.tsx`):** "Community Posts" section below the song editor — "New Post" button opens a form (category select, title, details, visibility public/connections-only); lists the user's own posts via `PostItem`.

**Client profile pages (`client/src/app/profile/page.tsx` & `profile/[id]/page.tsx`):** Posts section now has a **Songs | Posts** tab. Posts tab lists `PostItem`s fetched from `/posts/user/:userId` with the same visibility rules, so public posts show to everyone and connection posts only to connections.

---

## 12. Notifications

#### Real-time notification system — 2026-07-14

**Migration:** `server/migrations/012_notifications.sql`

Creates `notifications` table: `id UUID PK`, `user_id UUID FK` (recipient), `type VARCHAR(50)`, `actor_id UUID FK` (who triggered it), `entity_type VARCHAR(50)`, `entity_id UUID`, `entity_title TEXT`, `read BOOLEAN DEFAULT false`, `created_at TIMESTAMPTZ`.

**Server (`server/src/routes/notifications.ts`, mounted at `/api/notifications`):**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/notifications` | List user's notifications (most recent first, limit 50) |
| `PUT` | `/notifications/:id/read` | Mark single notification as read |
| `PUT` | `/notifications/read-all` | Mark all as read |

**Notification types emitted:**

| Type | Trigger | Entity |
|------|---------|--------|
| `song_shared` | User shares a song to chat | shared_songs |
| `post_created` | User creates a post (visible to connections) | posts |
| `post_liked` | User likes another user's post | posts |

**Socket events:**
- `new_notification` — emitted to recipient's room with notification data
- Client receives and shows toast + updates bell badge in real-time

**Client components:**
- `NotificationBell.tsx` — bell icon with unread count badge, dropdown list, click to navigate
- `NotificationToast.tsx` — auto-dismissing toast (5s) on new notification, shows actor name + entity title
- Both handle `song_shared`, `post_created`, `post_liked` types with appropriate icons and labels

---

## 13. Guide Page

#### Landing page guide — 2026-07-14

**File:** `client/src/app/guide/page.tsx`

Public walkthrough page explaining how LocoVerse works. Six steps in a 3-column responsive grid:

| Step | Title | Description |
|------|-------|-------------|
| 01 | Create Your Profile | Sign up, add name/avatar/bio |
| 02 | Add Skills & Vibes | Tag instruments, pick vibe tags |
| 03 | Discover Collaborators | Browse by skills/vibes, find matches |
| 04 | Connect & Chat | Send requests, real-time messaging |
| 05 | Create Together | Creator Hub, structure editor, lyrics |
| 06 | Share & Get Feedback | Vibes feed, likes, comments |

**Layout:** `max-w-6xl` container, same as other pages. Hero section with title + subtitle. Steps in `grid sm:grid-cols-2 lg:grid-cols-3`. CTA at bottom with "Sign Up — Free" and "Back to Home" buttons.

**Navigation:** Home page "See How It Works" button links to `/guide`. Home page "Get Started" button links to `/register`.

---

## 14. Footer

#### Global footer component — 2026-07-14

**File:** `client/src/components/layout/Footer.tsx`

Simple footer rendered on every page via root layout (`layout.tsx`). Single continuous green line (`bg-accent-action`) spanning full width, with centered tagline text on top:

```
────── LocoVerse: Crafting crazy dreams into musical verses. ──────
```

Uses absolute positioning for the line (`top-1/2`) and relative positioning for the text with `bg-background` to cut through the line. Added to `layout.tsx` between `<main>` and `<FloatingChatButton>`.

---

## 15. Responsive Refinements

#### Mobile-first responsive pass — 2026-07-14

Systematic responsive tightening across all major pages:

**Navbar:**
- Nav padding: `px-4 py-3` → `px-3 py-2.5`
- Logo: `w-8 h-8` → `w-7 h-7`, text `text-lg` → `text-base`
- Hamburger: `p-2 size={22}` → `p-1.5 size={20}`
- Mobile menu: `mt-3 pb-3 pt-3 gap-3` → `mt-2 pb-2 pt-2 gap-1.5`
- Nav items: `text-xs py-2` → `text-[11px] py-1.5`
- Mobile menu closes on link click

**Discover page:**
- Added `mapUser()` function to convert API snake_case (`display_name`, `avatar_url`, `created_at`) to client camelCase
- Mobile card padding: `p-5` → `p-3 sm:p-5`
- Avatar: `w-10 h-10` → `w-9 h-9 sm:w-10 sm:h-10`
- Header: `text-xl` → `text-xl md:text-3xl`
- Filter panel, labels, bio, action buttons all tightened

**Profile page:**
- Header gradient: `h-32` → `h-24 sm:h-32`
- Avatar: `w-24 h-24` → `w-20 h-20 sm:w-28`
- Name: `text-2xl` → `text-xl sm:text-2xl md:text-3xl`
- Edit panel padding: `p-6` → `p-4 sm:p-6`
- Tabs: `gap-4 text-sm` → `gap-3 sm:gap-4 text-xs sm:text-sm`

**Vibes page (PostCard + PostItem):**
- Header: `p-5` → `p-3 sm:p-5`
- Title restructured: avatar + author on row 1, title on row 2 (full width)
- Title size: `text-lg` → `text-sm sm:text-base`
- Action bar: `px-5 py-3 gap-4` → `px-3 sm:px-5 py-2.5 sm:py-3 gap-3 sm:gap-4`
- Comments: `px-5 pb-5` → `px-3 sm:px-5 pb-3 sm:pb-5`
- Create button: `+` icon on mobile, text on desktop

**Chat page:**
- Reply click-to-scroll with highlight animation (`@keyframes highlightFlash`)
- Image preview modal (lightbox) with backdrop click + Escape to close
- Audio download button below each `<audio>` element
- `messageRefs` map for DOM lookup on reply scroll

**Landing page:**
- "Get Started" → `/register`, "See How It Works" → `/guide`
- Bottom CTA → `/register`
- All buttons wrapped in `<Link>` for navigation

### Notes

#### Song Comment Notifications — 2026-07-15

**Server (`server/src/routes/sharedSongs.ts`):**
- `POST /shared-songs/:id/comments` now inserts a notification row with type `song_commented` after comment creation
- Skips notification if comment owner is the song author (self-comment)
- Emits `new_notification` socket event to the song author's room

**Server (`server/src/routes/posts.ts`):**
- `POST /posts/:id/comments` now inserts a notification row with type `post_commented`
- Same self-comment skip logic

**Client (`client/src/components/layout/NotificationBell.tsx`):**
- Added display text for `song_commented` ("commented on your song") and `post_commented` ("commented on your post")

#### LikersList Component — 2026-07-15

**File:** `client/src/components/feed/LikersList.tsx`

Popover component showing who liked an entity. Props: `entityId`, `entityType: 'shared_song' | 'post'`, `count`, `trigger`.

**Server endpoints:**
- `GET /shared-songs/:id/likes` → returns `[{ id, display_name, avatar_url }]`
- `GET /posts/:id/likes` → returns `[{ id, display_name, avatar_url }]`

**Integration:**
- `PostCard.tsx` and `PostItem.tsx` — heart click toggles like, count click opens `LikersList`
- `shared-songs/[id]/page.tsx` — same pattern

#### Shared Song Public Page — 2026-07-15

**File:** `client/src/app/shared-songs/[id]/page.tsx`

Public page at `/shared-songs/[id]` — the destination for every shared link. Layout: `max-w-3xl mx-auto`.

**Sections rendered:**
1. Back to Vibes link
2. Share image (1200×630, full-width)
3. Title + author (avatar + displayName linked to profile, timestamp)
4. Optional description
5. Deduplicated chord chips (color-coded by root note)
6. Lyrics in bordered surface card
7. Per-section breakdown — each section card has `border-l-accent-action`, shows section label, per-section chords, content, and `<audio controls>` if `recordingUrl` present
8. Like toggle (optimistic) + count via `LikersList` + comment count
9. Comments section (lazy-loaded, inline composer, delete for owner/author)
10. CTA: "Create Your Own Song on LocoVerse"

#### Share Image Generator — 2026-07-15

**File:** `client/src/lib/generateShareImage.ts`

Client-side Canvas API renders 1200×630 PNG (OG standard size). No server involvement.

**Template:**
- Diagonal dark gradient background (`#1a1028` → `#2d1b3d` → `#0f0f1a`)
- 6 random semi-transparent burgundy circles as ambient decoration
- Inner frame with thin `#7F2447` stroke, inset 60px
- Title (52px bold white, centered, wrapped)
- Author line ("by {name}", 24px `#c4b5d4`)
- Up to 12 chord chips with colored backgrounds (same root-color hash as embed)
- Lyrics excerpt (first 200 chars, 20px white/70% opacity, max 5 lines)
- "LocoVerse" watermark (14px white/25%, bottom-right)

**Post-share flow:** `ShareSongModal.tsx` displays the generated image, provides Tweet/Save/Copy Link + embed code.

**Download fix:** `ShareImagePreview.tsx` fetches blob before triggering download to bypass Cloudinary cross-origin filename issue.

#### Embed System — 2026-07-15

**File:** `server/src/routes/embed.ts`, mounted at `/embed/song/:id`

Self-contained HTML page with no external dependencies. Used for social media link previews and iframe embeds.

**Template:**
- Inline `<style>` block, dark theme (`background: #0f0f1a`, text `#e2dde6`)
- LocoVerse header, title, author, chord chips (7 root-color hash), lyrics, sections list
- CTA: "View on LocoVerse" button (`background: #7F2447`)
- HTML-escaped to prevent XSS

**Embed code:** `<iframe src="locoverse.com/embed/song/:id" width="400" height="500">`

#### Stems Export (WAV Mix) — 2026-07-15

**File:** `client/src/lib/mixExport.ts`

Client-side WAV mixing via Web Audio API. No server involvement.

**Flow:**
1. Accepts `RecordingEntry[]` with `url`, `section`, `index`
2. `fetch(url)` → `arrayBuffer` → `decodeAudioData` for each recording
3. Creates `OfflineAudioContext` at 44100 Hz with total duration
4. Chains `BufferSource` nodes sequentially (each starts at cumulative time)
5. `startRendering()` produces mixed `AudioBuffer`
6. `encodeWAV()` writes WAV header + interleaved 16-bit PCM samples
7. Returns `Blob` with MIME `audio/wav`

**Component:** `ExportMixButton.tsx` — export button in Creator Hub header, triggers download with progress callback.

#### Chord Helper (AI Suggestions) — 2026-07-15

**Server endpoint** (`server/src/routes/compositions.ts`):
- `POST /api/compositions/suggest-chords` (JWT auth required)
- Request: `{ key: string, genre: string, mood: string }`
- Uses **Gemini 3.5 Flash** (`@google/generative-ai`) with system instruction for music theory
- Returns `{ chords: string[] }` (4-8 chords in standard notation)
- Region-block error handling: returns `{ error: 'REGION_BLOCKED' }` with friendly message

**Client component:** `client/src/components/workspace/ChordHelperModal.tsx`
- Key/genre/mood selectors (dropdowns), "Suggest" button with sparkle icon + spinner
- Rendered colored chord chips (same root-color scheme as embed/share-image)
- "Apply Chords" button inserts into the current section

#### ABC Notation Player — 2026-07-15

**Files:** `client/src/lib/audio.ts` (added `parseAbc()` and `playAbc()`), `client/src/components/workspace/NoteStaff.tsx`

**Problem:** `ABCJS.synth.CreateSynth()` timed out loading SoundFont from `paulrosen.github.io`.

**Solution:** Custom oscillator-based ABC player — no SoundFont dependency, instant playback:
- `parseAbc()` — parses ABC notation into individual notes with duration and octave
- `playAbc()` — plays via `OscillatorNode` per note through `AudioContext`, supports Play/Stop toggle
- Supports: note letters A-G, sharps (`^`), flats (`_`), naturals (`=`), octave markers (`,` lower / `'` higher), durations (`/2`, `/4`)
- Ignores: chord notation (`[...]`), rests (`z`), bar lines (`|`)

#### Shared Song Page Audio — 2026-07-15

**File:** `client/src/app/shared-songs/[id]/page.tsx`

Added per-section audio players inside each section card:

- Each `StructureBlock` in the sections breakdown checks for `recordingUrl`
- If present: renders `<audio controls>` with the recording URL below the section content, separated by a subtle top border
- Allows listeners to play/hear each section independently
- Removed the top-level global audio player (which only played the first available recording)

#### Songwriting Guide Modal — 2026-07-15

**File:** `client/src/components/workspace/SongwritingGuideModal.tsx`

A reusable modal component explaining how to use LocoVerse's songwriting tools. Seven steps in a vertical card layout:

| Step | Title | Focus |
|------|-------|-------|
| 01 | Create a Song | Name, BPM, time signature in Creator Hub |
| 02 | Add Sections | Verse, Chorus, Bridge — add and reorder |
| 03 | Write Lyrics + AI Help | Per-section textareas, AI generation |
| 04 | Add Chords | Chord fields, Chord Helper AI suggestions |
| 05 | Compose Melody | Piano Roll grid + ABC notation + MIDI keyboard |
| 06 | Record Audio | Per-section recording and playback |
| 07 | Export & Share | WAV export, sharing, embed codes |

**Integration:** A `?` button is placed at the right edge of the Songs/Posts tab bar in 3 files:

| File | Tab container line |
|------|--------------------|
| `client/src/app/profile/page.tsx` | ~325 |
| `client/src/app/profile/[id]/page.tsx` | ~210 |
| `client/src/app/creator-hub/page.tsx` | ~291 |

Clicking `?` opens the modal. `onClick` on the backdrop or "Got it" button closes it.

#### Articles / Blog Feature — 2026-07-15

**Migration:** `server/migrations/013_articles.sql`

Three new tables:
- `articles` — long-form content with `slug` (UNIQUE), `title`, `excerpt`, `body_html` (rich HTML), `cover_image_url`, `tags TEXT[]`, `read_time_minutes`, `is_published`, `published_at`
- `article_likes` — same pattern as `post_likes` / `song_likes`
- `article_comments` — same pattern as `post_comments` / `song_comments`

**Server routes** (`server/src/routes/articles.ts`, mounted at `/api/articles`):

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/articles` | No | List published articles (paginated, optional `?tag=` filter) |
| `GET` | `/api/articles/:slug` | No | Get single article by slug |
| `GET` | `/api/articles/user/:userId` | Optional | List by user (owner sees all, others see published only) |
| `POST` | `/api/articles` | Required | Create draft article |
| `PUT` | `/api/articles/:id` | Required | Update article (owner only) |
| `DELETE` | `/api/articles/:id` | Required | Delete (owner only) |
| `POST` | `/api/articles/:id/publish` | Required | Toggle publish/unpublish |
| `POST` | `/api/articles/:id/like` | Required | Toggle like (+ notification) |
| `GET` | `/api/articles/:id/likes` | No | List likers |
| `GET` | `/api/articles/:id/comments` | No | List comments |
| `POST` | `/api/articles/:id/comments` | Required | Add comment (+ notification) |
| `DELETE` | `/api/articles/:id/comments/:commentId` | Required | Delete (owner or article author) |

Slug auto-generation: lowercase, replace spaces/special chars with hyphens, deduplicate with random suffix.

**Client components:**

| File | Purpose |
|------|---------|
| `client/src/components/articles/ArticleEditor.tsx` | TipTap rich text editor (bold/italic/H2/H3/code/lists) + title/slug/excerpt/tags/cover-image fields |
| `client/src/components/articles/ArticleCard.tsx` | Feed card — cover image, title, excerpt, author, tags, read time, like/comment count |
| `client/src/app/articles/page.tsx` | Browse all published articles (paginated grid, tag filter pills) |
| `client/src/app/articles/[slug]/page.tsx` | Public article detail — cover image, HTML body, author info, tags, likes, comments |

**Integration points:**

| Location | Change |
|----------|--------|
| `server/src/index.ts` | Added `import articleRoutes` + `app.use("/api/articles", articleRoutes)` |
| `client/src/app/creator-hub/page.tsx` | Added "Articles" tab — list user's articles, "New Article" button opens `ArticleEditor` |
| `client/src/app/profile/page.tsx` | Added "Articles" tab — `ArticleCard` list with loading/empty states |
| `client/src/components/layout/Navbar.tsx` | Added "Articles" link (desktop + mobile) between Profile and connection requests |
| `client/src/components/layout/NotificationBell.tsx` | Added `article_liked` / `article_commented` type display + `/articles` link |

**Rich text editor:** TipTap (`@tiptap/react`, `@tiptap/starter-kit`) with toolbar: Bold, Italic, Heading 2/3, Code Block, Bullet/Ordered lists. HTML body stored in `body_html` column; rendered with `dangerouslySetInnerHTML` on the detail page with Tailwind prose styles.

**Notifications:** Like/comment on articles emit `new_notification` socket events with types `article_liked` and `article_commented`, linking to `/articles`.

#### Cancel Loco Request, Online Status, Activity Feed, Navbar Search — 2026-07-16

**Cancel sent Loco request:**
- `client/src/app/discover/page.tsx` — `sentRequests` changed from `Set<string>` to `Record<string, string>` (userId → connectionId). "Loco Sent" button shows "Cancel" on hover. Calls `DELETE /connections/:id`.
- `client/src/app/profile/[id]/page.tsx` — `requestSent` changed from boolean to connection ID string. "Loco sent" button shows "Cancel" on hover.

**Online status on profile pages:**
- `client/src/app/profile/[id]/page.tsx` — `onlineUsers` state + socket listeners for `user_online`/`user_offline`. Green dot on avatar. "● Online" / "○ Offline" text next to display name.

**Activity feed:**
- `server/src/routes/users.ts` — new `GET /:id/activity` endpoint UNIONing recent public songs, posts, and articles.
- `client/src/app/profile/page.tsx` — "Activity" tab shows a timeline of recent activity with colored dots (song=burgundy, post=mauve, article=blue).

**Navbar user search:**
- `client/src/components/layout/Navbar.tsx` — search icon (magnifying glass) between Articles and connection requests. Opens dropdown with debounced search input. Results show avatar + name linking to profile. Click outside closes.

**Migration system fix:**
- `server/src/config/migrate.ts` — now tracks applied migrations in `_migrations` table, skipping already-applied files
- `server/migrations/007_compositions.sql` — added `IF NOT EXISTS`
- `server/migrations/015_bpm_time_signature.sql` — added `IF NOT EXISTS` to ALTER TABLE statements

---

## Notes

### Login Error Differentiation (2026-07-17)

- `server/src/routes/auth.ts:47` — changed `'Invalid credentials'` → `'No account found with this email'` when email doesn't exist
- `server/src/routes/auth.ts:57` — changed `'Invalid credentials'` → `'Incorrect password'` when password doesn't match
- Client (`client/src/app/login/page.tsx`) — no change needed; already displays `err.response.data.error` from server

### Notification Count Stuck After Accepting Loco Request (2026-07-17)

**Bug:** Accepting/rejecting a connection request left the original `loco_request` notification `read=FALSE`, keeping the badge count stuck.

**Server fix** (`server/src/routes/connections.ts`):
- Accept handler (~line 79) — added `UPDATE notifications SET read = TRUE` for the `loco_request` matching the accepting user + requester + connection ID
- Reject handler (~line 127) — same update added

**Client fix** (`client/src/components/layout/NotificationBell.tsx`):
- Added socket listeners for `connection_accepted` and `request_rejected` events that call `fetchUnread()` to refresh the badge count in real-time

### UserPlus Badge Uses Notification Read Status (2026-07-17)

**Problem:** UserPlus badge showed `requests.length` (pending connections), which never cleared when reading notifications in the bell or visiting `/discover`. Only accepting/rejecting cleared it.

**Solution:** UserPlus badge now tracks unread `loco_request` notification count instead of pending connections.

**Server** (`server/src/routes/notifications.ts`):
- `GET /notifications/unread-count` now accepts optional `?type=` query param to filter by notification type

**Client** (`client/src/components/layout/Navbar.tsx`):
- Added `unreadRequestCount` state fetching `/notifications/unread-count?type=loco_request`
- Increments on `new_loco_request` socket event; re-fetches on `connection_accepted`/`request_rejected`
- UserPlus badge (`requests.length > 0` → `unreadRequestCount > 0`)

**Client** (`client/src/components/layout/NotificationBell.tsx`):
- Accepts optional `onNotificationsRead` prop
- Calls `onNotificationsRead?.()` when marking all notifications as read (bell open + "Mark all read" button)
- Navbar passes `fetchUnreadRequestCount` as the callback, keeping both badges in sync

### Song Like Notifications (2026-07-17)

**Problem:** `POST /shared-songs/:id/like` only inserted the like row — no notification was created for the song owner.

**Server fix** (`server/src/routes/sharedSongs.ts`):
- After `INSERT INTO song_likes`, added notification creation + socket emit for the song owner (type `song_liked`, entity `shared_song`)

**Client fixes:**
- `NotificationToast.tsx` — added `song_liked` case for toast message
- `NotificationBell.tsx` — added `song_liked` entity mapping (`shared_song`) and bell text (`'liked your song'`)

---

### Critical Fixes — Phase 1 (2026-07-17)

**#3 — Chat socket emission** (`server/src/routes/messages.ts:102`):
- Added `io.to(sender).to(receiver).emit('receive_message', result.rows[0])` after message INSERT so messages appear in real-time

**#6 — Remove process.exit on pool error** (`server/src/config/database.ts:10`):
- Removed `process.exit(-1)` — pool errors no longer crash the entire server

**#7 — _migrations table not dropped by reset** (`server/src/config/reset.ts:12`):
- Added `DROP TABLE IF EXISTS _migrations CASCADE` so subsequent `npm run migrate` actually runs migrations

**#9 + #10 — Missing cascade + entity_title** (`server/migrations/017_cascade_entity_title.sql`):
- Added `entity_title VARCHAR(255)` column to `notifications` table
- Added `ON DELETE CASCADE` to 3 missing foreign keys: `compositions.user_id`, `shared_songs.user_id`, `shared_songs.composition_id`

### Critical Fixes — Phase 2 (2026-07-17)

**#11 — delete-audio ownership check** (`server/src/routes/compositions.ts:104`):
- Before deleting from Cloudinary, verifies the publicId belongs to a composition owned by the requesting user via JSONB containment query (`structure @> '[{"recordingPublicId": ...}]'`)

**#8 — Rate limiting on auth routes** (`server/src/index.ts:25-32`):
- Added `express-rate-limit` — login/register limited to 10 attempts per 15-minute window per IP
- Added JSON body size limit (`10mb`)

**#12 — UUID validation on shared-songs user route** (`server/src/routes/sharedSongs.ts:63`):
- Added UUID regex validation for `:userId` param — returns 400 instead of crashing with PostgreSQL error

### Critical Fixes — Phase 3 (Security) (2026-07-17)

**#4 — Socket JWT verification** (`server/src/config/socket.ts:16-27`):
- Added `io.use()` middleware that verifies JWT from `socket.handshake.auth.token` before accepting connection
- Invalid/disconnected tokens are rejected with `connect_error: Invalid token`
- Client (`client/src/lib/socket.ts`) now sends token from localStorage on connect

**#5 — Socket join event auth** (`server/src/config/socket.ts:40-44`):
- `join` event now validates `data.userId === authenticated userId` — clients can only join their own room
- Also added sender validation on `send_message`, `typing`, `typing_stop` events to prevent impersonation
- CORS origin now uses `env.CLIENT_URL` consistently

### Real-Time Song Like Sync (2026-07-17)

**Problem:** Other users viewing the Vibes feed didn't see like count updates in real-time when someone liked/unliked a song. Only the liker saw the change (via optimistic local state).

**Server** (`server/src/routes/sharedSongs.ts:307-322`):
- After like/unlike toggle, queries the new total count from `song_likes`
- Broadcasts `song_like_toggled` to **all** connected clients with `{ songId, userId, liked, count }`
- Refactored the like/unlike branches into a single flow with a `wasAlreadyLiked` flag

**Client** (`client/src/app/vibes/page.tsx:71-82`):
- Added socket listener for `song_like_toggled`
- Skips update if `userId === currentUser` (the liker already has optimistic state)
- Otherwise, updates the `songs` array's `likeCount` from the event's `count`

**Client** (`client/src/components/feed/PostCard.tsx:32-39`):
- Added `useEffect` to sync `likeCount` state when `song.likeCount` prop changes
- Added `useEffect` to sync `liked` state when `isLiked` prop changes (e.g., page re-fetch)
- Ensures the UI reacts to prop updates from the parent's socket-driven state changes

### Existing Feature Improvements (2026-07-17)

**Creator Hub autosave** (`client/src/app/creator-hub/page.tsx`):
- Debounced autosave (2s) when composition is dirty
- `beforeunload` warning for unsaved changes; confirm when switching songs
- Save status indicator (unsaved / saving / error)

**Toast notifications** (`client/src/contexts/ToastContext.tsx`, `client/src/components/ui/ToastContainer.tsx`):
- Global `useToast()` for success/error feedback across Creator Hub, Discover, Chat, Profile, Share modals

**Pagination**:
- Discover: `page`/`limit` + Load more (`client/src/app/discover/page.tsx`, `server/src/routes/users.ts` returns `hasMore`)
- Vibes: paginated songs + posts feed (`client/src/app/vibes/page.tsx`, `server/src/routes/posts.ts`, `sharedSongs.ts`)
- Chat: Load older messages (`client/src/app/chat/page.tsx`, `server/src/routes/messages.ts` returns `hasMore`)

**Avatar upload** (`server/src/routes/users.ts` POST `/me/avatar`, `client/src/app/profile/page.tsx`):
- Cloudinary upload for custom avatars (JPEG/PNG/GIF/WebP)

**Discover skills/vibes sync** (`client/src/app/discover/page.tsx`):
- Filters now load from `/api/skills` and `/api/vibes` instead of hardcoded lists

**Auth hardening**:
- JWT in httpOnly cookie `locoverse_token` (`server/src/utils/authCookie.ts`, `server/src/utils/token.ts`)
- `authMiddleware` reads cookie or Bearer header; client uses `withCredentials` (`client/src/lib/api.ts`)
- `POST /auth/logout` clears cookie; no more `localStorage` token
- `express-validator` on register/login/google/forgot/reset/profile
- Per-email login rate limit (5 per 15 min); `helmet` + `cookie-parser` on server
- Socket auth reads cookie via `withCredentials` (`server/src/config/socket.ts`, `client/src/lib/socket.ts`)
- Query logging disabled in production (`server/src/config/database.ts`)

### Remaining
- **#1 — Rotate credentials**: The `.env` file still contains production secrets (Neon DB, Google OAuth, Cloudinary, Gemini). These should be revoked at their respective dashboards and regenerated.
- **#4 on client**: Client now sends JWT token on connect — no further action needed.

### Blocks & Reports (2026-07-17)

**Migration:** `server/migrations/019_blocks_reports.sql`

Two new tables:
- `blocks (blocker_id UUID FK, blocked_id UUID FK, created_at TIMESTAMPTZ)` — composite PK, CHECK(blocker_id != blocked_id)
- `reports (id UUID PK, reporter_id UUID FK, target_type VARCHAR, target_id UUID, reason TEXT, created_at TIMESTAMPTZ)`

**Server routes** (`server/src/routes/safety.ts`, mounted at `/api/blocks`):

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/blocks` | Block a user (also removes any existing connection between them) |
| `DELETE` | `/api/blocks/:blockedUserId` | Unblock a user |
| `GET` | `/api/blocks` | List blocked user IDs for current user |
| `POST` | `/api/blocks/reports` | Submit a report (targetType: user/post/shared_song/message) |

**Block behavior:**
- Blocking a user automatically deletes any connection between them (both directions)
- Blocked users are filtered from: search results (`GET /users`), chat conversations (`GET /messages/conversations/list`), connection requests
- Blocks are one-directional — the blocked user can still see the blocker unless they also block

**Report behavior:**
- Reports are stored in the `reports` table with `reporter_id`, `target_type`, `target_id`, and `reason`
- No admin interface exists yet — reports are logged to console and stored for future review
- Client UI: `ReportModal.tsx` component with reason selector (radio buttons) and optional "Other" text input
