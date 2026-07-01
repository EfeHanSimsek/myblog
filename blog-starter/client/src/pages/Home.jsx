import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PostCard } from '../components/PostCard';

export function Home() {
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/posts?search=${encodeURIComponent(search)}`)
      .then((data) => setPosts(data.posts))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <section className="page stack">
      <div className="hero">
        <p className="eyebrow">Modern Blog CMS</p>
        <h1>Fikirlerini hızlı, temiz ve yönetilebilir şekilde yayınla.</h1>
        <p>Custom backend, yayımcı paneli, SEO uyumlu yazılar ve genişletilebilir mimari.</p>
      </div>

      <input className="search" placeholder="Yazılarda ara..." value={search} onChange={(event) => setSearch(event.target.value)} />

      {loading && <p className="notice">Yazılar yükleniyor...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !posts.length && <p className="notice">Henüz yazı yok veya arama sonucu bulunamadı.</p>}
      <div className="post-grid">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
    </section>
  );
}
