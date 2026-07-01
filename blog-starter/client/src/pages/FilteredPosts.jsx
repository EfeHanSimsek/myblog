import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { PostCard } from '../components/PostCard';

const pageCopy = {
  category: {
    title: 'Kategori',
    empty: 'Bu kategoride yayınlanmış yazı bulunamadı.',
    param: 'categorySlug'
  },
  tag: {
    title: 'Etiket',
    empty: 'Bu etikette yayınlanmış yazı bulunamadı.',
    param: 'tagSlug'
  }
};

export function FilteredPosts({ type }) {
  const { slug } = useParams();
  const copy = pageCopy[type] || pageCopy.category;
  const [posts, setPosts] = useState([]);
  const [facets, setFacets] = useState({ categories: [], tags: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ [copy.param]: slug });

    Promise.all([
      api(`/posts?${params.toString()}`),
      api('/posts/facets/public')
    ])
      .then(([postData, facetData]) => {
        setPosts(postData.posts || []);
        setFacets({ categories: facetData.categories || [], tags: facetData.tags || [] });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, copy.param]);

  const activeFacet = useMemo(() => {
    const list = type === 'tag' ? facets.tags : facets.categories;
    return list.find((item) => item.slug === slug);
  }, [facets, slug, type]);

  useEffect(() => {
    const label = activeFacet?.name || slug;
    document.title = `${copy.title}: ${label} | NovaBlog`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${label} ${copy.title.toLocaleLowerCase('tr-TR')} sayfasındaki güncel blog yazıları.`);
  }, [activeFacet, copy.title, slug]);

  const title = activeFacet?.name || slug;

  return (
    <section className="page stack">
      <nav className="breadcrumb" aria-label="Sayfa yolu"><Link to="/">Blog</Link><span>/</span><span>{copy.title}</span><span>/</span><strong>{title}</strong></nav>
      <div className="hero compact-hero">
        <p className="eyebrow">{copy.title}</p>
        <h1>{title}</h1>
        <p>{posts.length} yayınlanmış yazı listeleniyor.</p>
      </div>
      {loading && <p className="notice">Yazılar yükleniyor...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !posts.length && <p className="notice">{copy.empty}</p>}
      <div className="post-grid">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
    </section>
  );
}
