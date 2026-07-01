import { useEffect, useMemo, useState } from 'react';
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

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function Dashboard() {
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [commentFilter, setCommentFilter] = useState('pending');
  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    const [postData, statData, commentData] = await Promise.all([
      api('/posts?includeDrafts=true'),
      api('/posts/stats/summary'),
      api('/posts/comments/moderation')
    ]);
    setPosts(postData.posts);
    setStats(statData);
    setComments(commentData.comments);
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  const categories = useMemo(() => [...new Set(posts.map((post) => post.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [posts]);

  const filteredPosts = useMemo(() => {
    const searchValue = query.trim().toLocaleLowerCase('tr-TR');
    return posts.filter((post) => {
      const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || post.category === categoryFilter;
      const haystack = [post.title, post.summary, post.seoTitle, post.seoDescription, post.category, ...(post.tags || [])].join(' ').toLocaleLowerCase('tr-TR');
      return matchesStatus && matchesCategory && (!searchValue || haystack.includes(searchValue));
    });
  }, [posts, query, statusFilter, categoryFilter]);

  const filteredComments = useMemo(() => comments.filter((comment) => commentFilter === 'all' || comment.status === commentFilter), [comments, commentFilter]);

  function setField(name, value) {
    setForm((current) => {
      if (name === 'title') {
        const next = { ...current, title: value };
        if (!current.slug || current.slug === createSlug(current.title)) next.slug = createSlug(value);
        if (!current.seoTitle || current.seoTitle === current.title.slice(0, 70)) next.seoTitle = value.slice(0, 70);
        if (!current.altCoverImage || current.altCoverImage === current.title) next.altCoverImage = value;
        return next;
      }
      if (name === 'summary' && (!current.seoDescription || current.seoDescription === current.summary.slice(0, 170))) {
        return { ...current, summary: value, seoDescription: value.slice(0, 170) };
      }
      return { ...current, [name]: value };
    });
  }

  function edit(post) {
    setForm({ ...emptyForm, ...post, tags: post.tags?.join(', ') || '', publishedAt: toDatetimeLocal(post.publishedAt) });
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
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : ''
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
    if (!window.confirm('Bu yazı silinsin mi?')) return;
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

  async function removeComment(id) {
    if (!window.confirm('Bu yorum silinsin mi?')) return;
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
      <div><p className="eyebrow">Yayımcı Paneli</p><h1>İçerik Yönetimi</h1></div>
      {stats && <div className="stats"><div><strong>{stats.totalPosts}</strong><span>Toplam yazı</span></div><div><strong>{stats.publishedPosts}</strong><span>Yayında</span></div><div><strong>{stats.scheduledPosts || 0}</strong><span>Zamanlandı</span></div><div><strong>{stats.draftPosts}</strong><span>Taslak</span></div><div><strong>{stats.totalViews}</strong><span>Görüntülenme</span></div><div><strong>{stats.totalComments}</strong><span>Toplam yorum</span></div><div><strong>{stats.pendingComments}</strong><span>Onay bekleyen</span></div><div><strong>{stats.approvedComments}</strong><span>Onaylı yorum</span></div></div>}
      <form className="panel editor" onSubmit={submit}>
        <div className="section-heading"><div><p className="eyebrow">Editör</p><h2>{form.id ? 'Yazıyı Düzenle' : 'Yeni Yazı'}</h2></div>{form.slug && <span className="slug-preview">/{form.slug}</span>}</div>
        <div className="form-grid"><label>Başlık<input value={form.title} onChange={(e) => setField('title', e.target.value)} required /></label><label>Slug<input value={form.slug} onChange={(e) => setField('slug', createSlug(e.target.value))} placeholder="Boşsa otomatik üretilir" /></label><label>Kategori<input value={form.category} onChange={(e) => setField('category', e.target.value)} /></label><label>Durum<select value={form.status} onChange={(e) => setField('status', e.target.value)}><option value="draft">Taslak</option><option value="published">Yayında</option></select></label></div>
        <label>Yayın tarihi<input type="datetime-local" value={form.publishedAt} onChange={(e) => setField('publishedAt', e.target.value)} /></label>
        <label>Özet<textarea value={form.summary} onChange={(e) => setField('summary', e.target.value)} rows="2" /></label>
        <div className="form-grid"><label>SEO başlığı<input value={form.seoTitle} onChange={(e) => setField('seoTitle', e.target.value.slice(0, 70))} maxLength="70" /></label><label>SEO açıklaması<textarea value={form.seoDescription} onChange={(e) => setField('seoDescription', e.target.value.slice(0, 170))} rows="2" maxLength="170" /></label></div>
        <div className="meta-help"><span>{form.seoTitle.length}/70 SEO başlığı</span><span>{form.seoDescription.length}/170 SEO açıklaması</span></div>
        <label>Kapak görseli URL<input value={form.coverImage} onChange={(e) => setField('coverImage', e.target.value)} /></label>
        <label>Kapak görseli alt metni<input value={form.altCoverImage} onChange={(e) => setField('altCoverImage', e.target.value)} /></label>
        <label>Etiketler<input value={form.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="react, blog, cms" /></label>
        <label>İçerik<textarea value={form.content} onChange={(e) => setField('content', e.target.value)} rows="10" required /></label>
        {message && <p className="success" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}
        <div className="actions"><button disabled={isSaving}>{isSaving ? 'Kaydediliyor...' : form.id ? 'Güncelle' : 'Oluştur'}</button><button type="button" onClick={() => setForm(emptyForm)}>Temizle</button></div>
      </form>
      <div className="panel"><div className="section-heading"><div><p className="eyebrow">Yorum Moderasyonu</p><h2>Yorumlar</h2></div><span className="result-count">{filteredComments.length} / {comments.length} yorum</span></div><label className="compact-filter">Durum<select value={commentFilter} onChange={(e) => setCommentFilter(e.target.value)}><option value="pending">Onay bekleyen</option><option value="approved">Onaylı</option><option value="rejected">Reddedilen</option><option value="all">Tümü</option></select></label><div className="comment-list moderation-list">{filteredComments.map((comment) => <article className="comment-card" key={comment.id}><div><strong>{comment.name}</strong><span>{comment.postTitle} · {comment.status} · {new Date(comment.createdAt).toLocaleString('tr-TR')}</span></div><p>{comment.content}</p><div className="actions"><button onClick={() => updateCommentStatus(comment.id, 'approved')}>Onayla</button><button onClick={() => updateCommentStatus(comment.id, 'pending')}>Beklet</button><button onClick={() => updateCommentStatus(comment.id, 'rejected')}>Reddet</button><button onClick={() => removeComment(comment.id)}>Sil</button></div></article>)}{!filteredComments.length && <p className="notice">Bu filtrede yorum yok.</p>}</div></div>
      <div className="panel"><div className="section-heading"><div><p className="eyebrow">Arşiv</p><h2>Yazılar</h2></div><span className="result-count">{filteredPosts.length} / {posts.length} sonuç</span></div><div className="toolbar"><label>Arama<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Başlık, özet, SEO, etiket ara" /></label><label>Durum<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Tümü</option><option value="published">Yayında</option><option value="draft">Taslak</option></select></label><label>Kategori<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">Tüm kategoriler</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label></div><div className="table-list">{filteredPosts.map((post) => <div className="table-row" key={post.id}><div><strong>{post.title}</strong><span>{post.category} · {post.status} · {post.readingTime} dk · {post.views || 0} görüntülenme · {post.approvedComments || 0} yorum{post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleString('tr-TR')}` : ''}</span></div><div className="actions"><button onClick={() => edit(post)}>Düzenle</button><button onClick={() => remove(post.id)}>Sil</button></div></div>)}{!filteredPosts.length && <p className="notice">Bu filtrelerle eşleşen yazı bulunamadı.</p>}</div></div>
    </section>
  );
}
