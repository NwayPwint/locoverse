'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Trash2, Save, Sparkles, FileText, Music, Share2, Megaphone, MessageCircle, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import api from '@/lib/api';
import { Composition, CompositionStructureItem, SharedSong, Post, Article } from '@/types';
import StructureBlock from '@/components/workspace/StructureBlock';
import GenerateModal from '@/components/workspace/GenerateModal';
import ShareSongModal from '@/components/workspace/ShareSongModal';
import ShareToChatModal from '@/components/workspace/ShareToChatModal';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import ExportMixButton from '@/components/workspace/ExportMixButton';
import SongwritingGuideModal from '@/components/workspace/SongwritingGuideModal';
import ArticleEditor from '@/components/articles/ArticleEditor';
import ArticleCard from '@/components/articles/ArticleCard';
import PostItem from '@/components/feed/PostItem';

export default function WorkspacePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'songs' | 'posts' | 'articles'>('songs');

  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState('Untitled');
  const [structure, setStructure] = useState<CompositionStructureItem[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showShareToChat, setShowShareToChat] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bpm, setBpm] = useState(120);
  const [timeSignature, setTimeSignature] = useState('4/4');
  const [metronomePlaying, setMetronomePlaying] = useState(false);
  const metronomeRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showSongGuide, setShowSongGuide] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [postForm, setPostForm] = useState({ category: 'collab', title: '', content: '', visibility: 'public' });
  const [postSaving, setPostSaving] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [showArticleEditor, setShowArticleEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const activeComp = compositions.find(c => c.id === activeId);

  const performSave = useCallback(async (silent = false) => {
    if (!activeId) return false;
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const res = await api.put(`/compositions/${activeId}`, { title, structure, bpm, timeSignature });
      setCompositions(prev => prev.map(c => c.id === activeId ? res.data.composition : c));
      setDirty(false);
      setSaveStatus('saved');
      return true;
    } catch {
      setSaveStatus('error');
      if (!silent) showToast('Failed to save song', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [activeId, title, structure, bpm, timeSignature, showToast]);

  useEffect(() => {
    if (!dirty || !activeId) return;
    setSaveStatus('unsaved');
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      performSave(true).then((ok) => {
        if (!ok) showToast('Autosave failed — click Save to retry', 'error');
      });
    }, 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [dirty, activeId, title, structure, bpm, timeSignature, performSave, showToast]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const fetchCompositions = useCallback(async () => {
    try {
      const res = await api.get('/compositions');
      setCompositions(res.data.compositions);
      const compositionId = searchParams.get('composition');
      if (compositionId) {
        setActiveId(compositionId);
      }
    } catch {
      showToast('Failed to load songs', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      fetchCompositions();
    } else setIsLoading(false);
  }, [user, fetchCompositions]);

  const postsFetched = useRef(false);
  const articlesFetched = useRef(false);

  useEffect(() => {
    if (!user || activeTab !== 'articles' || articlesFetched.current) return;
    const loadArticles = async () => {
      setArticlesLoading(true);
      try {
        const res = await api.get(`/articles/user/${user.id}`);
        setArticles(res.data.articles);
        articlesFetched.current = true;
      } catch {
        // ignore
      } finally {
        setArticlesLoading(false);
      }
    };
    loadArticles();
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'posts' || postsFetched.current) return;

    const loadPosts = async () => {
      setPostsLoading(true);
      try {
        const [postsRes, likedRes, connRes] = await Promise.all([
          api.get(`/posts/user/${user.id}`),
          api.get('/posts/liked'),
          api.get('/connections'),
        ]);
        setPosts(postsRes.data.posts);
        setLikedPostIds(new Set(likedRes.data.likedPostIds));
        const ids = (connRes.data.connections || [])
          .map((c: { other_user?: { id: string } }) => c.other_user?.id)
          .filter(Boolean);
        setConnectedIds(new Set(ids));
        postsFetched.current = true;
      } catch {
        // ignore
      } finally {
        setPostsLoading(false);
      }
    };
    loadPosts();
  }, [user, activeTab]);

  const handleCreatePost = async () => {
    if (!postForm.title.trim() && !postForm.content.trim()) return;
    setPostSaving(true);
    try {
      const res = await api.post('/posts', postForm);
      setPosts((prev) => [res.data.post, ...prev]);
      setPostForm({ category: 'collab', title: '', content: '', visibility: 'public' });
      setShowPostForm(false);
      router.push('/vibes');
    } catch {
      showToast('Failed to create post', 'error');
    } finally {
      setPostSaving(false);
    }
  };

  const toggleMetronome = () => {
    if (metronomePlaying) {
      if (metronomeRef.current) clearInterval(metronomeRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
      metronomeRef.current = null;
      audioCtxRef.current = null;
      setMetronomePlaying(false);
      return;
    }
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const interval = 60 / bpm * 1000;
    let beat = 0;
    const [numerator] = timeSignature.split('/').map(Number);
    metronomeRef.current = window.setInterval(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = beat % numerator === 0 ? 1000 : 800;
      gain.gain.value = 0.15;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
      beat++;
    }, interval);
    setMetronomePlaying(true);
  };

  const handleNew = async () => {
    try {
      const defaultStructure = [
        { section: 'verse' as const, index: 0, content: '', chords: '', recordingUrl: undefined, notes: '' },
        { section: 'chorus' as const, index: 0, content: '', chords: '', recordingUrl: undefined, notes: '' },
        { section: 'verse' as const, index: 1, content: '', chords: '', recordingUrl: undefined, notes: '' },
        { section: 'chorus' as const, index: 1, content: '', chords: '', recordingUrl: undefined, notes: '' },
        { section: 'bridge' as const, index: 0, content: '', chords: '', recordingUrl: undefined, notes: '' },
        { section: 'chorus' as const, index: 2, content: '', chords: '', recordingUrl: undefined, notes: '' },
      ];
      const res = await api.post('/compositions', { title: 'Untitled', structure: defaultStructure, bpm, timeSignature });
      const comp = res.data.composition;
      setCompositions(prev => [comp, ...prev]);
      setActiveId(comp.id);
      setTitle('Untitled');
      setStructure(defaultStructure);
      setDirty(false);
    } catch {
      showToast('Failed to create song', 'error');
    }
  };

  const handleSelect = (id: string) => {
    if (dirty && activeId && id !== activeId) {
      if (!window.confirm('You have unsaved changes. Switch songs anyway?')) return;
    }
    const comp = compositions.find(c => c.id === id);
    if (!comp) return;
    setActiveId(id);
    setTitle(comp.title);
    setStructure(comp.structure || []);
    setBpm(comp.bpm ?? 120);
    setTimeSignature(comp.timeSignature ?? '4/4');
    setDirty(false);
    setSaveStatus('saved');
  };

  const handleSave = () => performSave(false);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/compositions/${id}`);
      setCompositions(prev => prev.filter(c => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setTitle('Untitled');
        setStructure([]);
      }
    } catch {
      showToast('Failed to delete song', 'error');
    }
  };

  const handleGenerated = (data: { lyrics: string; structure: { section: string; content: string; chords?: string; recordingUrl?: string; notes?: string }[] }) => {
    const mapped = data.structure.map((s, i) => ({
      section: s.section as CompositionStructureItem['section'],
      index: i,
      content: s.content,
      chords: s.chords || '',
      recordingUrl: s.recordingUrl || undefined,
      notes: s.notes || '',
    }));
    setStructure(mapped);
    setDirty(true);
  };

  const handleShared = (sharedSong: SharedSong) => {
    console.log('Shared song created', sharedSong);
  };

  const updateBlock = (idx: number, content: string) => {
    setStructure(prev => prev.map((item, i) => i === idx ? { ...item, content } : item));
    setDirty(true);
  };

  const updateBlockChords = (idx: number, chords: string) => {
    setStructure(prev => prev.map((item, i) => i === idx ? { ...item, chords } : item));
    setDirty(true);
  };

  const updateBlockRecording = (idx: number, recordingUrl: string | undefined, recordingPublicId?: string) => {
    setStructure(prev => prev.map((item, i) => i === idx ? { ...item, recordingUrl, recordingPublicId: recordingUrl ? (recordingPublicId || item.recordingPublicId) : undefined } : item));
    setDirty(true);
  };

  const updateBlockNotes = (idx: number, notes: string) => {
    setStructure(prev => prev.map((item, i) => i === idx ? { ...item, notes } : item));
    setDirty(true);
  };

  const updateBlockBars = (idx: number, bars: number) => {
    setStructure(prev => prev.map((item, i) => i === idx ? { ...item, bars } : item));
    setDirty(true);
  };

  const removeBlock = (idx: number) => {
    setStructure(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const addBlock = () => {
    const blockCounts = structure.filter(s => s.section === 'verse').length;
    setStructure(prev => [...prev, { section: 'verse', index: blockCounts, content: '', bars: 8 }]);
    setDirty(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-secondary text-sm font-mono">Please log in to use the Creator Hub.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <LoadingOverlay show={isLoading} />
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Music size={20} className="text-accent-action" />
            <h1 className="text-xl md:text-2xl font-heading font-bold">Creator Hub</h1>
          </div>
          {activeTab === 'songs' ? (
            <button onClick={handleNew} className="btn-primary !px-3 sm:!px-4 !min-h-[36px] !text-[10px] flex items-center gap-2">
              <Plus size={14} />
              <span className="hidden sm:inline">New Song</span>
            </button>
          ) : activeTab === 'articles' ? (
            <button onClick={() => { setEditingArticle(null); setShowArticleEditor(true); }} className="btn-primary !px-4 !min-h-[36px] !text-[10px] flex items-center gap-2">
              <Plus size={14} />
              New Article
            </button>
          ) : (
            <button onClick={() => setShowPostForm(true)} className="btn-primary !px-4 !min-h-[36px] !text-[10px] flex items-center gap-2">
              <Plus size={14} />
              New Post
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 sm:gap-6 border-b border-border mb-4 sm:mb-6">
          <button
            onClick={() => setActiveTab('songs')}
            className={`flex items-center gap-2 pb-3 text-xs font-mono uppercase tracking-wider transition-all duration-200 border-b-2 -mb-[1px] ${
              activeTab === 'songs'
                ? 'border-accent-action text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Music size={14} />
            Songs
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-2 pb-3 text-xs font-mono uppercase tracking-wider transition-all duration-200 border-b-2 -mb-[1px] ${
              activeTab === 'posts'
                ? 'border-accent-action text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Megaphone size={14} />
            Posts
          </button>
          <button
            onClick={() => setActiveTab('articles')}
            className={`flex items-center gap-2 pb-3 text-xs font-mono uppercase tracking-wider transition-all duration-200 border-b-2 -mb-[1px] ${
              activeTab === 'articles'
                ? 'border-accent-action text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <BookOpen size={14} />
            Articles
          </button>
          <button
            onClick={() => setShowSongGuide(true)}
            className="ml-auto w-6 h-6 rounded-full border border-border text-text-secondary hover:text-text-primary hover:border-text-primary text-xs font-mono font-bold flex items-center justify-center transition-colors self-center mb-2"
            title="How to use songwriting tools"
          >
            ?
          </button>
        </div>

        {activeTab === 'songs' && (
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 overflow-hidden">
          {/* Sidebar */}
          <div className="bg-white border border-border">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-secondary">My Songs ({compositions.length})</p>
            </div>
            <div className="max-h-[30vh] sm:max-h-[60vh] overflow-y-auto">
              {compositions.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <FileText size={24} className="mx-auto text-text-secondary/30 mb-2" />
                  <p className="text-xs font-mono text-text-secondary">No songs yet</p>
                </div>
              ) : (
                compositions.map(comp => (
                  <button
                    key={comp.id}
                    onClick={() => handleSelect(comp.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left border-b border-border last:border-b-0 transition-colors ${
                      activeId === comp.id ? 'bg-accent-action/5 border-l-2 border-l-accent-action' : 'hover:bg-background'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-heading font-bold truncate">{comp.title}</p>
                      <p className="text-[10px] font-mono text-text-secondary mt-0.5">
                        {new Date(comp.updated_at).toLocaleDateString()}
                      </p>
                    </div>

                    <span
                      onClick={(e) => { e.stopPropagation(); handleDelete(comp.id); }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleDelete(comp.id); } }}
                      className="p-1 text-red-400 hover:text-red-500 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="bg-white border border-border min-w-0 overflow-hidden">
            {activeId ? (
              <>
                <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                      className="text-base font-heading font-bold bg-transparent border-none outline-none text-text-primary flex-1 min-w-0"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={40}
                        max={300}
                        value={bpm}
                        onChange={(e) => { setBpm(Number(e.target.value)); setDirty(true); }}
                        className="w-14 text-[10px] font-mono border border-border bg-surface px-1.5 py-1 text-text-primary outline-none text-center"
                      />
                      <span className="text-[9px] font-mono text-text-secondary">BPM</span>
                      <select
                        value={timeSignature}
                        onChange={(e) => { setTimeSignature(e.target.value); setDirty(true); }}
                        className="text-[10px] font-mono border border-border bg-surface px-1.5 py-1 text-text-primary outline-none"
                      >
                        <option value="2/4">2/4</option>
                        <option value="3/4">3/4</option>
                        <option value="4/4">4/4</option>
                        <option value="5/4">5/4</option>
                        <option value="6/8">6/8</option>
                        <option value="7/8">7/8</option>
                      </select>
                      <button
                        onClick={toggleMetronome}
                        className={`p-1.5 border transition-all duration-200 ${metronomePlaying ? 'bg-accent-action text-white border-accent-action' : 'border-border text-text-secondary hover:text-accent-action'}`}
                        title="Metronome"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="2" x2="12" y2="6" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="14" x2="12" y2="18" />
                          <polyline points="4 22 16 22 20 18 8 10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <button onClick={() => setShowShare(true)} className="btn-secondary !px-2 sm:!px-3 !min-h-[32px] !text-[9px] flex items-center gap-1.5">
                      <Share2 size={12} />
                      <span className="hidden sm:inline">Share</span>
                    </button>
                    <button onClick={() => setShowShareToChat(true)} className="btn-secondary !px-2 sm:!px-3 !min-h-[32px] !text-[9px] flex items-center gap-1.5">
                      <MessageCircle size={12} />
                      <span className="hidden sm:inline">Send</span>
                    </button>

                    <button onClick={() => setShowGenerate(true)} className="btn-secondary !px-2 sm:!px-3 !min-h-[32px] !text-[9px] flex items-center gap-1.5">
                      <Sparkles size={12} />
                      <span className="hidden sm:inline">AI</span>
                    </button>
                    <ExportMixButton structure={structure} title={title} />
                    {saveStatus !== 'saved' && (
                      <span className={`text-[9px] font-mono hidden sm:inline ${
                        saveStatus === 'error' ? 'text-red-500' : saveStatus === 'saving' ? 'text-text-secondary' : 'text-accent-warm'
                      }`}>
                        {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Save failed' : 'Unsaved'}
                      </span>
                    )}
                    <button onClick={handleSave} disabled={isSaving || !dirty} className="btn-primary !px-2 sm:!px-3 !min-h-[32px] !text-[9px] flex items-center gap-1.5">
                      <Save size={12} />
                      <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 sm:p-6 space-y-4">
                  {structure.map((item, idx) => (
                    <StructureBlock
                      key={`${item.section}-${idx}`}
                      item={item}
                      onChange={(content) => updateBlock(idx, content)}
                      onChordsChange={(chords) => updateBlockChords(idx, chords)}
                      onRecordingChange={(url, publicId) => updateBlockRecording(idx, url, publicId)}
                      onNotesChange={(notes) => updateBlockNotes(idx, notes)}
                      onBarsChange={(bars) => updateBlockBars(idx, bars)}
                      onRemove={() => removeBlock(idx)}
                    />
                  ))}

                  <button
                    onClick={addBlock}
                    className="w-full border border-dashed border-border py-3 text-[10px] font-mono uppercase tracking-wider text-text-secondary hover:text-accent-action hover:border-accent-action transition-colors"
                  >
                    + Add Section
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Music size={40} className="text-text-secondary/20 mb-4" />
                <p className="text-sm font-mono text-text-secondary">Select a song or create a new one</p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* My Articles */}
        {activeTab === 'articles' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <BookOpen size={20} className="text-accent-action" />
            <h2 className="text-lg font-heading font-bold">My Articles</h2>
          </div>
          {articlesLoading ? (
            <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">Loading articles...</div>
          ) : articles.length === 0 ? (
            <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">
              No articles yet. Click &quot;New Article&quot; to write one.
            </div>
          ) : (
            <div className="space-y-5">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} onEdit={(a) => {
                  setEditingArticle(a);
                  setShowArticleEditor(true);
                }} />
              ))}
            </div>
          )}
        </div>
        )}

        {/* Community Posts */}
        {activeTab === 'posts' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Megaphone size={20} className="text-accent-action" />
            <h2 className="text-lg font-heading font-bold">Community Posts</h2>
          </div>

        {showPostForm && (
            <div className="bg-white border border-border p-5 mb-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary mb-1.5">Category</label>
                  <select
                    value={postForm.category}
                    onChange={(e) => setPostForm((p) => ({ ...p, category: e.target.value }))}
                    className="input-field"
                  >
                    <option value="collab">Collaboration (e.g. vocalist needed)</option>
                    <option value="forsale">For Sale (songs to sell)</option>
                    <option value="looking">Looking For</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary mb-1.5">Visibility</label>
                  <select
                    value={postForm.visibility}
                    onChange={(e) => setPostForm((p) => ({ ...p, visibility: e.target.value }))}
                    className="input-field"
                  >
                    <option value="public">Public (everyone)</option>
                    <option value="connections-only">Locos only</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary mb-1.5">Title</label>
                <input
                  value={postForm.title}
                  onChange={(e) => setPostForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Vocalist needed for indie band"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-text-secondary mb-1.5">Details</label>
                <textarea
                  value={postForm.content}
                  onChange={(e) => setPostForm((p) => ({ ...p, content: e.target.value }))}
                  rows={4}
                  placeholder="Describe what you're looking for or offering..."
                  className="input-field resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowPostForm(false)} className="btn-secondary !px-4 !min-h-[36px] !text-[11px]">
                  Cancel
                </button>
                <button
                  onClick={handleCreatePost}
                  disabled={postSaving || (!postForm.title.trim() && !postForm.content.trim())}
                  className="btn-primary !px-4 !min-h-[36px] !text-[11px] disabled:opacity-40"
                >
                  {postSaving ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          )}

          {postsLoading ? (
            <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="bg-white border border-border p-8 text-center text-text-secondary text-sm">No community posts yet.</div>
          ) : (
            <div className="space-y-6">
              {posts.map((p) => (
                <PostItem
                  key={p.id}
                  post={p}
                  isLiked={likedPostIds.has(p.id)}
                  connectedIds={connectedIds}
                  onDelete={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
                />
              ))}
            </div>
          )}
        </div>
        )}

        {showGenerate && (
          <GenerateModal
            onClose={() => setShowGenerate(false)}
            onGenerated={handleGenerated}
          />
        )}
        {showShare && activeComp && (
          <ShareSongModal
            composition={activeComp}
            onClose={() => setShowShare(false)}
            onShared={handleShared}
          />
        )}
        {showShareToChat && activeComp && (
          <ShareToChatModal
            composition={activeComp}
            onClose={() => setShowShareToChat(false)}
          />
        )}
        {showSongGuide && <SongwritingGuideModal onClose={() => setShowSongGuide(false)} />}
        {showArticleEditor && (
          <ArticleEditor
            initial={editingArticle ? {
              title: editingArticle.title,
              slug: editingArticle.slug,
              excerpt: editingArticle.excerpt,
              body_html: editingArticle.body_html,
              cover_image_url: editingArticle.cover_image_url || undefined,
              tags: editingArticle.tags,
              is_published: editingArticle.is_published,
            } : undefined}
            onSave={(article) => {
              const idx = articles.findIndex((a) => a.id === article.id);
              if (idx >= 0) {
                setArticles((prev) => prev.map((a) => (a.id === article.id ? article : a)));
              } else {
                setArticles((prev) => [article, ...prev]);
              }
              setShowArticleEditor(false);
              setEditingArticle(null);
            }}
            onClose={() => { setShowArticleEditor(false); setEditingArticle(null); }}
          />
        )}
      </div>
    </div>
  );
}
