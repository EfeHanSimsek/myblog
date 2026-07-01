import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

function renderMarkdownLite(content) {
  return content.split('\n').map((line, index) => {
    if (line.startsWith('# ')) return <h1 key={index}>{line.slice(2)}</h1>;
    if (line.startsWith('## ')) return <h2 key={index}>{line.slice(3)}</h2>;
    if (!line.trim()) return <br key={index} />;
    return <p key={index}>{line}</p>;
  });
}

export function PostDetail() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/posts/${slug}`)
      .then((data) => {
        setPost(data.post);
        document.title = `${data.post.title} | NovaBlog`;
        document.querySelector('meta[name="description"]')?.setAttribute('content', data.post.summary || data.post.title);
      })
      .catch((err) => setError(err.message));
  }, [slug]);

  if (error) return <section className="page"><p className="error">{error}</p><Link to="/">Ana sayfaya dön</Link></section>;
  if (!post) return <section className="page"><p className="notice">Yazı yükleniyor...</p></section>;

  return (
    <article className="page article">
      <Link to="/">← Tüm yazılar</Link>
      <div className="meta-row"><span>{post.category}</span><span>{post.readingTime} dk okuma</span><span>{post.views} görüntülenme</span></div>
      <h1>{post.title}</h1>
      <p className="lead">{post.summary}</p>
      {post.coverImage && <img className="cover" src={post.coverImage} alt={post.title} />}
      <div className="content">{renderMarkdownLite(post.content)}</div>
      <div className="tag-row">{post.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>
    </article>
  );
}
