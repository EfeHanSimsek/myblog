import express from 'express';
import crypto from 'node:crypto';
import { readDb, writeDb } from '../utils/storage.js';
import { ok, fail } from '../utils/apiResponse.js';
import { makeSlug, publicPost } from '../utils/postHelpers.js';
import { requireAuth, requirePublisher } from '../middleware/auth.js';

const router = express.Router();

function validatePost(payload) {
  if (!payload.title?.trim()) return 'Başlık zorunlu';
  if (!payload.content?.trim()) return 'İçerik zorunlu';
  if (!['draft', 'published'].includes(payload.status)) return 'Geçersiz yayın durumu';
  return null;
}

function validateComment(payload) {
  if (!payload.name?.trim()) return 'Ad zorunlu';
  if (!payload.email?.trim()) return 'E-posta zorunlu';
  if (!/^\S+@\S+\.\S+$/.test(String(payload.email))) return 'Geçerli bir e-posta gir';
  if (!payload.content?.trim()) return 'Yorum zorunlu';
  if (payload.content.trim().length < 3) return 'Yorum çok kısa';
  if (payload.content.trim().length > 1000) return 'Yorum 1000 karakteri geçemez';
  return null;
}

function normalizeDb(db) {
  if (!Array.isArray(db.comments)) db.comments = [];
  return db;
}

function publicComment(comment) {
  return {
    id: comment.id,
    postId: comment.postId,
    name: comment.name,
    content: comment.content,
    status: comment.status,
    createdAt: comment.createdAt
  };
}

function publishedPosts(db) {
  return db.posts.filter((post) => post.status === 'published');
}

function decoratePost(post, db) {
  return {
    ...publicPost(post),
    categorySlug: makeSlug(post.category || 'Genel'),
    tagSlugs: (post.tags || []).map((tag) => makeSlug(tag)),
    approvedComments: db.comments.filter((comment) => comment.postId === post.id && comment.status === 'approved').length
  };
}

router.get('/', async (req, res) => {
  const db = normalizeDb(await readDb());
  const includeDrafts = req.query.includeDrafts === 'true';
  const search = String(req.query.search || '').toLowerCase();
  const category = String(req.query.category || '').toLowerCase();
  const categorySlug = String(req.query.categorySlug || '').toLowerCase();
  const tag = String(req.query.tag || '').toLowerCase();
  const tagSlug = String(req.query.tagSlug || '').toLowerCase();

  let posts = db.posts.filter((post) => includeDrafts || post.status === 'published');
  if (search) {
    posts = posts.filter((post) => `${post.title} ${post.summary} ${post.content}`.toLowerCase().includes(search));
  }
  if (category) {
    posts = posts.filter((post) => post.category.toLowerCase() === category);
  }
  if (categorySlug) {
    posts = posts.filter((post) => makeSlug(post.category || 'Genel') === categorySlug);
  }
  if (tag) {
    posts = posts.filter((post) => (post.tags || []).some((item) => item.toLowerCase() === tag));
  }
  if (tagSlug) {
    posts = posts.filter((post) => (post.tags || []).some((item) => makeSlug(item) === tagSlug));
  }

  posts = posts
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((post) => decoratePost(post, db));

  return ok(res, { posts });
});

router.get('/facets/public', async (req, res) => {
  const db = normalizeDb(await readDb());
  const posts = publishedPosts(db);
  const categories = [...new Map(posts
    .map((post) => post.category || 'Genel')
    .filter(Boolean)
    .map((category) => [makeSlug(category), { name: category, slug: makeSlug(category), count: 0 }]))
    .values()];
  const tags = [...new Map(posts
    .flatMap((post) => post.tags || [])
    .filter(Boolean)
    .map((tagName) => [makeSlug(tagName), { name: tagName, slug: makeSlug(tagName), count: 0 }]))
    .values()];

  categories.forEach((category) => {
    category.count = posts.filter((post) => makeSlug(post.category || 'Genel') === category.slug).length;
  });
  tags.forEach((tagItem) => {
    tagItem.count = posts.filter((post) => (post.tags || []).some((postTag) => makeSlug(postTag) === tagItem.slug)).length;
  });

  return ok(res, {
    categories: categories.sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    tags: tags.sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  });
});

router.get('/stats/summary', requireAuth, requirePublisher, async (req, res) => {
  const db = normalizeDb(await readDb());
  const posts = db.posts;
  const comments = db.comments;
  return ok(res, {
    totalPosts: posts.length,
    publishedPosts: posts.filter((post) => post.status === 'published').length,
    draftPosts: posts.filter((post) => post.status === 'draft').length,
    totalViews: posts.reduce((sum, post) => sum + Number(post.views || 0), 0),
    totalComments: comments.length,
    pendingComments: comments.filter((comment) => comment.status === 'pending').length,
    approvedComments: comments.filter((comment) => comment.status === 'approved').length
  });
});

router.get('/comments/moderation', requireAuth, requirePublisher, async (req, res) => {
  const db = normalizeDb(await readDb());
  const comments = db.comments
    .map((comment) => ({
      ...comment,
      postTitle: db.posts.find((post) => post.id === comment.postId)?.title || 'Silinmiş yazı'
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return ok(res, { comments });
});

router.get('/:slug', async (req, res) => {
  const db = normalizeDb(await readDb());
  const post = db.posts.find((item) => item.slug === req.params.slug && item.status === 'published');
  if (!post) return fail(res, 404, 'Yazı bulunamadı');

  post.views = Number(post.views || 0) + 1;
  await writeDb(db);

  const comments = db.comments
    .filter((comment) => comment.postId === post.id && comment.status === 'approved')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(publicComment);

  return ok(res, { post: { ...decoratePost(post, db), comments } });
});

router.post('/:id/comments', async (req, res) => {
  const error = validateComment(req.body || {});
  if (error) return fail(res, 400, error);

  const db = normalizeDb(await readDb());
  const post = db.posts.find((item) => item.id === req.params.id && item.status === 'published');
  if (!post) return fail(res, 404, 'Yazı bulunamadı');

  const now = new Date().toISOString();
  const comment = {
    id: `c_${crypto.randomUUID()}`,
    postId: post.id,
    name: req.body.name.trim().slice(0, 80),
    email: req.body.email.trim().toLowerCase().slice(0, 160),
    content: req.body.content.trim(),
    status: 'pending',
    createdAt: now,
    updatedAt: now
  };

  db.comments.push(comment);
  await writeDb(db);
  return ok(res, { comment: publicComment(comment) }, 'Yorum onaya gönderildi');
});

router.patch('/comments/:id/status', requireAuth, requirePublisher, async (req, res) => {
  if (!['approved', 'pending', 'rejected'].includes(req.body?.status)) return fail(res, 400, 'Geçersiz yorum durumu');

  const db = normalizeDb(await readDb());
  const comment = db.comments.find((item) => item.id === req.params.id);
  if (!comment) return fail(res, 404, 'Yorum bulunamadı');

  comment.status = req.body.status;
  comment.updatedAt = new Date().toISOString();
  await writeDb(db);
  return ok(res, { comment }, 'Yorum durumu güncellendi');
});

router.delete('/comments/:id', requireAuth, requirePublisher, async (req, res) => {
  const db = normalizeDb(await readDb());
  const before = db.comments.length;
  db.comments = db.comments.filter((comment) => comment.id !== req.params.id);
  if (db.comments.length === before) return fail(res, 404, 'Yorum bulunamadı');

  await writeDb(db);
  return ok(res, null, 'Yorum silindi');
});

router.post('/', requireAuth, requirePublisher, async (req, res) => {
  const error = validatePost(req.body || {});
  if (error) return fail(res, 400, error);

  const db = normalizeDb(await readDb());
  const now = new Date().toISOString();
  const baseSlug = makeSlug(req.body.slug || req.body.title);
  const slugExists = db.posts.some((post) => post.slug === baseSlug);
  const slug = slugExists ? `${baseSlug}-${crypto.randomBytes(3).toString('hex')}` : baseSlug;

  const post = {
    id: `p_${crypto.randomUUID()}`,
    title: req.body.title.trim(),
    slug,
    summary: req.body.summary?.trim() || '',
    content: req.body.content.trim(),
    coverImage: req.body.coverImage?.trim() || '',
    altCoverImage: req.body.altCoverImage?.trim() || '',
    category: req.body.category?.trim() || 'Genel',
    tags: Array.isArray(req.body.tags) ? req.body.tags.map(String).filter(Boolean) : [],
    status: req.body.status,
    views: 0,
    authorId: req.user.id,
    createdAt: now,
    updatedAt: now
  };

  db.posts.push(post);
  await writeDb(db);
  return ok(res, { post: publicPost(post) }, 'Yazı oluşturuldu');
});

router.put('/:id', requireAuth, requirePublisher, async (req, res) => {
  const error = validatePost(req.body || {});
  if (error) return fail(res, 400, error);

  const db = normalizeDb(await readDb());
  const index = db.posts.findIndex((post) => post.id === req.params.id);
  if (index === -1) return fail(res, 404, 'Yazı bulunamadı');

  const nextSlug = makeSlug(req.body.slug || req.body.title);
  const duplicate = db.posts.some((post) => post.id !== req.params.id && post.slug === nextSlug);
  if (duplicate) return fail(res, 409, 'Bu slug başka bir yazıda kullanılıyor');

  db.posts[index] = {
    ...db.posts[index],
    title: req.body.title.trim(),
    slug: nextSlug,
    summary: req.body.summary?.trim() || '',
    content: req.body.content.trim(),
    coverImage: req.body.coverImage?.trim() || '',
    altCoverImage: req.body.altCoverImage?.trim() || '',
    category: req.body.category?.trim() || 'Genel',
    tags: Array.isArray(req.body.tags) ? req.body.tags.map(String).filter(Boolean) : [],
    status: req.body.status,
    updatedAt: new Date().toISOString()
  };

  await writeDb(db);
  return ok(res, { post: publicPost(db.posts[index]) }, 'Yazı güncellendi');
});

router.delete('/:id', requireAuth, requirePublisher, async (req, res) => {
  const db = normalizeDb(await readDb());
  const before = db.posts.length;
  db.posts = db.posts.filter((post) => post.id !== req.params.id);
  if (db.posts.length === before) return fail(res, 404, 'Yazı bulunamadı');
  db.comments = db.comments.filter((comment) => comment.postId !== req.params.id);

  await writeDb(db);
  return ok(res, null, 'Yazı silindi');
});

export default router;
