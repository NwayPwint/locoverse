'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Check, Disc, Music, Pencil, Megaphone, BookOpen, Users, Camera } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { SharedSong, Post, Article } from '@/types';
import PostCard from '@/components/feed/PostCard';
import PostItem from '@/components/feed/PostItem';
import ArticleCard from '@/components/articles/ArticleCard';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import ConfirmModal from '@/components/ui/ConfirmModal';
import SongwritingGuideModal from '@/components/workspace/SongwritingGuideModal';

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

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [lookingFor, setLookingFor] = useState('');

  const [allSkills, setAllSkills] = useState<{ id: number; name: string; category: string }[]>([]);
  const [allVibes, setAllVibes] = useState<{ id: number; name: string }[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const [selectedVibeIds, setSelectedVibeIds] = useState<number[]>([]);

  const [profileSaving, setProfileSaving] = useState(false);
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [vibesSaving, setVibesSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [skillsMsg, setSkillsMsg] = useState('');
  const [vibesMsg, setVibesMsg] = useState('');

  const [showEdit, setShowEdit] = useState(false);
  const [songs, setSongs] = useState<SharedSong[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [profileTab, setProfileTab] = useState<'songs' | 'posts' | 'articles' | 'locos' | 'activity'>('songs');
  const [showSongGuide, setShowSongGuide] = useState(false);
  const [locos, setLocos] = useState<{ id: string; other_user: { id: string; display_name: string; avatar_url: string | null } }[]>([]);
  const [removingLocoId, setRemovingLocoId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [isLoadingProfilePosts, setIsLoadingProfilePosts] = useState(false);
  const [profileArticles, setProfileArticles] = useState<Article[]>([]);
  const [isLoadingProfileArticles, setIsLoadingProfileArticles] = useState(false);
  const [activity, setActivity] = useState<{ type: string; title: string; created_at: string; entity_id: string }[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setLookingFor(user.lookingFor || '');
      setSelectedSkillIds(user.skills?.map((s: { id: number }) => s.id) || []);
      setSelectedVibeIds(user.vibes?.map((v: { id: number }) => v.id) || []);
    }
  }, [user]);

  useEffect(() => {
    api.get('/skills').then((r) => setAllSkills(r.data.skills)).catch(() => {});
    api.get('/vibes').then((r) => setAllVibes(r.data.vibes)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchPosts = async () => {
      setIsLoadingPosts(true);
      try {
        const res = await api.get(`/shared-songs/user/${userId}`);
        setSongs(res.data.sharedSongs);
      } catch {
        // ignore
      } finally {
        setIsLoadingPosts(false);
      }
    };
    fetchPosts();

    api
      .get('/shared-songs/liked')
      .then((r) => setLikedIds(new Set(r.data.likedSongIds)))
      .catch(() => {});

    api
      .get('/connections')
      .then((r) => {
        const conns = r.data.connections || [];
        const ids = conns.map((c: { other_user?: { id: string } }) => c.other_user?.id).filter(Boolean);
        setConnectedIds(new Set(ids));
        setLocos(conns);
      })
      .catch(() => {});

    api
      .get('/posts/liked')
      .then((r) => setLikedPostIds(new Set(r.data.likedPostIds)))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleAccepted = (data: { requesterId: string; receiverId: string }) => {
      setConnectedIds(prev => new Set([...Array.from(prev), data.requesterId, data.receiverId]));
    };
    const handleRemoved = (data: { otherUserId: string }) => {
      setConnectedIds(prev => { const n = new Set(prev); n.delete(data.otherUserId); return n; });
      setLocos(prev => prev.filter(c => c.other_user.id !== data.otherUserId));
    };
    socket.on('connection_accepted', handleAccepted);
    socket.on('connection_removed', handleRemoved);
    return () => {
      socket.off('connection_accepted', handleAccepted);
      socket.off('connection_removed', handleRemoved);
    };
  }, []);

  const fetchProfilePosts = async () => {
    if (!userId) return;
    setIsLoadingProfilePosts(true);
    try {
      const res = await api.get(`/posts/user/${userId}`);
      setProfilePosts(res.data.posts);
    } catch {
      // ignore
    } finally {
      setIsLoadingProfilePosts(false);
    }
  };

  const fetchProfileArticles = async () => {
    if (!userId) return;
    setIsLoadingProfileArticles(true);
    try {
      const res = await api.get(`/articles/user/${userId}`);
      setProfileArticles(res.data.articles);
    } catch {
      // ignore
    } finally {
      setIsLoadingProfileArticles(false);
    }
  };

  const fetchActivity = async () => {
    if (!userId) return;
    setIsLoadingActivity(true);
    try {
      const res = await api.get(`/users/${userId}/activity`);
      setActivity(res.data.activity);
    } catch {
      // ignore
    } finally {
      setIsLoadingActivity(false);
    }
  };

  useEffect(() => {
    if (profileTab === 'posts') fetchProfilePosts();
    if (profileTab === 'articles') fetchProfileArticles();
    if (profileTab === 'activity') fetchActivity();
  }, [profileTab, userId]);

  const saveProfile = async () => {
    setProfileMsg('');
    setProfileSaving(true);
    try {
      const res = await api.put('/users/me', { displayName, bio, lookingFor: lookingFor || null });
      setUser({ ...user!, displayName: res.data.user.display_name, bio: res.data.user.bio, lookingFor: res.data.user.looking_for });
      setProfileMsg('Saved');
      showToast('Profile saved', 'success');
    } catch {
      setProfileMsg('Failed to save');
      showToast('Failed to save profile', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser({ ...user, avatarUrl: res.data.avatarUrl });
      showToast('Avatar updated', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast(msg || 'Avatar upload failed', 'error');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const saveSkills = async () => {
    setSkillsMsg('');
    setSkillsSaving(true);
    try {
      await api.put('/users/me/skills', { skillIds: selectedSkillIds });
      setUser({ ...user!, skills: allSkills.filter((s) => selectedSkillIds.includes(s.id)).map((s) => ({ id: s.id, name: s.name, category: s.category as 'instrument' | 'production' | 'vocal' | 'theory' })) });
      setSkillsMsg('Saved');
    } catch {
      setSkillsMsg('Failed to save');
    } finally {
      setSkillsSaving(false);
    }
  };

  const saveVibes = async () => {
    setVibesMsg('');
    setVibesSaving(true);
    try {
      await api.put('/users/me/vibes', { vibeIds: selectedVibeIds });
      setUser({ ...user!, vibes: allVibes.filter((v) => selectedVibeIds.includes(v.id)).map((v) => ({ id: v.id, name: v.name })) });
      setVibesMsg('Saved');
    } catch {
      setVibesMsg('Failed to save');
    } finally {
      setVibesSaving(false);
    }
  };

  const toggleSkill = (id: number) => {
    setSelectedSkillIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleVibe = (id: number) => {
    setSelectedVibeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (!user) return null;

  const publicCount = songs.filter((s) => s.visibility === 'public').length;
  const connectionCount = songs.length - publicCount;

  return (
    <div className="min-h-screen bg-background">
      <LoadingOverlay />
      {/* Facebook/Instagram style header */}
      <div className="bg-white border-b border-border">
        <div className="h-24 sm:h-32 md:h-44 bg-gradient-to-r from-accent-action/30 via-accent-warm/20 to-purple-400/30" />
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 -mt-10 sm:-mt-14 pb-4 sm:pb-6">
            <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white bg-surface flex-shrink-0 shadow-sm group">
              {user.avatarUrl ? (
                <Image src={user.avatarUrl} alt={user.displayName} width={112} height={112} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-secondary">
                  <Disc size={32} />
                </div>
              )}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                title="Change avatar"
              >
                <Camera size={20} />
              </button>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarUpload} />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-extrabold">{user.displayName}</h1>
              {user.lookingFor && (
                <p className="text-accent-action text-[11px] sm:text-sm font-mono capitalize mt-0.5">
                  {lookingForLabels[user.lookingFor] || user.lookingFor.replace('_', ' ')}
                </p>
              )}
              <div className="flex items-center gap-3 sm:gap-4 mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-mono text-text-secondary">
                <span>{songs.length} posts</span>
                <span>{publicCount} public</span>
                <span>{connectionCount} for Locos</span>
              </div>
            </div>

            <div className="sm:pb-2 flex items-center gap-2">
              <button
                onClick={() => setShowEdit((v) => !v)}
                className="btn-secondary flex items-center gap-2 !px-3 sm:!px-4 !min-h-[34px] sm:!min-h-[38px] !text-[10px] sm:!text-[11px]"
              >
                <Pencil size={13} />
                {showEdit ? 'Close' : 'Edit Profile'}
              </button>
            </div>
          </div>

          {user.bio && (
            <p className="text-xs sm:text-sm text-text-primary pb-4 sm:pb-6 max-w-2xl">{user.bio}</p>
          )}

          {(user.skills?.length > 0 || user.vibes?.length > 0) && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 pb-4 sm:pb-6">
              {user.skills?.map((s: { id: number; name: string }) => (
                <span key={`sk-${s.id}`} className="tag text-[9px] sm:text-[10px] py-0.5 sm:py-1 px-1.5 sm:px-2">{s.name}</span>
              ))}
              {user.vibes?.map((v: { id: number; name: string }) => (
                <span key={`vb-${v.id}`} className="tag-accent text-[9px] sm:text-[10px] py-0.5 sm:py-1 px-1.5 sm:px-2">{v.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10">
        {/* Edit panel */}
        {showEdit && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10">
            <div className="bg-white border border-border p-4 sm:p-6">
              <h3 className="font-heading font-bold text-xs sm:text-sm mb-3 sm:mb-4">Profile Info</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary mb-1.5">Display Name</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary mb-1.5">Bio</label>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="input-field resize-none" rows={3} placeholder="Tell others about yourself..." />
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary mb-1.5">Looking For</label>
                  <div className="flex flex-wrap gap-2">
                    {lookingForOptions.map((opt) => (
                      <button key={opt.value} onClick={() => setLookingFor(lookingFor === opt.value ? '' : opt.value)} className={`tag cursor-pointer transition-colors ${lookingFor === opt.value ? 'tag-accent' : 'hover:border-accent-action/30'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={saveProfile} disabled={profileSaving} className="btn-primary disabled:opacity-50">
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
                {profileMsg && <p className={`text-xs font-mono mt-2 ${profileMsg === 'Saved' ? 'text-accent-action' : 'text-red-500'}`}>{profileMsg}</p>}
              </div>
            </div>

            <div className="bg-white border border-border p-4 sm:p-6">
              <h3 className="font-heading font-bold text-xs sm:text-sm mb-3 sm:mb-4">Skills</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {allSkills.map((skill) => (
                  <button key={skill.id} onClick={() => toggleSkill(skill.id)} className={`tag cursor-pointer transition-colors flex items-center gap-1.5 ${selectedSkillIds.includes(skill.id) ? 'tag-accent' : 'hover:border-accent-action/30'}`}>
                    {selectedSkillIds.includes(skill.id) && <Check size={10} />}
                    {skill.name}
                  </button>
                ))}
              </div>
              <button onClick={saveSkills} disabled={skillsSaving} className="btn-primary disabled:opacity-50">
                {skillsSaving ? 'Saving...' : 'Save Skills'}
              </button>
              {skillsMsg && <p className={`text-xs font-mono mt-2 ${skillsMsg === 'Saved' ? 'text-accent-action' : 'text-red-500'}`}>{skillsMsg}</p>}
            </div>

            <div className="bg-white border border-border p-4 sm:p-6">
              <h3 className="font-heading font-bold text-xs sm:text-sm mb-3 sm:mb-4">Vibes</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {allVibes.map((vibe) => (
                  <button key={vibe.id} onClick={() => toggleVibe(vibe.id)} className={`tag cursor-pointer transition-colors flex items-center gap-1.5 ${selectedVibeIds.includes(vibe.id) ? 'tag-accent' : 'hover:border-accent-action/30'}`}>
                    {selectedVibeIds.includes(vibe.id) && <Check size={10} />}
                    {vibe.name}
                  </button>
                ))}
              </div>
              <button onClick={saveVibes} disabled={vibesSaving} className="btn-primary disabled:opacity-50">
                {vibesSaving ? 'Saving...' : 'Save Vibes'}
              </button>
              {vibesMsg && <p className={`text-xs font-mono mt-2 ${vibesMsg === 'Saved' ? 'text-accent-action' : 'text-red-500'}`}>{vibesMsg}</p>}
            </div>
          </div>
        )}

        {/* Posts */}
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
            <button
              onClick={() => setProfileTab('songs')}
              className={`flex items-center gap-1.5 sm:gap-2 font-heading font-bold text-xs sm:text-sm uppercase tracking-[0.15em] transition-colors ${
                profileTab === 'songs' ? 'text-accent-action' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Music size={14} />
              Songs
            </button>
            <button
              onClick={() => setProfileTab('posts')}
              className={`flex items-center gap-1.5 sm:gap-2 font-heading font-bold text-xs sm:text-sm uppercase tracking-[0.15em] transition-colors ${
                profileTab === 'posts' ? 'text-accent-action' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Megaphone size={14} />
              Posts
            </button>
            <button
              onClick={() => setProfileTab('articles')}
              className={`flex items-center gap-1.5 sm:gap-2 font-heading font-bold text-xs sm:text-sm uppercase tracking-[0.15em] transition-colors ${
                profileTab === 'articles' ? 'text-accent-action' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <BookOpen size={14} />
              Articles
            </button>
            <button
              onClick={() => setProfileTab('activity')}
              className={`flex items-center gap-1.5 sm:gap-2 font-heading font-bold text-xs sm:text-sm uppercase tracking-[0.15em] transition-colors ${
                profileTab === 'activity' ? 'text-accent-action' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Disc size={14} />
              Activity
            </button>
            <button
              onClick={() => setProfileTab('locos')}
              className={`flex items-center gap-1.5 sm:gap-2 font-heading font-bold text-xs sm:text-sm uppercase tracking-[0.15em] transition-colors ${
                profileTab === 'locos' ? 'text-accent-action' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Users size={14} />
              My Locos
            </button>
            <button
              onClick={() => setShowSongGuide(true)}
              className="ml-auto w-6 h-6 rounded-full border border-border text-text-secondary hover:text-text-primary hover:border-text-primary text-xs font-mono font-bold flex items-center justify-center transition-colors"
              title="How to use songwriting tools"
            >
              ?
            </button>
          </div>

          {profileTab === 'locos' ? (
            locos.length === 0 ? (
              <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">
                No Locos yet. Discover people to connect with!
              </div>
            ) : (
              <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {locos.map((loco) => (
                  <div key={loco.id} className="bg-white border border-border p-4 sm:p-5 flex items-center gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-border flex-shrink-0 bg-surface">
                      {loco.other_user.avatar_url ? (
                        <Image src={loco.other_user.avatar_url} alt={loco.other_user.display_name} width={56} height={56} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-secondary">
                          <User size={20} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <a href={`/profile/${loco.other_user.id}`} className="font-heading font-bold text-sm sm:text-base truncate hover:underline hover:text-accent-action transition-colors block">{loco.other_user.display_name}</a>
                      <div className="flex items-center gap-2 mt-2">
                        <a href={`/chat?userId=${loco.other_user.id}`} className="btn-secondary !px-3 !min-h-[30px] !text-[10px]">
                          Message
                        </a>
                        <button
                          onClick={() => setConfirmRemoveId(loco.id)}
                          disabled={removingLocoId === loco.id}
                          className="text-red-500 hover:text-red-600 text-xs font-mono font-semibold hover:underline disabled:opacity-40 transition-colors"
                        >
                          {removingLocoId === loco.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : profileTab === 'activity' ? (
            isLoadingActivity ? (
              <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">Loading activity...</div>
            ) : activity.length === 0 ? (
              <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">
                No activity yet.
              </div>
            ) : (
              <div className="space-y-2">
                {activity.map((a, i) => (
                  <div key={`${a.type}-${a.entity_id}-${i}`} className="bg-white border border-border px-4 sm:px-5 py-3 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      a.type === 'song' ? 'bg-accent-action' : a.type === 'post' ? 'bg-accent-warm' : 'bg-accent-success'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium truncate">{a.title}</p>
                      <p className="text-[10px] font-mono text-text-secondary/50 capitalize">{a.type} · {new Date(a.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : profileTab === 'songs' ? (
            isLoadingPosts ? (
              <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">Loading posts...</div>
            ) : songs.length === 0 ? (
              <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">
                You haven&apos;t shared any songs yet.
              </div>
            ) : (
              <div className="space-y-6">
                {songs.map((song) => (
                  <PostCard
                    key={song.id}
                    song={song}
                    isLiked={likedIds.has(song.id)}
                    connectedIds={connectedIds}
                  />
                ))}
              </div>
            )
          ) : profileTab === 'articles' ? (
            isLoadingProfileArticles ? (
              <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">Loading articles...</div>
            ) : profileArticles.length === 0 ? (
              <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">
                No articles yet.
              </div>
            ) : (
              <div className="space-y-5">
                {profileArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            )
          ) : isLoadingProfilePosts ? (
            <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">Loading posts...</div>
          ) : profilePosts.length === 0 ? (
            <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">
              No community posts yet.
            </div>
          ) : (
            <div className="space-y-6">
              {profilePosts.map((p) => (
                <PostItem
                  key={p.id}
                  post={p}
                  isLiked={likedPostIds.has(p.id)}
                  connectedIds={connectedIds}
                  onDelete={(id) => setProfilePosts((prev) => prev.filter((x) => x.id !== id))}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {showSongGuide && <SongwritingGuideModal onClose={() => setShowSongGuide(false)} />}
      <ConfirmModal
        isOpen={!!confirmRemoveId}
        title="Remove Loco?"
        message="Are you sure you want to remove this Loco? They will no longer be in your connections list."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={async () => {
          if (!confirmRemoveId) return;
          setRemovingLocoId(confirmRemoveId);
          setConfirmRemoveId(null);
          try {
            await api.delete(`/connections/${confirmRemoveId}`);
            const removedLoco = locos.find((c) => c.id === confirmRemoveId);
            setLocos((prev) => prev.filter((c) => c.id !== confirmRemoveId));
            if (removedLoco) {
              setConnectedIds((prev) => {
                const next = new Set(prev);
                next.delete(removedLoco.other_user.id);
                return next;
              });
            }
          } catch {
            // ignore
          } finally {
            setRemovingLocoId(null);
          }
        }}
        onCancel={() => setConfirmRemoveId(null)}
      />
    </div>
  );
}
