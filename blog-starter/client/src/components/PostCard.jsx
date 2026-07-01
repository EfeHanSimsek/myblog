import { Link } from 'react-router-dom';

export function PostCard({ post }) {
  return (
    <article className="post-card">
      {post.coverImage && <img src={post.coverImage} alt={post.altCoverImage || post.title} loading="lazy" />}
      <div className="post-card-body">
        <div className="meta-row">
          <span>{post.category}</span>
          <span>{post.readingTime} dk okuma</span>
          <span>{post.wordCount || 0} kelime</span>
          <span>{post.approvedComments || post.comments?.length || 0} yorum</span>
        </div>
        <h2><Link to={`/posts/${post.slug}`}>{post.title}</Link></h2>
        <p>{post.contentSummary || post.summary}</p>
        <div className="tag-row">{post.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>
      </div>
    </article>
  );
}
