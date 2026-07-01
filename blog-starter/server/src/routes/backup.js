import express from 'express';
import { readDb, snapshotDb, writeDb } from '../utils/storage.js';
import { fail, ok } from '../utils/apiResponse.js';
import { requireAuth, requirePublisher } from '../middleware/auth.js';

const router = express.Router();
const REQUIRED_ARRAYS = ['users', 'posts', 'comments', 'media'];

function buildBackup(db) {
  const exportedAt = new Date().toISOString();
  return {
    schemaVersion: 1,
    exportedAt,
    source: 'custom-backend-json-db',
    summary: {
      posts: Array.isArray(db.posts) ? db.posts.length : 0,
      users: Array.isArray(db.users) ? db.users.length : 0,
      comments: Array.isArray(db.comments) ? db.comments.length : 0,
      media: Array.isArray(db.media) ? db.media.length : 0,
      settings: db.settings ? 1 : 0
    },
    data: db
  };
}

function normalizeBackupPayload(body) {
  if (body?.backup?.data) return body.backup.data;
  if (body?.data) return body.data;
  return body;
}

function validateDbShape(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return 'Yedek verisi geçerli bir JSON obje olmalı';
  }

  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(candidate[key])) return `Yedek içinde ${key} dizisi bulunmalı`;
  }

  if (!candidate.users.length) return 'Yedek en az bir kullanıcı içermeli';

  const hasAdmin = candidate.users.some((user) => user?.role === 'admin');
  if (!hasAdmin) return 'Yedek en az bir admin kullanıcı içermeli';

  const postIds = new Set();
  for (const post of candidate.posts) {
    if (!post?.id || !post?.title || !post?.slug) return 'Her yazıda id, title ve slug alanları bulunmalı';
    if (postIds.has(post.id)) return `Tekrarlanan yazı id değeri: ${post.id}`;
    postIds.add(post.id);
  }

  return null;
}

router.get('/export', requireAuth, requirePublisher, async (req, res) => {
  const db = await readDb();
  const backup = buildBackup(db);
  const filename = `novablog-backup-${backup.exportedAt.slice(0, 10)}.json`;

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return ok(res, { backup }, 'Yedek dosyası hazırlandı');
});

router.post('/import', requireAuth, requirePublisher, async (req, res) => {
  const nextDb = normalizeBackupPayload(req.body);
  const validationError = validateDbShape(nextDb);

  if (validationError) return fail(res, 400, validationError);

  const snapshot = await snapshotDb('before-import');
  await writeDb({
    ...nextDb,
    importedAt: new Date().toISOString(),
    importedBy: req.user?.id || req.user?.email || 'unknown'
  });

  return ok(res, { snapshot }, 'Yedek içe aktarıldı');
});

export default router;
