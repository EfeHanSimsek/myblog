import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const emptyForm = {
  id: null,
  title: '',
  slug: '',
  summary: '',
  seoTitle: '',
  seoDescription: '',
  content: '',
  coverImage: '',
  altCoverImage: '',
  category: 'Genel',
  tags: '',
  status: 'draft',
  publishedAt: ''
};

function createSlug(value) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function Dashboard() {
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentFilter, setCommentFilter] = useState('pending');
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    const [postData, statData, commentData] = await Promise.all([
      api('/posts?includeDrafts=true'),
      api('/posts/stats/summary'),
      api('/posts/comments/moderation')
    ]);
    setPosts(postData.posts);
    setStats(statData);
    setComments(commentData.comments || []);
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  const categories = useMemo(() => {
    return [...new Set(posts.map((post) => post.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const searchValue = query.trim().toLocaleLowerCase('tr-TR');

    return posts.filter((post) => {
      const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || post.category === categoryFilter;
      const haystack = [post.title, post.summary, post.seoTitle, post.seoDescription, post.category, ...(post.tags || [])].join(' ').toLocaleLowerCase('tr-TR');
      const matchesQuery = !searchValue || haystack.includes(searchValue);
      return matchesStatus && matchesCategory && matchesQuery;
    });
  }, [posts, query, statusFilter, categoryFilter]);

  const filteredComments = useMemo(() => {
    return comments.filter((comment) => commentFilter === 'all' || comment.status === commentFilter);
  }, [comments, commentFilter]);

  function setField(name, value) {
    setForm((current) => {
      if (name === 'title' && (!current.slug || current.slug === createSlug(current.title))) {
        return { ...current, title: value, slug: createSlug(value), seoTitle: current.seoTitle || value };
      }
      return { ...current, [name]: value };
    });
  }

  function edit(post) {
    setForm({
      ...post,
      seoTitle: post.seoTitle || '',
      seoDescription: post.seoDescription || '',
      altCoverImage: post.altCoverImage || '',
      publishedAt: post.publishedAt ? post.publishedAt.slice(0, 16) : '',
      tags: post.tags?.join(', ') || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSaving(true);

    const payload = {
      ...form,
      slug: form.slug || createSlug(form.title),
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : '',
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    };

    try {
      if (form.id) {
        await api(`/posts/${form.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage('Yazı güncellendi.');
      } else {
        await api('/posts', { method: 'POST', body: JSON.stringify(payload) });
        setMessage('Yazı oluşturuldu.');
      }
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm('Bu yazı silinsin mi?')) return;
    try {
      await api(`/posts/${id}`, { method: 'DELETE' });
      setMessage('Yazı silindi.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateCommentStatus(id, status) {
    try {
      await api(`/posts/comments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMessage('Yorum durumu güncellendi.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteComment(id) {
    if (!confirm('Bu yorum silinsin mi?')) return;
    try {
      await api(`/posts/comments/${id}`, { method: 'DELETE' });
      setMessage('Yorum silindi.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="page dashboard stack">
      <div>
        <p className="eyebrow">Yayımcı Paneli</p>
        <h1>İçerik Yönetimi</h1>
      </div>

      {stats && (
        <div className="stats">
          <div><strong>{stats.totalPosts}</strong><span>Toplam yazı</span></div>
          <div><strong>{stats.publishedPosts}</strong><span>Yayında</span></div>
          <div><strong>{stats.draftPosts}</strong><span>Taslak</span></div>
          <div><strong>{stats.scheduledPosts || 0}</strong><span>Zamanlandı</span></div>
          <div><strong>{stats.totalViews}</strong><span>Görüntülenme</span></div>
          <div><strong>{stats.totalComments || 0}</strong><span>Yorum</span></div>
          <div><strong>{stats.pendingComments || 0}</strong><span>Bekleyen yorum</span></div>
          <div><strong>{stats.approvedComments || 0}</strong><span>Onaylı yorum</span></div>
        </div>
      )}

      <form className="panel editor" onSubmit={submit}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Editör</p>
            <h2>{form.id ? 'Yazıyı Düzenle' : 'Yeni Yazı'}</h2>
          </div>
          {form.slug && <span className="slug-preview">/{form.slug}</span>}
        </div>
        <div className="form-grid">
          <label>Başlık<input value={form.title} onChange={(e) => setField('title', e.target.value)} required /></label>
          <label>Slug<input value={form.slug} onChange={(e) => setField('slug', createSlug(e.target.value))} placeholder="Boşsa otomatik üretilir" /></label>
          <label>Kategori<input value={form.category} onChange={(e) => setField('category', e.target.value)} /></label>
          <label>Durum<select value={form.status} onChange={(e) => setField('status', e.target.value)}><option value="draft">Taslak</option><option value="published">Yayında</option></select></label>
        </div>
        <label>SEO Başlığı<input value={form.seoTitle} onChange={(e) => setField('seoTitle', e.target.value)} maxLength="70" placeholder="Arama motorlarında görünecek başlık" /><span className="field-hint">{form.seoTitle.length}/70 karakter</span></label>
        <label>SEO Açıklaması<textarea value={form.seoDescription} onChange={(e) => setField('seoDescription', e.target.value)} rows="2" maxLength="160" placeholder="Arama motorlarında görünecek açıklama" /><span className="field-hint">{form.seoDescription.length}/160 karakter</span></label>
        <label>Yayın Tarihi<input type="datetime-local" value={form.publishedAt} onChange={(e) => setField('publishedAt', e.target.value)} /><span className="field-hint">Boş bırakılırsa yayın sırasında otomatik atanır.</span></label>
        <label>Özet<textarea value={form.summary} onChange={(e) => setField('summary', e.target.value)} rows="2" /></label>
        <label>Kapak görseli URL<input value={form.coverImage} onChange={(e) => setField('coverImage', e.target.value)} /></label>
        <label>Kapak görseli alt metni<input value={form.altCoverImage} onChange={(e) => setField('altCoverImage', e.target.value)} placeholder="Görsel erişilebilirlik açıklaması" /></label>
        <label>Etiketler<input value={form.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="react, blog, cms" /></label>
        <label>İçerik<textarea value={form.content} onChange={(e) => setField('content', e.target.value)} rows="10" required /></label>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <div className="actions"><button disabled={isSaving}>{isSaving ? 'Kaydediliyor...' : form.id ? 'Güncelle' : 'Oluştur'}</button><button type="button" onClick={() => setForm(emptyForm)}>Temizle</button></div>
      </form>

      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Arşiv</p>
            <h2>Yazılar</h2>
          </div>
          <span className="result-count">{filteredPosts.length} / {posts.length} sonuç</span>
        </div>

        <div className="toolbar">
          <label>Arama<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Başlık, özet, etiket ara" /></label>
          <label>Durum<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Tümü</option><option value="published">Yayında</option><option value="draft">Taslak</option></select></label>
          <label>Kategori<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">Tüm kategoriler</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        </div>

        <div className="table-list">
          {filteredPosts.map((post) => (
            <div className="table-row" key={post.id}>
              <div><strong>{post.title}</strong><span>{post.category} · {post.status} · {post.readingTime} dk · {post.views || 0} görüntülenme</span></div>
              <div className="actions"><button onClick={() => edit(post)}>Düzenle</button><button onClick={() => remove(post.id)}>Sil</button></div>
            </div>
          ))}
          {!filteredPosts.length && <p className="notice">Bu filtrelerle eşleşen yazı bulunamadı.</p>}
        </div>
      </div>

      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Moderasyon</p>
            <h2>Yorumlar</h2>
          </div>
          <select className="compact-filter" value={commentFilter} onChange={(e) => setCommentFilter(e.target.value)}><option value="pending">Bekleyen</option><option value="approved">Onaylı</option><option value="rejected">Reddedilen</option><option value="all">Tümü</option></select>
        </div>
        <div className="comment-list moderation-list">
          {filteredComments.map((comment) => (
            <article className="comment-card" key={comment.id}>
              <div><strong>{comment.name}</strong><span>{comment.postTitle} · {comment.status} · {new Date(comment.createdAt).toLocaleDateString('tr-TR')}</span></div>
              <p>{comment.content}</p>
              <div className="actions"><button onClick={() => updateCommentStatus(comment.id, 'approved')}>Onayla</button><button onClick={() => updateCommentStatus(comment.id, 'pending')}>Beklet</button><button onClick={() => updateCommentStatus(comment.id, 'rejected')}>Reddet</button><button onClick={() => deleteComment(comment.id)}>Sil</button></div>
            </article>
          ))}
          {!filteredComments.length && <p className="notice">Bu durumda yorum yok.</p>}
        </div>
      </div>
    </section>
  );
}
