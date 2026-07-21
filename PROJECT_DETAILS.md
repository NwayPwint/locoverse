# LocoVerse - Project Details

## What is LocoVerse?

A digital community platform where music hobbyists discover collaborators, create compositions together, and bring musical ideas to life — all in one place. Think **"Discovery, Chat & Creation for musicians"** — find your creative match, write lyrics, compose melodies, and build songs together on-platform.

---

## Core Philosophy

| Principle | Description |
|-----------|-------------|
| **Skill Agnostic** | No rigid roles. You're a creative individual, not "a singer" or "a guitarist." |
| **Open Invitation** | Post what you need, not auditions. Find collaborators organically. |
| **Create Together** | Compose and write songs on-platform, no paper or external tools needed. |
| **No Pressure** | Hobby-first. Growth through feedback, not competition. |

---

## Available Features

### 1. Authentication

- Email/password registration
- Google social login
- Secure JWT-based sessions

### 2. User Profile

- Display name, avatar, bio
- **Skills tags** — what you can do (e.g., Vocals, Guitar, Production, Lyrics, Mixing, Drums)
- **Vibe tags** — your musical personality (e.g., Chill, Energetic, Experimental, Nostalgic, Dark, Melodic)
- "Looking for" status (Band members, Jam partner, Feedback buddy, Just exploring)

### 3. Discovery / Browse Users

- Filter users by skills tags
- Filter users by vibe tags
- Browse profiles, view details
- Search functionality

### 4. Real-Time Chat

- One-on-one messaging
- Real-time via Socket.io
- Chat history stored in PostgreSQL
- Online/offline status indicators
- Typing indicators
- Message features: Reply, Edit, Delete (for me / for everyone), Copy, Forward
- File attachments (images, audio, PDF) via Cloudinary
- Per-user delete: "Delete for me" removes from your view, "Delete for everyone" shows "This message was deleted" placeholder for both parties

### 5. Connection System

- Send connection request
- Accept/reject requests
- View connected collaborators

### 6. Music Workspace

- Compose songs with structure editor (verses, choruses, bridges)
- Built-in lyrics editor with formatting
- AI-powered lyric generation
- Save, edit, and manage compositions
- Share compositions with collaborators
- Per-section audio recording and playback
- BPM and time signature settings
- Piano Roll for visual melody composition
- ABC notation display and playback
- MIDI keyboard input
- Chord fields per section
- Chord Helper (AI chord suggestions by key/genre/mood)
- Chord Presets (predefined progressions: Pop, Rock, Sad, Blues, etc.)
- WAV stems export (client-side mixing via Web Audio API)

### 7. Shared Song Page

- Public page at `/shared-songs/[id]` — the destination for every shared link
- Displays share image (1200×630 album-art style), title, author, description, chords, lyrics
- Per-section breakdown with colored left border accent
- **Per-section audio players** — each section with a recording shows its own `<audio controls>` element
- Like button with optimistic toggle, likers list popup
- Comments section (lazy-loaded) with avatar, name, delete button for author/comment owner
- CTA: "Create Your Own Song on LocoVerse"

### 8. Embed System

- Self-contained HTML page at `/embed/song/:id` — no external dependencies
- Inline dark-theme CSS, shows title, author, chords, lyrics, sections, CTA button
- Embed code: `<iframe src="locoverse.com/embed/song/:id" width="400" height="500">`

### 9. Share Image Generation

- Client-side Canvas API renders 1200×630 album-art image (OG standard size)
- Dark gradient background, title, author, chord pills, lyrics excerpt, LocoVerse watermark
- Post-share screen shows preview + Tweet/Save/Copy Link buttons + embed code

### 10. Stems Export

- Client-side WAV mixing via Web Audio API — no server involvement
- Sequential concatenation of all section recordings (verse → chorus → etc.)
- Each section's recording fetched, decoded, chained via `OfflineAudioContext`
- Output: 16-bit PCM WAV (stereo, 44100 Hz)
- Export button in Creator Hub header downloads the mixed WAV

### 11. Chord Helper (AI Suggestions)

- `POST /api/compositions/suggest-chords` with `{ key, genre, mood }`
- Uses **Gemini 3.5 Flash** (`@google/generative-ai` SDK) — returns 4-8 chord suggestions
- Client modal with key/genre/mood selectors, "Suggest" button, rendered colored chord chips
- "Apply Chords" button inserts into current section

### 12. Community Posts

- Create posts with categories (Collaboration, For Sale, Looking For, Other)
- Visibility controls (public / connections-only)
- Like and comment on posts
- Edit and delete posts (owner only)
- Post creation from Creator Hub

### 13. Articles / Blog

- Rich text editor (TipTap) with bold, italic, headings, code, lists
- Draft/publish workflow
- Tags and cover images
- Like and comment on articles
- Browse articles at `/articles`

### 14. Notifications

- Real-time notifications via Socket.io
- DB-persisted (survive refresh)
- Notification bell with unread badge
- Auto-dismissing toast notifications
- Types: song_shared, post_created, post_liked, song_commented, post_commented, song_liked, article_liked, article_commented, loco_request

### 15. Safety & Moderation

- Block/unblock users (removes connection automatically)
- Report content (users, posts, songs, messages)
- Blocked users filtered from search, chat, and feeds

### 16. Likers & Comment Notifications

- `LikersList` component — popup showing user avatars/names who liked a post or song
- Notification types: `song_commented`, `post_commented` emit socket + DB insert on comment
- NotificationBell displays "commented on your song/post" text
- Self-comments skip notification

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React / Next.js |
| Backend | Node.js / Express.js |
| Database | PostgreSQL |
| Real-time | Socket.io |
| Auth | JWT + Google OAuth |
| AI | Gemini 3.5 Flash via `@google/generative-ai` (lyrics + chord suggestions) |

---

## Target Audience

- Music hobbyists who lack access to studios or bands
- Introverts who prefer digital spaces for creative creation
- Songwriters who want a simple digital workspace
- Collaborators who want to write together without being in the same room
- Anyone passionate about music looking for like-minded creators
