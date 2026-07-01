import express from 'express';
import { readDb } from '../utils/storage.js';
import { ok } from '../utils/apiResponse.js';
import { requireAuth, requirePublisher } from '../middleware/auth.js';

const router = express.Router();

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

router.get('/export', requireAuth, requirePublisher, async (req, res) => {
  const db = await readDb();
  const backup = buildBackup(db);
  const filename = `novablog-backup-${backup.exportedAt.slice(0, 10)}.json`;

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return ok(res, { backup }, 'Yedek dosyası hazırlandı');
});

export default router;
