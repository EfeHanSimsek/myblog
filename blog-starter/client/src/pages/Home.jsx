import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { PostCard } from '../components/PostCard';

export function Home() {
  const [posts, setPosts] = useState([]);
  const [facets, setFacets] = useState({ categories: [], tags: [] });
  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState('all');
  const [tagSlug, setTagSlug] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/posts/facets/public')
      .then((data) => setFacets({ categories: data.categories || [], tags: data.tags || [] }))
      .catch(() => setFacets({ categories: [], tags: [] }));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categorySlug !== 'all') params.set('categorySlug', categorySlug);
    if (tagSlug !== 'all') params.set('tagSlug', tagSlug);

    api(`/posts?${params.toString()}`)
      .then((data) => setPosts(data.posts))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search, categorySlug, tagSlug]);

  return (
    <section className="page stack">
      <div className="hero">
        <p className="eyebrow">Modern Blog CMS</p>
        <h1>Fikirlerini hızlı, temiz ve yönetilebilir şekilde yayınla.</h1>
        <p>Custom backend, yayımcı paneli, SEO uyumlu yazılar ve genişletilebilir mimari.</p>
      </div>

      <div className="toolbar public-toolbar">
        <label>Yazı arama<input className="search" placeholder="Başlık, içerik veya açıklamada ara..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>Kategori<select value={categorySlug} onChange={(event) => setCategorySlug(event.target.value)}><option value="all">Tüm kategoriler</option>{facets.categories.map((item) => <option value={item.slug} key={item.slug}>{item.name} ({item.count})</option>)}</select></label>
        <label>Etiket<select value={tagSlug} onChange={(event) => setTagSlug(event.target.value)}><option value="all">Tüm etiketler</option>{facets.tags.map((item) => <option value={item.slug} key={item.slug}>#{item.name} ({item.count})</option>)}</select></label>
      </div>

      {!!facets.categories.length && (
        <div className="link-cloud" aria-label="Kategoriler">
          {facets.categories.map((item) => <Link key={item.slug} to={`/kategori/${item.slug}`}>{item.name}<span>{item.count}</span></Link>)}
        </div>
      )}

      {loading && <p className="notice">Yazılar yükleniyor...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !posts.length && <p className="notice">Henüz yazı yok veya arama sonucu bulunamadı. Farklı bir kelime, kategori ya da etiket deneyebilirsin.</p>}
      <div className="post-grid">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
    </section>
  );
}
