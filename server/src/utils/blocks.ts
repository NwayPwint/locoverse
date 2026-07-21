import { query } from '../config/database';

export async function isBlocked(userId1: string, userId2: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
    [userId1, userId2],
  );
  return result.rows.length > 0;
}