import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { PostCard } from '../components/PostCard';

export function Home() {
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [tag, setTag] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category !== 'all') params.set('category', category);
    if (tag !== 'all') params.set('tag', tag);

    api(`/posts?${params.toString()}`)
      .then((data) => setPosts(data.posts))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, category, tag]);

  const categories = useMemo(() => [...new Set(posts.map((post) => post.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [posts]);
  const tags = useMemo(() => [...new Set(posts.flatMap((post) => post.tags || []))].sort((a, b) => a.localeCompare(b, 'tr')), [posts]);

  return (
    <section className="page stack">
      <div className="hero">
        <p className="eyebrow">Modern Blog CMS</p>
        <h1>Fikirlerini hızlı, temiz ve yönetilebilir şekilde yayınla.</h1>
        <p>Custom backend, yayımcı paneli, SEO uyumlu yazılar ve genişletilebilir mimari.</p>
      </div>

      <div className="toolbar public-toolbar">
        <label>Yazı arama<input className="search" placeholder="Başlık, içerik veya açıklamada ara..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>Kategori<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Tüm kategoriler</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <label>Etiket<select value={tag} onChange={(event) => setTag(event.target.value)}><option value="all">Tüm etiketler</option>{tags.map((item) => <option value={item} key={item}>#{item}</option>)}</select></label>
      </div>

      {loading && <p className="notice">Yazılar yükleniyor...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !posts.length && <p className="notice">Henüz yazı yok veya arama sonucu bulunamadı. Farklı bir kelime, kategori ya da etiket deneyebilirsin.</p>}
      <div className="post-grid">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
    </section>
  );
}
