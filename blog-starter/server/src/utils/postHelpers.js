import slugify from 'slugify';

export function makeSlug(input) {
  return slugify(input || '', { lower: true, strict: true, locale: 'tr' });
}

export function wordCount(content = '') {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function readingTime(content = '') {
  return Math.max(1, Math.ceil(wordCount(content) / 180));
}

export function contentSummary(content = '', fallback = '') {
  const plain = content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>\-[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (fallback || plain).slice(0, 180);
}

export function tableOfContents(content = '') {
  return content
    .split('\n')
    .filter((line) => /^#{2,3}\s+/.test(line))
    .map((line) => {
      const level = line.startsWith('### ') ? 3 : 2;
      const title = line.replace(/^#{2,3}\s+/, '').trim();
      return { level, title, id: makeSlug(title) };
    });
}

export function isPublicPost(post, now = new Date()) {
  if (post.status !== 'published') return false;
  if (post.publishedAt && new Date(post.publishedAt) > now) return false;
  return true;
}

export function publicPost(post) {
  return {
    ...post,
    categories: Array.isArray(post.categories) && post.categories.length ? post.categories : [post.category || 'Genel'],
    wordCount: wordCount(post.content),
    readingTime: readingTime(post.content),
    contentSummary: contentSummary(post.content, post.summary),
    tableOfContents: tableOfContents(post.content),
    comments: Array.isArray(post.comments) ? post.comments.filter((comment) => comment.status === 'approved') : []
  };
}
