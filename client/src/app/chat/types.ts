export interface Conversation {
  user: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
  reply_to_id?: string;
  reply_to_preview?: string;
  reply_to_sender_id?: string;
  edited_at?: string;
  deleted_at?: string;
  forwarded_from_id?: string;
  forwarded_from_preview?: string;
  forwarded_from_sender_id?: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
}
