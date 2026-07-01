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

router.get('/', async (req, res) => {
  const db = await readDb();
  const includeDrafts = req.query.includeDrafts === 'true';
  const search = String(req.query.search || '').toLowerCase();
  const category = String(req.query.category || '').toLowerCase();

  let posts = db.posts.filter((post) => includeDrafts || post.status === 'published');
  if (search) {
    posts = posts.filter((post) => `${post.title} ${post.summary} ${post.content}`.toLowerCase().includes(search));
  }
  if (category) {
    posts = posts.filter((post) => post.category.toLowerCase() === category);
  }

  posts = posts
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(publicPost);

  return ok(res, { posts });
});

router.get('/stats/summary', requireAuth, requirePublisher, async (req, res) => {
  const db = await readDb();
  const posts = db.posts;
  return ok(res, {
    totalPosts: posts.length,
    publishedPosts: posts.filter((post) => post.status === 'published').length,
    draftPosts: posts.filter((post) => post.status === 'draft').length,
    totalViews: posts.reduce((sum, post) => sum + Number(post.views || 0), 0)
  });
});

router.get('/:slug', async (req, res) => {
  const db = await readDb();
  const post = db.posts.find((item) => item.slug === req.params.slug && item.status === 'published');
  if (!post) return fail(res, 404, 'Yazı bulunamadı');

  post.views = Number(post.views || 0) + 1;
  await writeDb(db);

  return ok(res, { post: publicPost(post) });
});

router.post('/', requireAuth, requirePublisher, async (req, res) => {
  const error = validatePost(req.body || {});
  if (error) return fail(res, 400, error);

  const db = await readDb();
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

  const db = await readDb();
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
    category: req.body.category?.trim() || 'Genel',
    tags: Array.isArray(req.body.tags) ? req.body.tags.map(String).filter(Boolean) : [],
    status: req.body.status,
    updatedAt: new Date().toISOString()
  };

  await writeDb(db);
  return ok(res, { post: publicPost(db.posts[index]) }, 'Yazı güncellendi');
});

router.delete('/:id', requireAuth, requirePublisher, async (req, res) => {
  const db = await readDb();
  const before = db.posts.length;
  db.posts = db.posts.filter((post) => post.id !== req.params.id);
  if (db.posts.length === before) return fail(res, 404, 'Yazı bulunamadı');

  await writeDb(db);
  return ok(res, null, 'Yazı silindi');
});

export default router;
