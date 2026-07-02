import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PostQualityPanel, analyzePostQuality } from '../components/PostQualityPanel';
import { api } from '../lib/api';

const emptyPost = {
  title: '',
  slug: '',
  summary: '',
  seoTitle: '',
  seoDescription: '',
  content: '',
  coverImage: '',
  altCoverImage: '',
  category: '',
  tags: []
};

function getEditorLink(post) {
  return `/dashboard?edit=${encodeURIComponent(post.id)}`;
}

export function AdminQuality() {
  const [posts, setPosts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPosts() {
      try {
        const data = await api('/posts?includeDrafts=true');
        const nextPosts = data.posts || [];
        setPosts(nextPosts);
        setSelectedId(nextPosts[0]?.id || '');
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadPosts();
  }, []);

  const selectedPost = useMemo(() => {
    return posts.find((post) => post.id === selectedId) || posts[0] || emptyPost;
  }, [posts, selectedId]);

  const selectedPostCanEdit = Boolean(selectedPost?.id);

  const audit = useMemo(() => {
    return posts
      .map((post) => ({ post, quality: analyzePostQuality(post) }))
      .sort((a, b) => a.quality.score - b.quality.score);
  }, [posts]);

  if (isLoading) return <section className="page stack"><p className="notice">Kalite raporu hazırlanıyor...</p></section>;

  return (
    <section className="page stack">
      <div>
        <p className="eyebrow">Yayımcı Paneli</p>
        <h1>Yazı Kalite Kontrolü</h1>
        <p className="notice">SEO, erişilebilirlik ve yayın hazırlığı kontrolleri dış servis gerektirmeden yerel içerik verisiyle yapılır.</p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Yazı Seçimi</p>
            <h2>Kontrol edilecek yazı</h2>
          </div>
          <div className="actions">
            {selectedPostCanEdit && <Link className="button-link" to={getEditorLink(selectedPost)}>Seçili yazıyı düzenle</Link>}
            <span className="result-count">{posts.length} yazı</span>
          </div>
        </div>
        <label>
          Yazı
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {posts.map((post) => (
              <option key={post.id} value={post.id}>{post.title} · {post.status}</option>
            ))}
          </select>
        </label>
        {!posts.length && <p className="notice">Henüz denetlenecek yazı yok.</p>}
      </div>

      <PostQualityPanel currentPost={selectedPost} posts={posts} />

      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Genel Denetim</p>
            <h2>En riskli yazılar</h2>
          </div>
          <Link className="button-link" to="/dashboard/calendar">Takvime git</Link>
        </div>
        <div className="table-list">
          {audit.slice(0, 10).map(({ post, quality }) => (
            <Link className="table-row" key={post.id} to={getEditorLink(post)}>
              <div>
                <strong>{post.title}</strong>
                <span>{quality.score}/100 · {quality.issueCount} uyarı · {quality.criticalCount} kritik · {post.status}</span>
              </div>
              <span className="row-action">Düzenle</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
