'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Send, ArrowLeft, Disc, MessageCircle, Plus, X, CornerDownRight, Edit3, Trash2, Copy, Forward, Reply, Paperclip, File, ChevronLeft, ChevronRight, Download, Shield, Flag, MoreVertical } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';
import { Conversation, ChatMessage } from './types';
import ReportModal from '@/components/ui/ReportModal';

export default function ChatPage() {
  const { user, recentlyDeleted, recentlyEdited } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isLoadingConv, setIsLoadingConv] = useState(true);
  const [isLoadingMsg, setIsLoadingMsg] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messagePage, setMessagePage] = useState(1);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [connections, setConnections] = useState<{ id: string; other_user: { id: string; display_name: string; avatar_url?: string } }[]>([]);
  const [showNewConv, setShowNewConv] = useState(false);

  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardConnections, setForwardConnections] = useState<{ id: string; other_user: { id: string; display_name: string; avatar_url?: string } }[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: ChatMessage } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'user' | 'message'; id: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef<number>(0);
  const newConvRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const activeConversation = conversations.find(c => c.user.id === activeUserId);
  const activeContact = activeConversation
    ? activeConversation.user
    : connections.find(c => c.other_user.id === activeUserId)?.other_user;

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/messages/conversations/list');
      setConversations(res.data.conversations);
      const userId = searchParams.get('user');
      if (userId) {
        setActiveUserId(userId);
        setShowMobileChat(true);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingConv(false);
    }
  }, [searchParams]);

  const fetchMessages = useCallback(async (otherUserId: string, page = 1, prepend = false) => {
    if (prepend) setIsLoadingOlder(true);
    else setIsLoadingMsg(true);
    try {
      const res = await api.get(`/messages/${otherUserId}?page=${page}&limit=50`);
      const msgs = res.data.messages as ChatMessage[];
      setMessages(prev => prepend ? [...msgs, ...prev] : msgs);
      setHasMoreMessages(res.data.hasMore ?? false);
      setMessagePage(page);
    } catch {
      showToast('Failed to load messages', 'error');
    } finally {
      setIsLoadingMsg(false);
      setIsLoadingOlder(false);
    }
  }, [showToast]);

  const markAsRead = useCallback(async (otherUserId: string) => {
    try {
      await api.put('/messages/read', { senderId: otherUserId });
      window.dispatchEvent(new Event('messages-read'));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    api.get('/connections').then(r => {
      setConnections(r.data.connections);
      setForwardConnections(r.data.connections);
    }).catch(() => {});
    api.get('/blocks').then(r => {
      setBlockedIds(new Set(r.data.blockedIds));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;
    const currentUserId = user.id;

    const handleReceiveMessage = (data: { senderId: string; content: string; timestamp: string }) => {
      if (data.senderId === activeUserId) {
        setMessages(prev => [...prev, {
          id: `sock-${Date.now()}`,
          sender_id: data.senderId,
          receiver_id: currentUserId,
          content: data.content,
          read: false,
          created_at: data.timestamp,
        }]);
      }

      setConversations(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(c => c.user.id === data.senderId);
        if (idx >= 0) {
          const conv = { ...updated[idx], lastMessage: data.content, lastMessageAt: data.timestamp };
          if (data.senderId !== activeUserId) {
            conv.unreadCount = (conv.unreadCount || 0) + 1;
          }
          updated.splice(idx, 1);
          updated.unshift(conv);
        } else {
          fetchConversations();
        }
        return updated;
      });
    };

    const handleMessageEdited = (data: { messageId: string; content: string; editedAt: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId ? { ...m, content: data.content, edited_at: data.editedAt } : m
      ));
    };

    const handleMessageDeleted = (data: { messageId: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId ? { ...m, deleted_at: new Date().toISOString() } : m
      ));
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('user_online', ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => new Set(prev).add(userId));
    });
    socket.on('user_offline', ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => { const n = new Set(prev); n.delete(userId); return n; });
    });
    socket.on('user_typing', ({ userId }: { userId: string }) => {
      if (userId === activeUserId) setTypingUserId(userId);
    });
    socket.on('user_typing_stop', ({ userId }: { userId: string }) => {
      if (userId === activeUserId) setTypingUserId(null);
    });

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('user_typing');
      socket.off('user_typing_stop');
    };
  }, [activeUserId, user, fetchConversations]);

  useEffect(() => {
    if (recentlyDeleted.length > 0) {
      setMessages(prev => {
        let changed = false;
        const updated = prev.map(m => {
          if (recentlyDeleted.includes(m.id) && !m.deleted_at) {
            changed = true;
            return { ...m, deleted_at: new Date().toISOString() };
          }
          return m;
        });
        return changed ? updated : prev;
      });
    }
  }, [recentlyDeleted]);

  useEffect(() => {
    if (recentlyEdited.length > 0) {
      const latest = recentlyEdited[recentlyEdited.length - 1];
      setMessages(prev => {
        const exists = prev.some(m => m.id === latest.messageId);
        if (!exists) return prev;
        return prev.map(m =>
          m.id === latest.messageId ? { ...m, content: latest.content, edited_at: latest.editedAt } : m
        );
      });
    }
  }, [recentlyEdited]);

  useEffect(() => {
    if (activeUserId) {
      fetchMessages(activeUserId);
      markAsRead(activeUserId);
      setConversations(prev => prev.map(c =>
        c.user.id === activeUserId ? { ...c, unreadCount: 0 } : c
      ));
    }
  }, [activeUserId, fetchMessages, markAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (newConvRef.current && !newConvRef.current.contains(e.target as Node)) {
        setShowNewConv(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (showChatMenu && !((e.target as HTMLElement).closest('[data-chat-menu]'))) {
        setShowChatMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showChatMenu]);

  const handleSelectConversation = (otherUserId: string) => {
    setActiveUserId(otherUserId);
    setShowMobileChat(true);
    setShowNewConv(false);
    setReplyingTo(null);
    setEditingMessageId(null);
    setContextMenu(null);
  };

  const handleSelectNewContact = (otherUserId: string) => {
    setActiveUserId(otherUserId);
    setShowMobileChat(true);
    setShowNewConv(false);
    setMessages([]);
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
    setReplyingTo(null);
    setEditingMessageId(null);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !activeUserId) return;
    const content = inputValue.trim();
    const replyToId = replyingTo?.id;
    setInputValue('');
    setReplyingTo(null);

    const socket = getSocket();

    try {
      const res = await api.post('/messages', { receiverId: activeUserId, content, replyToId });
      const newMsg: ChatMessage = res.data.message;
      setMessages(prev => [...prev, { ...newMsg, reply_to_preview: replyingTo?.content?.substring(0, 100), reply_to_sender_id: replyingTo?.sender_id }]);

      setConversations(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(c => c.user.id === activeUserId);
        if (idx >= 0) {
          const conv = { ...updated[idx], lastMessage: content, lastMessageAt: newMsg.created_at };
          updated.splice(idx, 1);
          updated.unshift(conv);
        }
        return updated;
      });
    } catch {
      showToast('Failed to send message', 'error');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUserId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { url, type, name, publicId } = uploadRes.data;

      await api.post('/messages', {
        receiverId: activeUserId,
        content: '',
        attachmentUrl: url,
        attachmentType: type,
        attachmentName: name,
        attachmentPublicId: publicId,
      });
    } catch {
      showToast('Failed to upload file', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingMessageId) {
        handleSaveEdit();
      } else {
        handleSend();
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (editingMessageId) return;
    const socket = getSocket();
    if (!socket || !activeUserId) return;

    if (!user) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2000) {
      socket.emit('typing', { senderId: user.id, receiverId: activeUserId });
      lastTypingEmitRef.current = now;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { senderId: user.id, receiverId: activeUserId });
    }, 2000);
  };

  const handleContextMenu = (e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, message: msg });
  };

  const handleCopy = async (content: string) => {
    try { await navigator.clipboard.writeText(content); } catch { /* ignore */ }
    setContextMenu(null);
  };

  const scrollToMessage = (msgId: string) => {
    const el = messageRefs.current.get(msgId);
    if (el) {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
      el.classList.remove('msg-highlight');
      void el.offsetWidth;
      el.classList.add('msg-highlight');
      setTimeout(() => el.classList.remove('msg-highlight'), 1500);
    }
    setContextMenu(null);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && imagePreviewUrl) setImagePreviewUrl(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [imagePreviewUrl]);

  const handleReply = (msg: ChatMessage) => {
    setReplyingTo(msg);
    setEditingMessageId(null);
    setContextMenu(null);
  };

  const cancelReply = () => setReplyingTo(null);

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
    setReplyingTo(null);
    setContextMenu(null);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editContent.trim()) return;
    try {
      await api.put(`/messages/${editingMessageId}/edit`, { content: editContent.trim() });
      setEditingMessageId(null);
      setEditContent('');
    } catch {
      showToast('Failed to edit message', 'error');
    }
  };

  const handleDelete = async (msg: ChatMessage, scope: 'me' | 'everyone') => {
    try {
      await api.delete(`/messages/${msg.id}?scope=${scope}`);
      if (scope === 'me') {
        setMessages(prev => prev.filter(m => m.id !== msg.id));
      } else {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, deleted_at: new Date().toISOString() } : m));
      }
      setContextMenu(null);
    } catch {
      showToast('Failed to delete message', 'error');
    }
  };

  const isChatBlocked = activeUserId ? blockedIds.has(activeUserId) : false;

  const handleBlockUser = async () => {
    if (!activeUserId) return;
    setShowBlockConfirm(false);
    try {
      await api.post('/blocks', { blockedUserId: activeUserId });
      setBlockedIds(prev => new Set([...Array.from(prev), activeUserId]));
      setConversations(prev => prev.filter(c => c.user.id !== activeUserId));
      setActiveUserId(null);
      setShowMobileChat(false);
    } catch {
      showToast('Failed to block user', 'error');
    }
  };

  const handleUnblockUser = async () => {
    if (!activeUserId) return;
    setShowBlockConfirm(false);
    try {
      await api.delete(`/blocks/${activeUserId}`);
      setBlockedIds(prev => { const n = new Set(prev); n.delete(activeUserId); return n; });
      fetchConversations();
    } catch {
      showToast('Failed to unblock user', 'error');
    }
  };

  const openReport = (type: 'user' | 'message', id: string) => {
    setReportTarget({ type, id });
    setShowReport(true);
    setContextMenu(null);
    setShowChatMenu(false);
  };

  const handleStartForward = (msg: ChatMessage) => {
    setForwardMsg(msg);
    setShowForwardModal(true);
    setContextMenu(null);
  };

  const handleForwardSelect = async (receiverId: string) => {
    if (!forwardMsg) return;
    try {
      const res = await api.post('/messages/forward', { messageId: forwardMsg.id, receiverId });
      const newMsg = res.data.message;

      const socket = getSocket();
      if (socket) {
        socket.emit('send_message', {
          senderId: user!.id,
          receiverId,
          content: newMsg.content,
        });
      }

      setConversations(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(c => c.user.id === receiverId);
        if (idx >= 0) {
          const conv = { ...updated[idx], lastMessage: newMsg.content, lastMessageAt: newMsg.created_at };
          updated.splice(idx, 1);
          updated.unshift(conv);
        }
        return updated;
      });

      setShowForwardModal(false);
      setForwardMsg(null);
    } catch {
      showToast('Failed to forward message', 'error');
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isOnline = (userId: string) => onlineUsers.has(userId);
  const isOwnChat = (otherUserId: string | null) => !!otherUserId && otherUserId === user?.id;
  const conversationUserIds = new Set(conversations.map(c => c.user.id));
  const availableContacts = connections.filter(c => !conversationUserIds.has(c.other_user.id));

  if (!user) return null;

  return (
    <main className="h-[calc(98vh-65px)] bg-background overflow-hidden">
      <div className="flex h-full max-w-6xl mx-auto border-l border-r border-border overflow-hidden">
        {/* Conversation List */}
        <div className={`border-r border-border bg-white flex flex-col h-full overflow-hidden transition-all duration-300 ${
          showMobileChat ? 'hidden md:flex' : 'flex'
        } ${sidebarCollapsed ? 'w-0 md:w-0 md:border-r-0' : 'w-full md:w-[360px] lg:w-[380px]'}`}>
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-heading font-bold text-base">Messages</h2>
            {connections.length > 0 && (
              <div className="relative" ref={newConvRef}>
                <button
                  onClick={() => setShowNewConv(!showNewConv)}
                  className="p-1.5 text-text-secondary hover:text-accent-action hover:bg-accent-action/10 transition-colors"
                >
                  <Plus size={18} />
                </button>
                {showNewConv && (
                  <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-border shadow-lg z-10">
                    <div className="px-4 py-2.5 border-b border-border">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-text-secondary font-semibold">New Conversation</p>
                    </div>
                    {availableContacts.length === 0 ? (
                      <div className="px-4 py-5 text-center">
                        <p className="text-text-secondary text-xs font-mono">No new contacts available</p>
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto">
                        {availableContacts.map(c => (
                          <button
                            key={c.other_user.id}
                            onClick={() => handleSelectNewContact(c.other_user.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background transition-colors text-left border-b border-border last:border-b-0"
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden border border-border bg-surface flex-shrink-0">
                              {c.other_user.avatar_url ? (
                                <Image src={c.other_user.avatar_url} alt={c.other_user.display_name} width={32} height={32} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-text-secondary">
                                  <Disc size={14} />
                                </div>
                              )}
                            </div>
                            <span className="text-sm font-heading font-bold truncate">{c.other_user.display_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {conversations.length === 0 && !isLoadingConv ? (
            <div className="flex flex-col items-center justify-center py-20 px-5 text-center">
              <MessageCircle size={36} className="text-text-secondary/30 mb-3" />
              <p className="text-text-secondary text-xs font-mono mb-4">No conversations yet</p>
              <Link href="/discover" className="btn-primary text-xs !px-5 !py-2.5 !min-h-[36px]">
                Find collaborators
              </Link>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {conversations.map(conv => (
                <button
                  key={conv.user.id}
                  onClick={() => handleSelectConversation(conv.user.id)}
                  className={`w-full flex items-start gap-3 px-5 py-4 border-b border-border text-left transition-colors hover:bg-background ${
                    activeUserId === conv.user.id ? 'bg-accent-action/5 border-l-2 border-l-accent-action' : ''
                  }`}
                >
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border border-border bg-surface flex-shrink-0">
                    {conv.user.avatar_url ? (
                      <Image src={conv.user.avatar_url} alt={conv.user.display_name} width={40} height={40} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-secondary">
                        <Disc size={18} />
                      </div>
                    )}
                    {isOnline(conv.user.id) && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-heading font-bold text-sm truncate">{conv.user.display_name}</span>
                      <span className="text-[10px] font-mono text-text-secondary flex-shrink-0">{formatTime(conv.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-text-secondary truncate">{conv.lastMessage}</span>
                      {conv.unreadCount > 0 && (
                        <span className="w-5 h-5 flex items-center justify-center bg-accent-action text-white text-[10px] font-mono font-bold flex-shrink-0">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat Window */}
        <div className={`flex-1 flex flex-col bg-white h-full ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}>
          {!activeUserId || !activeContact ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-5">
              <MessageCircle size={48} className="text-text-secondary/20 mb-4" />
              <p className="text-text-secondary text-sm font-mono">Select a conversation to start chatting</p>
              {sidebarCollapsed && (
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  className="hidden md:flex items-center gap-2 mt-4 text-xs font-mono text-text-secondary hover:text-accent-action transition-colors"
                >
                  <ChevronRight size={14} />
                  Show sidebar
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
                <button onClick={handleBackToList} className="md:hidden p-1 text-text-secondary hover:text-text-primary">
                  <ArrowLeft size={20} />
                </button>
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden md:block p-1 text-text-secondary hover:text-accent-action transition-colors"
                  title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                >
                  {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-border bg-surface flex-shrink-0">
                  {activeContact.avatar_url ? (
                    <Image src={activeContact.avatar_url} alt={activeContact.display_name} width={36} height={36} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-secondary">
                      <Disc size={16} />
                    </div>
                  )}
                  {isOnline(activeUserId) && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm">{activeContact.display_name}</h3>
                  <p className="text-[10px] font-mono text-text-secondary">
                    {isOnline(activeUserId) ? 'Online' : 'Offline'}
                  </p>
                </div>
                {!isOwnChat(activeUserId) && (
                  <div className="relative ml-auto" data-chat-menu>
                    <button
                      onClick={() => setShowChatMenu((v) => !v)}
                      className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-background transition-colors rounded-md"
                      title="More options"
                    >
                      <MoreVertical size={18} />
                    </button>
                    {showChatMenu && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-border shadow-lg z-20 py-1">
                        <button
                          onClick={() => openReport('user', activeUserId!)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-mono text-text-primary hover:bg-background transition-colors text-left"
                        >
                          <Flag size={14} className="text-red-400" />
                          Report user
                        </button>
                        <button
                          onClick={() => { setShowChatMenu(false); setShowBlockConfirm(true); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-mono text-text-primary hover:bg-background transition-colors text-left"
                        >
                          <Shield size={14} className={isChatBlocked ? 'text-accent-success' : 'text-text-secondary'} />
                          {isChatBlocked ? 'Unblock user' : 'Block user'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" onContextMenu={(e) => e.preventDefault()}>
                {isLoadingMsg ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="flex items-end gap-[3px] h-6 mb-3">
                      {[0.4, 0.7, 1, 0.6, 0.8].map((h, i) => (
                        <div
                          key={i}
                          className="w-[2px] bg-accent-action animate-pulse"
                          style={{ height: `${h * 20}px`, animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <p className="text-text-secondary text-xs font-mono">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-text-secondary text-xs font-mono">Start a conversation</p>
                  </div>
                ) : (
                  <>
                    {hasMoreMessages && (
                      <div className="text-center pb-2">
                        <button
                          onClick={() => activeUserId && fetchMessages(activeUserId, messagePage + 1, true)}
                          disabled={isLoadingOlder}
                          className="text-[10px] font-mono text-accent-action hover:underline disabled:opacity-50"
                        >
                          {isLoadingOlder ? 'Loading...' : 'Load older messages'}
                        </button>
                      </div>
                    )}
                  {messages.map((msg, i) => {
                    const isMine = msg.sender_id === user.id;
                    const isDeleted = !!msg.deleted_at;
                    const isEditing = editingMessageId === msg.id;
                    const showReplyPreview = msg.reply_to_id && msg.reply_to_preview;
                    const isForwarded = !!msg.forwarded_from_id;

                    return (
                      <div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        ref={(el) => { if (el) messageRefs.current.set(msg.id, el); else messageRefs.current.delete(msg.id); }}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                        onContextMenu={(e) => {
                          if (!isEditing) handleContextMenu(e, msg);
                        }}
                      >
                        <div className={`max-w-[75%] ${isEditing ? 'w-full' : ''}`}>
                          {isDeleted ? (
                            <div className={`px-4 py-2.5 text-sm italic text-text-secondary/50 ${isMine ? 'text-right' : 'text-left'}`}>
                              This message was deleted
                              <div className={`flex items-center gap-2 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-[10px] font-mono text-text-secondary">{formatTime(msg.created_at)}</span>
                              </div>
                            </div>
                          ) : isEditing ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="input-field resize-none text-sm py-3"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <button onClick={cancelEdit} className="btn-secondary !px-4 !min-h-[36px] !text-[10px]">
                                  Cancel
                                </button>
                                <button onClick={handleSaveEdit} className="btn-primary !px-4 !min-h-[36px] !text-[10px]">
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {isForwarded && (
                                <div className={`text-[10px] font-mono text-text-secondary mb-1 flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                  <Forward size={10} />
                                  Forwarded
                                </div>
                              )}
                              {showReplyPreview && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); if (msg.reply_to_id) scrollToMessage(msg.reply_to_id); }}
                                  className={`mb-1 text-[10px] font-mono text-text-secondary flex items-center gap-1 hover:text-accent-action transition-colors cursor-pointer ${isMine ? 'justify-end' : 'justify-start'}`}
                                >
                                  <CornerDownRight size={10} />
                                  Replied to {msg.reply_to_sender_id === user.id ? 'yourself' : activeContact?.display_name || 'a message'}
                                </button>
                              )}
                              <div className={`px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                                isMine
                                  ? 'bg-accent-action text-white'
                                  : 'bg-background border border-border text-text-primary'
                              } ${showReplyPreview ? (isMine ? 'border-l-[3px] border-l-white/40' : 'border-l-[3px] border-l-accent-action/40') : ''}`}>
                                {showReplyPreview && (
                                  <div className={`text-[11px] mb-1.5 pb-1.5 border-b ${isMine ? 'border-white/20' : 'border-border'} truncate italic`}>
                                    {msg.reply_to_preview}
                                  </div>
                                )}
                                {msg.content}
                                {msg.attachment_url && (
                                  <div className="mt-2">
                                    {msg.attachment_type?.startsWith('image/') ? (
                                      <button onClick={() => setImagePreviewUrl(msg.attachment_url!)} className="block cursor-pointer">
                                        <Image src={msg.attachment_url} alt={msg.attachment_name || 'Image'} width={300} height={300} className="max-w-full h-auto border border-white/10 hover:opacity-90 transition-opacity" style={{ objectFit: 'contain', maxHeight: 300 }} />
                                      </button>
                                    ) : msg.attachment_type?.startsWith('audio/') ? (
                                      <div>
                                        <audio controls className="max-w-full h-10">
                                          <source src={msg.attachment_url} type={msg.attachment_type} />
                                        </audio>
                                        <a href={msg.attachment_url} download={msg.attachment_name || 'audio'} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-1 text-[10px] font-mono mt-1 hover:underline ${isMine ? 'text-white/70' : 'text-accent-action/70'}`}>
                                          <Download size={10} />
                                          {msg.attachment_name || 'Download'}
                                        </a>
                                      </div>
                                    ) : (
                                      <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 text-xs underline ${isMine ? 'text-white/80' : 'text-accent-action'}`}>
                                        <File size={14} />
                                        {msg.attachment_name || 'File'}
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className={`flex items-center gap-2 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-[10px] font-mono text-text-secondary">{formatTime(msg.created_at)}</span>
                                {msg.edited_at && <span className="text-[10px] font-mono text-text-secondary">(edited)</span>}
                                {isMine && (
                                  <span className={`text-[10px] ${msg.read ? 'text-accent-action' : 'text-text-secondary'}`}>
                                    {msg.read ? 'Read' : 'Sent'}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </>
                )}

                {typingUserId === activeUserId && (
                  <div className="flex items-center gap-2 text-text-secondary text-xs font-mono">
                    <div className="flex items-end gap-[2px] h-4">
                      {[0.3, 0.6, 0.9].map((h, i) => (
                        <div key={i} className="w-[2px] bg-accent-action animate-bounce" style={{ height: `${h * 12}px`, animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                    typing...
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Reply Preview */}
              {replyingTo && (
                <div className="px-5 py-2 border-t border-border bg-background/50 flex items-center gap-3">
                  <CornerDownRight size={14} className="text-accent-action flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono text-accent-action font-semibold">Replying to {replyingTo.sender_id === user.id ? 'yourself' : activeContact?.display_name}</p>
                    <p className="text-xs text-text-secondary truncate">{replyingTo.content}</p>
                  </div>
                  <button onClick={cancelReply} className="p-1 text-text-secondary hover:text-text-primary">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="px-5 py-3 border-t border-border">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,audio/*,application/pdf"
                  className="hidden"
                  disabled={uploading}
                />
                <div className="flex gap-3">
                  <textarea
                    value={editingMessageId ? editContent : inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={editingMessageId ? 'Edit message...' : 'Type a message...'}
                    rows={1}
                    className="flex-1 input-field resize-none !min-h-[44px] text-sm py-3"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || !!editingMessageId}
                    className={`btn-secondary !px-3 !min-h-[44px] disabled:opacity-40 ${uploading ? 'animate-pulse' : ''}`}
                    title="Attach file"
                  >
                    <Paperclip size={18} />
                  </button>
                  <button
                    onClick={editingMessageId ? handleSaveEdit : handleSend}
                    disabled={Boolean((!inputValue.trim() && !editingMessageId) || (editingMessageId && !editContent.trim()))}
                    className="btn-primary !px-4 !min-h-[44px] disabled:opacity-40"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[200] bg-white border border-border shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button onClick={() => handleCopy(contextMenu.message.content)} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono text-text-primary hover:bg-background transition-colors text-left">
            <Copy size={14} />
            Copy
          </button>
          <button onClick={() => handleReply(contextMenu.message)} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono text-text-primary hover:bg-background transition-colors text-left">
            <Reply size={14} />
            Reply
          </button>
          {contextMenu.message.sender_id === user.id && (
            <button onClick={() => handleStartEdit(contextMenu.message)} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono text-text-primary hover:bg-background transition-colors text-left">
              <Edit3 size={14} />
              Edit
            </button>
          )}
          <button onClick={() => handleStartForward(contextMenu.message)} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono text-text-primary hover:bg-background transition-colors text-left">
             <Forward size={14} />
             Forward
           </button>
           {contextMenu.message.sender_id !== user.id && (
             <button onClick={() => openReport('message', contextMenu.message.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono text-text-primary hover:bg-background transition-colors text-left">
               <Flag size={14} className="text-red-400" />
               Report message
             </button>
           )}
          <div className="border-t border-border my-1" />
          {contextMenu.message.sender_id === user.id ? (
            <>
              <button onClick={() => handleDelete(contextMenu.message, 'me')} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono text-red-400 hover:bg-red-50 transition-colors text-left">
                <Trash2 size={14} />
                Delete for me
              </button>
              <button onClick={() => handleDelete(contextMenu.message, 'everyone')} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono text-red-500 hover:bg-red-50 transition-colors text-left">
                <Trash2 size={14} />
                Delete for everyone
              </button>
            </>
          ) : (
            <button onClick={() => handleDelete(contextMenu.message, 'me')} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono text-red-400 hover:bg-red-50 transition-colors text-left">
              <Trash2 size={14} />
              Delete for me
            </button>
          )}
        </div>
      )}

      {/* Forward Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center">
          <div className="bg-white border border-border w-full max-w-sm mx-4">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm">Forward Message</h3>
              <button onClick={() => { setShowForwardModal(false); setForwardMsg(null); }} className="p-1 text-text-secondary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>
            {forwardConnections.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-text-secondary text-xs font-mono">No Locos to forward to</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {forwardConnections.map(c => (
                  <button
                    key={c.other_user.id}
                    onClick={() => handleForwardSelect(c.other_user.id)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-background transition-colors text-left border-b border-border last:border-b-0"
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden border border-border bg-surface flex-shrink-0">
                      {c.other_user.avatar_url ? (
                        <Image src={c.other_user.avatar_url} alt={c.other_user.display_name} width={36} height={36} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-secondary">
                          <Disc size={16} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-heading font-bold text-sm">{c.other_user.display_name}</p>
                      <p className="text-[10px] font-mono text-text-secondary">Loco</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {imagePreviewUrl && (
        <div className="fixed inset-0 z-[250] bg-black/80 flex items-center justify-center" onClick={() => setImagePreviewUrl(null)}>
          <button onClick={() => setImagePreviewUrl(null)} className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10">
            <X size={24} />
          </button>
          <img src={imagePreviewUrl} alt="Preview" className="max-w-[90vw] max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Block Confirm Modal */}
      {showBlockConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center">
          <div className="bg-white border border-border w-full max-w-sm mx-4 p-6">
            <h3 className="font-heading font-bold text-sm sm:text-base mb-2">
              {isChatBlocked ? 'Unblock user?' : 'Block user?'}
            </h3>
            <p className="text-text-secondary text-xs sm:text-sm mb-5 leading-relaxed">
              {isChatBlocked
                ? `Unblock ${activeContact?.display_name}? You will be able to message them and see their profile again.`
                : `Block ${activeContact?.display_name}? They will no longer be able to message you or see your profile, and your connection will be removed.`}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowBlockConfirm(false)} className="btn-secondary !px-4 !min-h-[38px] !text-[11px]">
                Cancel
              </button>
              <button
                onClick={isChatBlocked ? handleUnblockUser : handleBlockUser}
                className="btn-primary !px-4 !min-h-[38px] !text-[11px] !bg-red-500 !border-red-500 hover:!bg-red-600"
              >
                {isChatBlocked ? 'Unblock' : 'Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReport && reportTarget && (
        <ReportModal
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          onClose={() => setShowReport(false)}
        />
      )}
    </main>
  );
}
