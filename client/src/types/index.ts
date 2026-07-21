export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  lookingFor?: "band_members" | "jam_partner" | "feedback_buddy" | "exploring";
  skills: Skill[];
  vibes: Vibe[];
  createdAt: string;
  songCount?: number;
  postCount?: number;
}

export interface Skill {
  id: number;
  name: string;
  category: "instrument" | "production" | "vocal" | "theory";
}

export interface Vibe {
  id: number;
  name: string;
}

export interface CompositionStructureItem {
  section: "verse" | "chorus" | "bridge" | "intro" | "outro";
  index: number;
  content: string;
  chords?: string;
  recordingUrl?: string;
  recordingPublicId?: string;
  notes?: string;
  bars?: number;
}

export interface Composition {
  id: string;
  user_id: string;
  title: string;
  lyrics: string;
  structure: CompositionStructureItem[];
  bpm: number;
  timeSignature: string;
  created_at: string;
  updated_at: string;
}

export interface SharedSong {
  id: string;
  user_id: string;
  composition_id?: string | null;
  title: string;
  description: string;
  lyrics: string;
  structure: CompositionStructureItem[];
  bpm?: number;
  timeSignature?: string;
  audio_url?: string | null;
  visibility: "public" | "connections-only";
  shareScope: "whole" | "section";
  sectionIndex?: number | null;
  shareImageUrl?: string | null;
  created_at: string;
  updated_at: string;
  likeCount?: number;
  commentCount?: number;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface SongComment {
  id: string;
  song_id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface Post {
  id: string;
  user_id: string;
  category: "collab" | "forsale" | "looking" | "other";
  title: string;
  content: string;
  visibility: "public" | "connections-only";
  created_at: string;
  updated_at: string;
  likeCount?: number;
  commentCount?: number;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface Article {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_html: string;
  cover_image_url?: string | null;
  tags: string[];
  read_time_minutes: number;
  is_published: boolean;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  likeCount?: number;
  commentCount?: number;
  liked?: boolean;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

export interface ArticleComment {
  id: string;
  article_id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface Liker {
  id: string;
  display_name: string;
  avatar_url?: string | null;
}