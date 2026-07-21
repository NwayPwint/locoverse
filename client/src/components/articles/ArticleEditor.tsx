'use client';

import { useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Heading2, Heading3, Code, List, ListOrdered, X } from 'lucide-react';
import api from '@/lib/api';
import { Article } from '@/types';

interface ArticleEditorProps {
  initial?: {
    title?: string;
    slug?: string;
    excerpt?: string;
    body_html?: string;
    cover_image_url?: string;
    tags?: string[];
    is_published?: boolean;
  };
  onSave: (article: Article) => void;
  onClose: () => void;
}

export default function ArticleEditor({ initial, onSave, onClose }: ArticleEditorProps) {
  const [title, setTitle] = useState(initial?.title || '');
  const [slug, setSlug] = useState(initial?.slug || '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt || '');
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.cover_image_url || '');
  const [tagsInput, setTagsInput] = useState((initial?.tags || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: initial?.body_html || '<p>Start writing your article...</p>',
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none outline-none min-h-[300px] px-4 py-3 text-sm leading-relaxed' },
    },
  });

  const autoSlug = useCallback((val: string) => {
    if (!initial?.slug) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 200) || 'untitled');
    }
  }, [initial]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    autoSlug(val);
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/messages/upload', formData);
      setCoverImageUrl(res.data.url);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const body_html = editor?.getHTML() || '';
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const payload = {
        title,
        slug: slug || undefined,
        excerpt,
        body_html,
        cover_image_url: coverImageUrl || undefined,
        tags,
      };

      let res;
      if (initial?.slug) {
        const existing = await api.get(`/articles/${initial.slug}`);
        res = await api.put(`/articles/${existing.data.article.id}`, payload);
      } else {
        res = await api.post('/articles', payload);
      }

      if (publish) {
        await api.post(`/articles/${res.data.article.id}/publish`);
        res.data.article.is_published = true;
      }

      onSave(res.data.article);
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setSaving(false);
    }
  };

  const ToolBtn = ({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-accent-action/20 text-accent-action' : 'text-text-secondary hover:text-text-primary hover:bg-border'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white border border-border w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em]">{initial ? 'Edit Article' : 'New Article'}</h2>
          <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1">Title</label>
            <input value={title} onChange={(e) => handleTitleChange(e.target.value)} className="input-field text-sm py-3 w-full" placeholder="Article title" />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1">Slug</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} className="input-field text-sm py-2.5 w-full font-mono" placeholder="article-url-slug" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1">Tags (comma-separated)</label>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="input-field text-sm py-2.5 w-full" placeholder="theory, production, tips" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1">Cover Image</label>
            <div className="flex items-center gap-3">
              {coverImageUrl && (
                <img src={coverImageUrl} alt="cover" className="w-20 h-12 object-cover border border-border" />
              )}
              <label className="btn-secondary !px-3 !min-h-[32px] !text-[10px] cursor-pointer">
                {uploading ? 'Uploading...' : coverImageUrl ? 'Change' : 'Upload'}
                <input type="file" accept="image/*" onChange={handleUploadCover} className="hidden" />
              </label>
              {coverImageUrl && (
                <button onClick={() => setCoverImageUrl('')} className="text-[10px] font-mono text-text-secondary hover:text-red-500">Remove</button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1">Excerpt</label>
            <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className="input-field text-sm py-3 w-full resize-none" rows={2} placeholder="Brief summary shown in article cards..." />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-text-secondary mb-1.5">Body</label>
            <div className="border border-border">
              <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-background/50">
                <ToolBtn active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}><Bold size={15} /></ToolBtn>
                <ToolBtn active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolBtn>
                <div className="w-px h-4 bg-border mx-1" />
                <ToolBtn active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></ToolBtn>
                <ToolBtn active={editor?.isActive('heading', { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={15} /></ToolBtn>
                <div className="w-px h-4 bg-border mx-1" />
                <ToolBtn active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}><List size={15} /></ToolBtn>
                <ToolBtn active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolBtn>
                <div className="w-px h-4 bg-border mx-1" />
                <ToolBtn active={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><Code size={15} /></ToolBtn>
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary !px-4 !min-h-[36px] !text-[10px]">Cancel</button>
          <button onClick={() => handleSave(false)} disabled={saving || !title.trim()} className="btn-secondary !px-4 !min-h-[36px] !text-[10px]">
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving || !title.trim()} className="btn-primary !px-4 !min-h-[36px] !text-[10px]">
            {saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
