import { Router, Response } from "express";
import { query } from "../config/database";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { getUserIdFromRequest } from '../utils/token';
import { getIO } from "../config/socket";

const router = Router();

router.get("/", async (_req, res: Response) => {
  try {
    const limit = Number(_req.query.limit) || 20;
    const page = Number(_req.query.page) || 1;
    const offset = (page - 1) * limit;

    const viewerId = getUserIdFromRequest(_req);

    let blockFilter = '';
    let params: any[] = [limit, offset];
    if (viewerId) {
      blockFilter = `AND ss.user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $3)
                     AND ss.user_id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = $3)`;
      params = [limit, offset, viewerId];
    }

    const result = await query(
      `SELECT ss.*, u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM song_likes l WHERE l.song_id = ss.id)::int AS like_count,
        (SELECT COUNT(*) FROM song_comments c WHERE c.song_id = ss.id)::int AS comment_count
       FROM shared_songs ss
       JOIN users u ON u.id = ss.user_id
       WHERE ss.visibility = 'public' ${blockFilter}
       ORDER BY ss.created_at DESC
       LIMIT $1 OFFSET $2`,
      params,
    );

    const sharedSongs = result.rows.map((row: any) => ({
      ...row, shareScope: row.share_scope, sectionIndex: row.section_index,
      shareImageUrl: row.share_image_url, timeSignature: row.time_signature,
      likeCount: row.like_count, commentCount: row.comment_count,
      author: {
        id: row.user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
      },
    }));

    res.json({ sharedSongs, hasMore: result.rows.length === limit, page });
  } catch (error) {
    console.error("Get shared songs error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/liked", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      "SELECT song_id FROM song_likes WHERE user_id = $1",
      [req.userId],
    );
    res.json({ likedSongIds: result.rows.map((r: any) => r.song_id) });
  } catch (error) {
    console.error("Get liked songs error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/user/:userId", async (req, res: Response) => {
  try {
    const ownerId = req.params.userId;
    if (!UUID_REGEX.test(ownerId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    const viewerId = getUserIdFromRequest(req);

    let canSeeAll = false;
    if (viewerId) {
      if (viewerId === ownerId) {
        canSeeAll = true;
      } else {
        const conn = await query(
          `SELECT 1 FROM connections
           WHERE ((requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1))
           AND status = 'accepted'`,
          [viewerId, ownerId]
        );
        canSeeAll = conn.rows.length > 0;
      }
    }

    const visibilityFilter = canSeeAll ? "" : "AND ss.visibility = 'public'";

    const result = await query(
      `SELECT ss.*, u.display_name, u.avatar_url,
         (SELECT COUNT(*) FROM song_likes l WHERE l.song_id = ss.id)::int AS like_count,
         (SELECT COUNT(*) FROM song_comments c WHERE c.song_id = ss.id)::int AS comment_count
       FROM shared_songs ss
       JOIN users u ON u.id = ss.user_id
       WHERE ss.user_id = $1 ${visibilityFilter}
       ORDER BY ss.created_at DESC`,
      [ownerId]
    );

    const sharedSongs = result.rows.map((row: any) => ({
      ...row,
      shareScope: row.share_scope,
      sectionIndex: row.section_index,
      shareImageUrl: row.share_image_url,
      timeSignature: row.time_signature,
      likeCount: row.like_count,
      commentCount: row.comment_count,
      author: {
        id: row.user_id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
      },
    }));

    res.json({ sharedSongs });
  } catch (error) {
    console.error("Get user shared songs error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", async (req, res: Response) => {
  try {
    const result = await query(
      `SELECT ss.*, u.display_name, u.avatar_url
       FROM shared_songs ss
       JOIN users u ON u.id = ss.user_id
       WHERE ss.id = $1 AND ss.visibility = 'public'`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Shared song not found" });
    }

    const row = result.rows[0];
    res.json({
      sharedSong: {
        ...row, shareScope: row.share_scope, sectionIndex: row.section_index,
        shareImageUrl: row.share_image_url, timeSignature: row.time_signature,
        author: {
          id: row.user_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
        },
      },
    });
  } catch (error) {
    console.error("Get shared song error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      compositionId,
      title,
      description,
      audioUrl,
      lyrics,
      structure,
      visibility = "public",
      shareScope = "whole",
      sectionIndex = null,
    } = req.body;

    const safeTitle = String(title || "Untitled").slice(0, 200);
    const safeDescription = String(description || "").slice(0, 2000);
    const validVisibility = visibility === "connections-only" ? "connections-only" : "public";
    let shareTitle = safeTitle;
    let shareLyrics = lyrics ? String(lyrics).slice(0, 50000) : null;
    let shareStructure = Array.isArray(structure) ? structure.slice(0, 50) : null;
    let shareAudioUrl = audioUrl;
    let composition_id = compositionId || null;
    let finalBpm = req.body.bpm ?? null;
    let finalTimeSignature = req.body.timeSignature ?? null;
    let finalScope = shareScope === "section" ? "section" : "whole";
    let finalSectionIndex: number | null = null;

    if (compositionId) {
      const compResult = await query(
        "SELECT * FROM compositions WHERE id = $1 AND user_id = $2",
        [compositionId, req.userId],
      );
      if (compResult.rows.length === 0) {
        return res.status(404).json({ error: "Composition not found" });
      }

      const composition = compResult.rows[0];
      const compStructure = (composition.structure || []) as any[];
      shareTitle = shareTitle || composition.title;
      shareLyrics = shareLyrics || composition.lyrics || "";
      shareStructure = shareStructure || compStructure;
      finalBpm = composition.bpm ?? null;
      finalTimeSignature = composition.time_signature ?? null;

      if (
        finalScope === "section" &&
        Number.isInteger(sectionIndex) &&
        compStructure[sectionIndex as number]
      ) {
        const chosen = compStructure[sectionIndex as number];
        shareLyrics = chosen.content || "";
        shareAudioUrl = chosen.recordingUrl || null;
        finalSectionIndex = sectionIndex as number;
      } else {
        finalScope = "whole";
        shareAudioUrl =
          shareAudioUrl ||
          compStructure.find((item: any) => item.recordingUrl)?.recordingUrl ||
          null;
      }
    }

    const result = await query(
      `INSERT INTO shared_songs
       (user_id, composition_id, title, description, lyrics, structure, audio_url, visibility, share_scope, section_index, bpm, time_signature)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        req.userId,
        composition_id,
        shareTitle || "Untitled",
        safeDescription,
        shareLyrics || "",
        JSON.stringify(shareStructure || []),
        shareAudioUrl || null,
        validVisibility,
        finalScope,
        finalSectionIndex,
        finalBpm,
        finalTimeSignature,
      ],
    );

    const sharedSong = result.rows[0];

    // Notify connections
    try {
      const connections = await query(
        `SELECT CASE WHEN requester_id = $1 THEN receiver_id ELSE requester_id END AS connection_id
         FROM connections
         WHERE (requester_id = $1 OR receiver_id = $1) AND status = 'accepted'`,
        [req.userId]
      );
      const io = getIO();
      const actorResult = await query('SELECT display_name, avatar_url FROM users WHERE id = $1', [req.userId]);
      const actorName = actorResult.rows[0]?.display_name || 'Someone';
      const actorAvatar = actorResult.rows[0]?.avatar_url || null;
      for (const row of connections.rows) {
        const notifResult = await query(
          `INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
           VALUES ($1, $2, 'song_shared', 'shared_song', $3) RETURNING *`,
          [row.connection_id, req.userId, sharedSong.id]
        );
        io.to(row.connection_id).emit('new_notification', {
          id: notifResult.rows[0].id,
          type: 'song_shared',
          actorName,
          actorAvatar,
          entityTitle: shareTitle || 'Untitled',
          createdAt: notifResult.rows[0].created_at,
        });
      }
    } catch (err) {
      console.error('Failed to notify connections for song:', err);
    }

    res.status(201).json({ sharedSong });
  } catch (error) {
    console.error("Create shared song error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { shareImageUrl } = req.body;
    const result = await query(
      `UPDATE shared_songs SET share_image_url = COALESCE($1, share_image_url), updated_at = NOW()
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [shareImageUrl || null, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Shared song not found" });
    }
    res.json({ sharedSong: result.rows[0] });
  } catch (error) {
    console.error("Update shared song error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/like", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const songId = req.params.id;
    const existing = await query(
      "SELECT id FROM song_likes WHERE song_id = $1 AND user_id = $2",
      [songId, req.userId],
    );

    const wasAlreadyLiked = existing.rows.length > 0;

    if (wasAlreadyLiked) {
      await query(
        "DELETE FROM song_likes WHERE song_id = $1 AND user_id = $2",
        [songId, req.userId],
      );
    } else {
      await query(
        "INSERT INTO song_likes (song_id, user_id) VALUES ($1, $2)",
        [songId, req.userId],
      );
    }

    const liked = !wasAlreadyLiked;
    const countResult = await query("SELECT COUNT(*)::int as count FROM song_likes WHERE song_id = $1", [songId]);
    const songOwnerResult = await query("SELECT user_id FROM shared_songs WHERE id = $1", [songId]);
    const songOwnerId = songOwnerResult.rows[0]?.user_id;
    const io = getIO();

    if (songOwnerId && songOwnerId !== req.userId) {
      io.to(songOwnerId).to(req.userId!).emit("song_like_toggled", {
        songId,
        userId: req.userId,
        liked,
        count: countResult.rows[0].count,
      });
    } else {
      io.to(req.userId!).emit("song_like_toggled", {
        songId,
        userId: req.userId,
        liked,
        count: countResult.rows[0].count,
      });
    }

    if (liked) {
      try {
        const songResult = await query("SELECT user_id, title FROM shared_songs WHERE id = $1", [songId]);
        const ownerId = songResult.rows[0]?.user_id;
        if (ownerId && ownerId !== req.userId) {
          const actorResult = await query("SELECT display_name, avatar_url FROM users WHERE id = $1", [req.userId]);
          const actorName = actorResult.rows[0]?.display_name || "Someone";
          const actorAvatar = actorResult.rows[0]?.avatar_url || null;
          const notifResult = await query(
            `INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
             VALUES ($1, $2, 'song_liked', 'shared_song', $3) RETURNING *`,
            [ownerId, req.userId, songId],
          );
          io.to(ownerId).emit("new_notification", {
            id: notifResult.rows[0].id,
            type: "song_liked",
            actorName,
            actorAvatar,
            entityTitle: songResult.rows[0]?.title || "Untitled",
            createdAt: notifResult.rows[0].created_at,
          });
        }
      } catch (err) {
        console.error("Failed to notify song owner for like:", err);
      }
    }

    return res.status(liked ? 201 : 200).json({ liked });
  } catch (error) {
    console.error("Toggle like error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id/likes", async (req, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.display_name, u.avatar_url
       FROM song_likes l
       JOIN users u ON u.id = l.user_id
       WHERE l.song_id = $1
       ORDER BY l.created_at DESC`,
      [req.params.id]
    );
    res.json({ likers: result.rows });
  } catch (error) {
    console.error("Get song likers error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id/comments", async (req, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, u.display_name, u.avatar_url
       FROM song_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.song_id = $1
       ORDER BY c.created_at ASC`,
      [req.params.id],
    );
    res.json({ comments: result.rows });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/comments", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const content = (req.body.content || "").trim();
    if (!content) {
      return res.status(400).json({ error: "Comment required" });
    }

    const insert = await query(
      `INSERT INTO song_comments (song_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.id, req.userId, content],
    );

    const result = await query(
      `SELECT c.*, u.display_name, u.avatar_url
       FROM song_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [insert.rows[0].id],
    );

    // Notify song owner
    try {
      const songResult = await query('SELECT user_id, title FROM shared_songs WHERE id = $1', [req.params.id]);
      const ownerId = songResult.rows[0]?.user_id;
      if (ownerId && ownerId !== req.userId) {
        const actorResult = await query('SELECT display_name, avatar_url FROM users WHERE id = $1', [req.userId]);
        const actorName = actorResult.rows[0]?.display_name || 'Someone';
        const actorAvatar = actorResult.rows[0]?.avatar_url || null;
        const notifResult = await query(
          `INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
           VALUES ($1, $2, 'song_commented', 'shared_song', $3) RETURNING *`,
          [ownerId, req.userId, req.params.id]
        );
        const io = getIO();
        io.to(ownerId).emit('new_notification', {
          id: notifResult.rows[0].id,
          type: 'song_commented',
          actorName,
          actorAvatar,
          entityTitle: songResult.rows[0]?.title || 'Untitled',
          createdAt: notifResult.rows[0].created_at,
        });
      }
    } catch (err) {
      console.error('Failed to notify song owner for comment:', err);
    }

    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id/comments/:commentId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const commentResult = await query(
      "SELECT * FROM song_comments WHERE id = $1",
      [req.params.commentId],
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const comment = commentResult.rows[0];
    const songResult = await query(
      "SELECT user_id FROM shared_songs WHERE id = $1",
      [comment.song_id],
    );
    const isAuthor = songResult.rows[0]?.user_id === req.userId;

    if (comment.user_id !== req.userId && !isAuthor) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await query("DELETE FROM song_comments WHERE id = $1", [req.params.commentId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;