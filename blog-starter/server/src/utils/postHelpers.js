import slugify from 'slugify';

export function makeSlug(input) {
  return slugify(input || '', { lower: true, strict: true, locale: 'tr' });
}

export function readingTime(content = '') {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

export function publicPost(post) {
  return { ...post, readingTime: readingTime(post.content) };
}
