# LocoVerse - Agent Instructions

## Project Overview

Music hobbyist discovery + chat + creation platform. Users create profiles with skills/vibe tags, find collaborators, chat in real-time, and compose songs together on-platform using built-in lyrics editor, music tools, and AI generation.

## Tech Stack

- **Frontend:** Next.js (React)
- **Backend:** Express.js (Node.js)
- **Database:** PostgreSQL
- **Real-time:** Socket.io (chat)
- **Auth:** JWT + Google OAuth
- **AI:** Google Gemini (lyrics + chord suggestions)

## Project Structure

```
LocoVerse/
├── client/          # Next.js frontend (separate package.json)
├── server/          # Express.js backend (separate package.json)
├── .opencode/       # OpenCode config + skills
├── PROJECT_DETAILS.md
├── CODE_EXPLANATION.md
├── PRODUCTION_NOTES.md
├── FEATURES.md
└── AGENTS.md
```

## Key Decisions

- **Discovery model:** Skills tags + Vibe tags (not role-based)
- **Chat:** Real-time via Socket.io (not polling)
- **Scope MVP:** Auth, Profile, Discovery, Chat, Connection requests, Creator Hub, Vibes Feed, Articles, Notifications, Blocks/Reports
- **No root workspace:** Client and server run independently
- **AI integration:** Google Gemini Flash via `@google/generative-ai` — lyrics generation + chord suggestions
- **Composition model:** Structured songs (verses, choruses, bridges) stored as JSON in PostgreSQL

## Commands

### Server (run from `server/`)

```bash
npm install           # Install dependencies
npm run dev           # Start Express dev server
npm run migrate       # Run PostgreSQL migrations
npm run seed          # Seed skills & vibes data
npm run db:reset      # Drop all tables
```

### Client (run from `client/`)

```bash
npm install           # Install dependencies
npm run dev           # Start Next.js dev server
npm run build         # Production build
npm run lint          # Run ESLint
```

### Running Both

Open two terminals:
- Terminal 1: `cd server && npm run dev`
- Terminal 2: `cd client && npm run dev`

Or from root (requires `concurrently`):
```bash
npm run dev
```

## Notes

- See `PROJECT_DETAILS.md` for full feature spec
- See `CODE_EXPLANATION.md` for code flow documentation
- See `PRODUCTION_NOTES.md` for production readiness checklist

## Workflow

After implementing each feature, add a note in `CODE_EXPLANATION.md` under the **Notes** section at the bottom documenting the code flow of the new feature. Keep it concise — files involved, endpoint signatures, data flow direction.
