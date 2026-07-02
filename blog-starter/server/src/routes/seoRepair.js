import express from 'express';
import { readDb, writeDb } from '../utils/storage.js';
import { ok, fail } from '../utils/apiResponse.js';
import { requireAuth, requirePublisher } from '../middleware/auth.js';

const router = express.Router();
const REPAIR_FIELDS = ['slug', 'summary', 'seoTitle', 'seoDescription', 'altCoverImage', 'tags'];

function normalizeDb(db) {
  if (!Array.isArray(db.posts)) db.posts = [];
  if (!Array.isArray(db.seoRepairLogs)) db.seoRepairLogs = [];
  return db;
}

function hasRollbackData(log) {
  return Boolean(log && !log.rolledBackAt && Array.isArray(log.results) && log.results.some((item) => item.status === 'repaired' && item.previousValues));
}

function restoreValues(values = {}) {
  return REPAIR_FIELDS.reduce((acc, field) => {
    acc[field] = field === 'tags' ? (Array.isArray(values.tags) ? values.tags : []) : String(values[field] || '');
    return acc;
  }, {});
}

router.get('/logs', requireAuth, requirePublisher, async (req, res) => {
  const db = normalizeDb(await readDb());
  const logs = db.seoRepairLogs
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 25)
    .map((log) => ({
      ...log,
      rollbackAvailable: hasRollbackData(log)
    }));

  return ok(res, { logs });
});

router.post('/logs/:id/rollback', requireAuth, requirePublisher, async (req, res) => {
  const db = normalizeDb(await readDb());
  const log = db.seoRepairLogs.find((item) => item.id === req.params.id);
  if (!log) return fail(res, 404, 'SEO işlem logu bulunamadı');
  if (log.rolledBackAt) return fail(res, 409, 'Bu işlem daha önce geri alınmış');
  if (!hasRollbackData(log)) return fail(res, 400, 'Bu log için geri alma verisi yok');

  const now = new Date().toISOString();
  const rollbackResults = [];
  let restoredCount = 0;
  let skippedCount = 0;

  (log.results || []).forEach((item) => {
    if (item.status !== 'repaired' || !item.previousValues) return;
    const index = db.posts.findIndex((post) => post.id === item.id);
    if (index === -1) {
      skippedCount += 1;
      rollbackResults.push({ id: item.id, title: item.title, status: 'skipped', reason: 'Yazı bulunamadı' });
      return;
    }

    const previousSlug = String(item.previousValues.slug || '').trim();
    const duplicateSlug = previousSlug && db.posts.some((post) => post.id !== item.id && post.slug === previousSlug);
    if (duplicateSlug) {
      skippedCount += 1;
      rollbackResults.push({ id: item.id, title: item.title, status: 'skipped', reason: 'Eski slug artık başka yazıda kullanılıyor' });
      return;
    }

    db.posts[index] = {
      ...db.posts[index],
      ...restoreValues(item.previousValues),
      updatedAt: now
    };
    restoredCount += 1;
    rollbackResults.push({ id: item.id, title: item.title, status: 'restored', restoredFields: item.changedFields || REPAIR_FIELDS });
  });

  log.rolledBackAt = now;
  log.rollbackAvailable = false;
  log.rollbackResults = rollbackResults;
  log.rollbackSummary = { restoredCount, skippedCount };

  await writeDb(db);
  return ok(res, { report: { logId: log.id, restoredCount, skippedCount, rollbackResults } }, `${restoredCount} yazı için SEO batch işlemi geri alındı`);
});

export default router;
