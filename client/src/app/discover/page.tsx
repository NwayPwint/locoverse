'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, UserPlus, X, Music, Send, MessageCircle, Sliders, Disc, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { User, Skill, Vibe } from '@/types';

const lookingForOptions = [
  { value: 'band_members', label: 'Band Members' },
  { value: 'jam_partner', label: 'Jam Partner' },
  { value: 'feedback_buddy', label: 'Feedback Buddy' },
  { value: 'exploring', label: 'Just Exploring' },
];

const lookingForLabels: Record<string, string> = {
  band_members: 'Band Members',
  jam_partner: 'Jam Partner',
  feedback_buddy: 'Feedback Buddy',
  exploring: 'Just Exploring',
};

const categoryOrder = ['instrument', 'vocal', 'production', 'theory'] as const;
const categoryLabels: Record<string, string> = {
  instrument: 'Instruments',
  vocal: 'Vocals',
  production: 'Production',
  theory: 'Theory',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function groupSkillsByCategory(skills: Skill[]) {
  const groups: Record<string, Skill[]> = {};
  for (const s of skills) {
    const cat = s.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  }
  return groups;
}

function mapUser(u: { id: string; email?: string; display_name: string; avatar_url?: string; bio?: string; skills?: Skill[]; vibes?: Vibe[]; looking_for?: string; song_count?: number; post_count?: number; created_at: string }): User {
  return {
    id: u.id,
    email: u.email || '',
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    bio: u.bio,
    lookingFor: u.looking_for as User['lookingFor'],
    skills: u.skills || [],
    vibes: u.vibes || [],
    createdAt: u.created_at,
    songCount: u.song_count,
    postCount: u.post_count,
  };
}

export default function DiscoverPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [allVibes, setAllVibes] = useState<Vibe[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [selectedLookingFor, setSelectedLookingFor] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sentRequests, setSentRequests] = useState<Record<string, string>>({});
  const [incomingRequests, setIncomingRequests] = useState<Record<string, string>>({});
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async (pageNum: number, append = false) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(pageNum));
      params.append('limit', '20');
      if (search) params.append('search', search);
      if (selectedLookingFor) params.append('looking_for', selectedLookingFor);
      selectedSkills.forEach(s => params.append('skills[]', s));
      selectedVibes.forEach(v => params.append('vibes[]', v));

      const res = await api.get(`/users?${params.toString()}`);
      const mapped = res.data.users.map(mapUser);
      setUsers(prev => append ? [...prev, ...mapped] : mapped);
      setHasMore(res.data.hasMore ?? false);
      setPage(pageNum);
    } catch {
      showToast('Failed to load creators', 'error');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [search, selectedSkills, selectedVibes, selectedLookingFor, showToast]);

  useEffect(() => {
    api.get('/skills').then(r => setAllSkills(r.data.skills)).catch(() => {});
    api.get('/vibes').then(r => setAllVibes(r.data.vibes)).catch(() => {});
  }, []);

  useEffect(() => { fetchUsers(1, false); }, [fetchUsers]);

  useEffect(() => {
    if (!user) return;
    api.get('/connections')
      .then(r => {
        const conns = r.data.connections as { other_user?: { id: string } }[] | undefined;
        const ids = (conns || []).map(c => c.other_user?.id).filter(Boolean) as string[];
        setConnectedIds(new Set(ids));
      })
      .catch(() => {});

    Promise.all([
      api.get('/connections/sent'),
      api.get('/connections/requests'),
    ]).then(([sentRes, reqRes]) => {
      const sentMap: Record<string, string> = {};
      (sentRes.data.sent || []).forEach((c: { receiver_id: string; id: string }) => {
        if (c.receiver_id) sentMap[c.receiver_id] = c.id;
      });
      setSentRequests(sentMap);

      const incoming: Record<string, string> = {};
      (reqRes.data.requests || []).forEach((r: { requester_id: string; id: string }) => {
        incoming[r.requester_id] = r.id;
      });
      setIncomingRequests(incoming);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleAccepted = (data: { requesterId: string; receiverId: string; connectionId: string }) => {
      setConnectedIds(prev => new Set([...Array.from(prev), data.requesterId, data.receiverId]));
      setSentRequests(prev => { const n = { ...prev }; delete n[data.receiverId]; return n; });
      setIncomingRequests(prev => { const n = { ...prev }; delete n[data.requesterId]; return n; });
    };
    const handleRejected = (data: { requesterId: string; receiverId: string; connectionId: string }) => {
      setSentRequests(prev => { const n = { ...prev }; delete n[data.receiverId]; return n; });
      setIncomingRequests(prev => { const n = { ...prev }; delete n[data.requesterId]; return n; });
    };
    const handleRemoved = (data: { otherUserId: string }) => {
      setConnectedIds(prev => { const n = new Set(prev); n.delete(data.otherUserId); return n; });
    };
    socket.on('connection_accepted', handleAccepted);
    socket.on('request_rejected', handleRejected);
    socket.on('connection_removed', handleRemoved);
    return () => {
      socket.off('connection_accepted', handleAccepted);
      socket.off('request_rejected', handleRejected);
      socket.off('connection_removed', handleRemoved);
    };
  }, []);

  const handleSendRequest = async (userId: string) => {
    try {
      const res = await api.post('/connections', { receiverId: userId });
      setSentRequests(prev => ({ ...prev, [userId]: res.data.connection.id }));
      showToast('Loco request sent', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast(msg || 'Failed to send request', 'error');
    }
  };

  const handleCancelRequest = async (userId: string) => {
    const connectionId = sentRequests[userId];
    if (!connectionId) return;
    try {
      await api.delete(`/connections/${connectionId}`);
      setSentRequests(prev => { const n = { ...prev }; delete n[userId]; return n; });
    } catch { /* ignore */ }
  };

  const handleAcceptRequest = async (userId: string) => {
    const requestId = incomingRequests[userId];
    if (!requestId) return;
    try {
      await api.put(`/connections/${requestId}/accept`);
      setConnectedIds(prev => new Set([...Array.from(prev), userId]));
      setIncomingRequests(prev => { const n = { ...prev }; delete n[userId]; return n; });
    } catch { /* ignore */ }
  };

  const handleRejectRequest = async (userId: string) => {
    const requestId = incomingRequests[userId];
    if (!requestId) return;
    try {
      await api.put(`/connections/${requestId}/reject`);
      setIncomingRequests(prev => { const n = { ...prev }; delete n[userId]; return n; });
    } catch { /* ignore */ }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const toggleVibe = (vibe: string) => {
    setSelectedVibes(prev =>
      prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe]
    );
  };

  const skillsByCategory = useCallback(() => {
    const groups: Record<string, Skill[]> = {};
    for (const s of allSkills) {
      const cat = s.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    }
    return groups;
  }, [allSkills]);

  const clearFilters = () => {
    setSearch('');
    setSelectedSkills([]);
    setSelectedVibes([]);
    setSelectedLookingFor('');
  };

  const hasActiveFilters = search || selectedSkills.length > 0 || selectedVibes.length > 0 || selectedLookingFor;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* Header */}
        <div className="mb-5 md:mb-8">
          <h1 className="text-xl md:text-3xl font-heading font-extrabold mb-1 md:mb-2">Discover</h1>
          <p className="text-text-secondary text-xs md:text-sm">Find music collaborators who match your style</p>
        </div>

        {/* Search + Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 md:mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or bio..."
              className="input-field pl-9 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex-1 sm:flex-none items-center justify-center gap-2 !min-h-[40px] text-xs ${showFilters ? 'bg-accent-action/10 border-accent-action/30 text-accent-action' : ''}`}
            >
              <Sliders size={14} />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-accent-action rounded-full" />
              )}
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn-secondary flex items-center gap-1.5 !min-h-[40px] text-xs">
                <X size={14} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white border border-border p-3 sm:p-5 mb-4 md:mb-6">
            <div className="mb-3 sm:mb-5">
              <label className="block text-[10px] sm:text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary mb-2 sm:mb-3">Skills</label>
              {Object.entries(skillsByCategory()).map(([cat, skills]) => (
                <div key={cat} className="mb-2">
                  <span className="text-[8px] font-mono uppercase tracking-wider text-text-secondary/40">{categoryLabels[cat] || cat}</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {skills.map(skill => (
                      <button
                        key={skill.id}
                        onClick={() => toggleSkill(skill.name)}
                        className={`tag cursor-pointer transition-colors ${
                          selectedSkills.includes(skill.name) ? 'tag-accent' : 'hover:border-accent-action/30'
                        }`}
                      >
                        {skill.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mb-3 sm:mb-5">
              <label className="block text-[10px] sm:text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary mb-2 sm:mb-3">Vibes</label>
              <div className="flex flex-wrap gap-2">
                {allVibes.map(vibe => (
                  <button
                    key={vibe.id}
                    onClick={() => toggleVibe(vibe.name)}
                    className={`tag cursor-pointer transition-colors ${
                      selectedVibes.includes(vibe.name) ? 'tag-accent' : 'hover:border-accent-action/30'
                    }`}
                  >
                    {vibe.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary mb-2 sm:mb-3">Looking For</label>
              <div className="flex flex-wrap gap-2">
                {lookingForOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedLookingFor(selectedLookingFor === opt.value ? '' : opt.value)}
                    className={`tag cursor-pointer transition-colors ${
                      selectedLookingFor === opt.value ? 'tag-accent' : 'hover:border-accent-action/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="flex items-end gap-[3px] h-8">
              {[0.4, 0.7, 1, 0.6, 0.8, 0.5].map((h, i) => (
                <div
                  key={i}
                  className="w-[3px] bg-accent-action origin-bottom animate-wave"
                  style={{ height: `${h * 32}px`, animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-text-secondary text-sm font-mono">Loading...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20">
            <Music size={40} className="mx-auto text-text-secondary/30 mb-4" />
            <p className="text-text-secondary text-sm">No users found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <p className="text-text-secondary text-xs font-mono mb-3 md:mb-4">{users.length} creator{users.length !== 1 ? 's' : ''} found</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
              {users.map(u => {
                const isOwn = user?.id === u.id;
                const isConnected = connectedIds.has(u.id);
                const hasIncoming = incomingRequests[u.id];
                const requestSent = sentRequests[u.id];
                const skillGroups = groupSkillsByCategory(u.skills || []);

                return (
                  <div key={u.id} className="bg-white border border-border p-2.5 sm:p-5 hover:border-accent-action/30 transition-colors flex flex-col">
                    {/* Avatar + Name */}
                    <div className="flex items-start gap-2 sm:gap-4 mb-2 sm:mb-3">
                      <div className="w-9 h-9 sm:w-16 sm:h-16 rounded-full overflow-hidden border border-border flex-shrink-0 bg-surface">
                        {u.avatarUrl ? (
                          <Image src={u.avatarUrl} alt={u.displayName} width={64} height={64} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-secondary">
                            <Disc size={20} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/profile/${u.id}`} className="font-heading font-bold text-sm hover:text-accent-action transition-colors">
                          {u.displayName}
                        </Link>
                        {u.lookingFor && (
                          <p className="text-accent-action text-[10px] font-mono mt-0.5">
                            {lookingForLabels[u.lookingFor] || u.lookingFor.replace('_', ' ')}
                          </p>
                        )}
                        <p className="text-text-secondary/50 text-[9px] font-mono mt-0.5">
                          Joined {formatDate(u.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Song / Post counts */}
                    {(u.songCount || 0) + (u.postCount || 0) > 0 && (
                      <div className="flex items-center gap-3 mb-2 sm:mb-3 text-[10px] font-mono text-text-secondary">
                        {u.songCount ? <span>{u.songCount} song{u.songCount !== 1 ? 's' : ''}</span> : null}
                        {u.postCount ? <span>{u.postCount} post{u.postCount !== 1 ? 's' : ''}</span> : null}
                      </div>
                    )}

                    {/* Bio */}
                    {u.bio && (
                      <p className="text-text-secondary text-xs leading-relaxed mb-2 sm:mb-3 line-clamp-2">{u.bio}</p>
                    )}

                    {/* Skills grouped by category */}
                    {Object.keys(skillGroups).length > 0 && (
                      <div className="mb-2 sm:mb-3 space-y-1 sm:space-y-1.5">
                        {categoryOrder.filter(c => skillGroups[c]).map(cat => (
                          <div key={cat}>
                            <span className="text-[8px] font-mono uppercase tracking-wider text-text-secondary/40">{categoryLabels[cat] || cat}</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {skillGroups[cat].map((s: Skill) => (
                                <span key={s.id} className="tag text-[9px] py-0.5 px-1.5">{s.name}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Vibes */}
                    {u.vibes && u.vibes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3 sm:mb-4">
                        {u.vibes.map((v: Vibe) => (
                          <span key={v.id} className="tag-accent text-[9px] py-0.5 px-1.5">{v.name}</span>
                        ))}
                      </div>
                    )}

                    {/* Action button */}
                    <div className="mt-auto pt-2">
                      {isOwn ? null : isConnected ? (
                        <Link
                          href={`/chat?user=${u.id}`}
                          className="w-full flex items-center justify-center gap-2 py-2 sm:py-2.5 text-[11px] sm:text-xs font-heading font-bold uppercase tracking-[0.15em] bg-accent-success/10 text-accent-success border border-accent-success/20 hover:bg-accent-success/20 transition-all"
                        >
                          <MessageCircle size={14} />
                          Message
                        </Link>
                      ) : hasIncoming ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptRequest(u.id)}
                            className="flex-1 flex items-center justify-center gap-1 py-2 sm:py-2.5 text-[11px] sm:text-xs font-heading font-bold uppercase tracking-[0.15em] bg-accent-success/10 text-accent-success border border-accent-success/20 hover:bg-accent-success/20 transition-all"
                          >
                            <Check size={14} />
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectRequest(u.id)}
                            className="flex-1 flex items-center justify-center gap-1 py-2 sm:py-2.5 text-[11px] sm:text-xs font-heading font-bold uppercase tracking-[0.15em] bg-red-50 text-red-400 border border-red-200 hover:bg-red-100 transition-all"
                          >
                            <X size={14} />
                            Reject
                          </button>
                        </div>
                      ) : requestSent ? (
                        <button
                          onClick={() => handleCancelRequest(u.id)}
                          className="w-full flex items-center justify-center gap-2 py-2 sm:py-2.5 text-[11px] sm:text-xs font-heading font-bold uppercase tracking-[0.15em] bg-text-secondary/10 text-text-secondary border border-text-secondary/20 hover:bg-red-50 hover:text-red-400 hover:border-red-200 transition-all group"
                        >
                          <Send size={14} className="group-hover:hidden" />
                          <X size={14} className="hidden group-hover:block" />
                          <span className="group-hover:hidden">Loco Sent</span>
                          <span className="hidden group-hover:inline">Cancel</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSendRequest(u.id)}
                          className="w-full flex items-center justify-center gap-2 py-2 sm:py-2.5 text-[11px] sm:text-xs font-heading font-bold uppercase tracking-[0.15em] bg-accent-action/10 text-accent-action hover:bg-accent-action/20 border border-accent-action/20 transition-all"
                        >
                          <UserPlus size={14} />
                          Loco
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => fetchUsers(page + 1, true)}
                  disabled={isLoadingMore}
                  className="btn-secondary !px-6 !min-h-[40px] text-xs"
                >
                  {isLoadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
