import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const emptyForm = {
  id: null,
  title: '',
  slug: '',
  summary: '',
  content: '',
  coverImage: '',
  category: 'Genel',
  tags: '',
  status: 'draft'
};

export function Dashboard() {
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [postData, statData] = await Promise.all([
      api('/posts?includeDrafts=true'),
      api('/posts/stats/summary')
    ]);
    setPosts(postData.posts);
    setStats(statData);
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function edit(post) {
    setForm({ ...post, tags: post.tags?.join(', ') || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const payload = { ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) };
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
    }
  }

  async function remove(id) {
    if (!confirm('Bu yazı silinsin mi?')) return;
    await api(`/posts/${id}`, { method: 'DELETE' });
    await load();
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
          <div><strong>{stats.totalViews}</strong><span>Görüntülenme</span></div>
        </div>
      )}

      <form className="panel editor" onSubmit={submit}>
        <h2>{form.id ? 'Yazıyı Düzenle' : 'Yeni Yazı'}</h2>
        <div className="form-grid">
          <label>Başlık<input value={form.title} onChange={(e) => setField('title', e.target.value)} required /></label>
          <label>Slug<input value={form.slug} onChange={(e) => setField('slug', e.target.value)} placeholder="Boşsa otomatik üretilir" /></label>
          <label>Kategori<input value={form.category} onChange={(e) => setField('category', e.target.value)} /></label>
          <label>Durum<select value={form.status} onChange={(e) => setField('status', e.target.value)}><option value="draft">Taslak</option><option value="published">Yayında</option></select></label>
        </div>
        <label>Özet<textarea value={form.summary} onChange={(e) => setField('summary', e.target.value)} rows="2" /></label>
        <label>Kapak görseli URL<input value={form.coverImage} onChange={(e) => setField('coverImage', e.target.value)} /></label>
        <label>Etiketler<input value={form.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="react, blog, cms" /></label>
        <label>İçerik<textarea value={form.content} onChange={(e) => setField('content', e.target.value)} rows="10" required /></label>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <div className="actions"><button>{form.id ? 'Güncelle' : 'Oluştur'}</button><button type="button" onClick={() => setForm(emptyForm)}>Temizle</button></div>
      </form>

      <div className="panel">
        <h2>Yazılar</h2>
        <div className="table-list">
          {posts.map((post) => (
            <div className="table-row" key={post.id}>
              <div><strong>{post.title}</strong><span>{post.category} · {post.status} · {post.readingTime} dk</span></div>
              <div className="actions"><button onClick={() => edit(post)}>Düzenle</button><button onClick={() => remove(post.id)}>Sil</button></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
