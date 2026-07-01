import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

const emptyComment = { name: '', email: '', content: '' };

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
  const [commentForm, setCommentForm] = useState(emptyComment);
  const [commentMessage, setCommentMessage] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  useEffect(() => {
    api(`/posts/${slug}`)
      .then((data) => {
        setPost(data.post);
        document.title = `${data.post.title} | NovaBlog`;
        document.querySelector('meta[name="description"]')?.setAttribute('content', data.post.summary || data.post.title);
      })
      .catch((err) => setError(err.message));
  }, [slug]);

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
      <Link to="/">← Tüm yazılar</Link>
      <div className="meta-row"><span>{post.category}</span><span>{post.readingTime} dk okuma</span><span>{post.views} görüntülenme</span><span>{post.comments?.length || 0} yorum</span></div>
      <h1>{post.title}</h1>
      <p className="lead">{post.summary}</p>
      {post.coverImage && <img className="cover" src={post.coverImage} alt={post.title} />}
      <div className="content">{renderMarkdownLite(post.content)}</div>
      <div className="tag-row">{post.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>

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
