import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

const emptyComment = { name: '', email: '', content: '' };

function slugify(value) {
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
    .replace(/^-+|-+$/g, '');
}

function renderMarkdownLite(content) {
  return content.split('\n').map((line, index) => {
    if (line.startsWith('# ')) return <h1 key={index} id={slugify(line.slice(2))}>{line.slice(2)}</h1>;
    if (line.startsWith('## ')) return <h2 key={index} id={slugify(line.slice(3))}>{line.slice(3)}</h2>;
    if (line.startsWith('### ')) return <h3 key={index} id={slugify(line.slice(4))}>{line.slice(4)}</h3>;
    if (line.startsWith('- ')) return <p className="list-line" key={index}>• {line.slice(2)}</p>;
    if (!line.trim()) return <br key={index} />;
    return <p key={index}>{line}</p>;
  });
}

function readingProgress() {
  const height = document.documentElement.scrollHeight - window.innerHeight;
  if (height <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((window.scrollY / height) * 100)));
}

function articleSchema(post, shareUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.seoTitle || post.title,
    description: post.seoDescription || post.summary,
    image: post.coverImage ? [post.coverImage] : undefined,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: shareUrl,
    author: { '@type': 'Person', name: post.authorName || 'NovaBlog Editörü' },
    publisher: { '@type': 'Organization', name: 'NovaBlog' }
  };
}

export function PostDetail() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');
  const [commentForm, setCommentForm] = useState(emptyComment);
  const [commentMessage, setCommentMessage] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      setProgress(readingProgress());
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    api(`/posts/${slug}`)
      .then((data) => {
        setPost(data.post);
        document.title = `${data.post.seoTitle || data.post.title} | NovaBlog`;
        document.querySelector('meta[name="description"]')?.setAttribute('content', data.post.seoDescription || data.post.summary || data.post.title);
      })
      .catch((err) => setError(err.message));
  }, [slug]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const toc = useMemo(() => post?.tableOfContents || [], [post]);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCommentMessage('Yazı bağlantısı kopyalandı.');
  }

  async function submitComment(event) {
    event.preventDefault();
    setCommentError('');
    setCommentMessage('');
    setCommentLoading(true);

    try {
      await api(`/posts/${post.id}/comments`, { method: 'POST', body: JSON.stringify(commentForm) });
      setCommentForm(emptyComment);
      setCommentMessage('Yorumun moderasyon onayına gönderildi.');
    } catch (err) {
      setCommentError(err.message);
    } finally {
      setCommentLoading(false);
    }
  }

  if (error) return <section className="page"><p className="error">{error}</p><Link to="/">Ana sayfaya dön</Link></section>;
  if (!post) return <section className="page"><p className="notice">Yazı yükleniyor...</p></section>;

  return (
    <article className="page article">
      <script type="application/ld+json">{JSON.stringify(articleSchema(post, shareUrl))}</script>
      <div className="reading-progress" style={{ width: `${progress}%` }} />
      <nav className="breadcrumb" aria-label="Breadcrumb"><Link to="/">Ana sayfa</Link><span>/</span>{post.categorySlug ? <Link to={`/kategori/${post.categorySlug}`}>{post.category}</Link> : <span>{post.category}</span>}<span>/</span><span>{post.title}</span></nav>
      <Link to="/">← Tüm yazılar</Link>
      <div className="meta-row"><span>{post.category}</span><span>{post.readingTime} dk okuma</span><span>{post.wordCount || 0} kelime</span><span>{post.views} görüntülenme</span><span>{post.comments?.length || 0} yorum</span></div>
      <h1>{post.title}</h1>
      <p className="lead">{post.summary}</p>
      <div className="meta-row"><span>Yayın: {new Date(post.publishedAt || post.createdAt).toLocaleDateString('tr-TR')}</span><span>Güncelleme: {new Date(post.updatedAt).toLocaleDateString('tr-TR')}</span></div>
      {post.coverImage && <img className="cover" src={post.coverImage} alt={post.altCoverImage || post.title} loading="lazy" />}

      {!!toc.length && (
        <nav className="toc panel" aria-label="İçindekiler">
          <strong>İçindekiler</strong>
          {toc.map((item) => <a key={item.id} className={`toc-level-${item.level}`} href={`#${item.id}`}>{item.title}</a>)}
        </nav>
      )}

      <div className="content">{renderMarkdownLite(post.content)}</div>
      <div className="tag-row">{post.tags?.map((tag, index) => {
        const tagSlug = post.tagSlugs?.[index];
        return tagSlug ? <Link key={tag} to={`/etiket/${tagSlug}`}>#{tag}</Link> : <span key={tag}>#{tag}</span>;
      })}</div>

      <section className="panel share-box" aria-label="Paylaşım seçenekleri">
        <h2>Paylaş</h2>
        <div className="actions">
          <a className="button-link" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`} target="_blank" rel="noreferrer">X/Twitter</a>
          <a className="button-link" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer">LinkedIn</a>
          <a className="button-link" href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${post.title} ${shareUrl}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
          <button type="button" onClick={copyLink}>Linki Kopyala</button>
        </div>
      </section>

      <section className="comments" aria-labelledby="comments-title">
        <h2 id="comments-title">Yorumlar</h2>
        <div className="comment-list">
          {post.comments?.map((comment) => (
            <article className="comment-card" key={comment.id}>
              <div><strong>{comment.name}</strong><span>{new Date(comment.createdAt).toLocaleDateString('tr-TR')}</span></div>
              <p>{comment.content}</p>
            </article>
          ))}
          {!post.comments?.length && <p className="notice">Henüz onaylanmış yorum yok.</p>}
        </div>

        <form className="panel comment-form" onSubmit={submitComment}>
          <div>
            <p className="eyebrow">Katkı gönder</p>
            <h3>Yorum Yaz</h3>
          </div>
          <div className="form-grid">
            <label>Ad<input value={commentForm.name} onChange={(e) => setCommentForm({ ...commentForm, name: e.target.value })} required maxLength="80" /></label>
            <label>E-posta<input type="email" value={commentForm.email} onChange={(e) => setCommentForm({ ...commentForm, email: e.target.value })} required maxLength="160" /></label>
          </div>
          <label>Yorum<textarea value={commentForm.content} onChange={(e) => setCommentForm({ ...commentForm, content: e.target.value })} rows="5" required maxLength="1000" /></label>
          {commentMessage && <p className="success" role="status">{commentMessage}</p>}
          {commentError && <p className="error" role="alert">{commentError}</p>}
          <button disabled={commentLoading}>{commentLoading ? 'Gönderiliyor...' : 'Yorumu Gönder'}</button>
        </form>
      </section>
    </article>
  );
}
