import { query } from '../config/database';
import { Server } from 'socket.io';

export async function notifyUser(
  io: Server,
  targetUserId: string,
  actorId: string,
  type: string,
  entityType: string,
  entityId: string,
  entityTitle: string,
) {
  const actorResult = await query('SELECT display_name, avatar_url FROM users WHERE id = $1', [actorId]);
  const actorName = actorResult.rows[0]?.display_name || 'Someone';
  const actorAvatar = actorResult.rows[0]?.avatar_url || null;

  const notifResult = await query(
    `INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [targetUserId, actorId, type, entityType, entityId],
  );

  io.to(targetUserId).emit('new_notification', {
    id: notifResult.rows[0].id,
    type,
    actorName,
    actorAvatar,
    entityTitle,
    createdAt: notifResult.rows[0].created_at,
  });
}

export async function getAcceptedConnections(userId: string): Promise<string[]> {
  const result = await query(
    `SELECT CASE WHEN requester_id = $1 THEN receiver_id ELSE requester_id END AS connection_id
     FROM connections
     WHERE (requester_id = $1 OR receiver_id = $1) AND status = 'accepted'`,
    [userId],
  );
  return result.rows.map((r: any) => r.connection_id);
}