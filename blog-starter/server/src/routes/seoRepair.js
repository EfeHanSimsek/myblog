import express from 'express';
import crypto from 'node:crypto';
import { readDb, writeDb } from '../utils/storage.js';
import { ok, fail } from '../utils/apiResponse.js';
import { requireAuth, requirePublisher } from '../middleware/auth.js';
import { makeSlug } from '../utils/postHelpers.js';

const router = express.Router();
const REPAIR_FIELDS = ['slug', 'summary', 'seoTitle', 'seoDescription', 'altCoverImage', 'tags'];

function normalizeDb(db) {
  if (!Array.isArray(db.posts)) db.posts = [];
  if (!Array.isArray(db.seoRepairLogs)) db.seoRepairLogs = [];
  return db;
}

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function cleanExcerpt(value, limit = 190) {
  return String(value || '')
    .replace(/[#>*_`\[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
    .replace(/\s+\S*$/, '')
    .trim();
}

function getSeoChecks(post) {
  const title = String(post.title || '').trim();
  const slug = String(post.slug || '').trim();
  const summary = String(post.summary || '').trim();
  const seoTitle = String(post.seoTitle || '').trim();
  const seoDescription = String(post.seoDescription || '').trim();
  const altCoverImage = String(post.altCoverImage || '').trim();
  const tagCount = Array.isArray(post.tags) ? post.tags.length : 0;
  const wordCount = countWords(post.content);

  return [
    { key: 'slug', label: 'Slug', level: 'critical', ok: slug.length > 0 && slug.length <= 80, autoFixable: Boolean(title) },
    { key: 'summary', label: 'Özet', level: 'warning', ok: summary.length >= 60, autoFixable: Boolean(title || post.content) },
    { key: 'seoTitle', label: 'SEO başlığı', level: 'critical', ok: seoTitle.length >= 30 && seoTitle.length <= 70, autoFixable: Boolean(title || summary) },
    { key: 'seoDescription', label: 'SEO açıklaması', level: 'critical', ok: seoDescription.length >= 90 && seoDescription.length <= 160, autoFixable: Boolean(summary || post.content || title) },
    { key: 'altCoverImage', label: 'Kapak alt metni', level: 'warning', ok: !post.coverImage || altCoverImage.length >= 8, autoFixable: Boolean(post.coverImage && (title || post.category)) },
    { key: 'tags', label: 'Etiket', level: 'warning', ok: tagCount >= 2, autoFixable: Boolean(title || post.category) },
    { key: 'content', label: 'İçerik uzunluğu', level: 'manual', ok: wordCount >= 300, autoFixable: false }
  ];
}

function getSeoSuggestions(post) {
  const title = String(post.title || '').trim();
  const category = String(post.category || '').trim();
  const summary = String(post.summary || '').trim();
  const contentExcerpt = cleanExcerpt(post.content, 190);
  const summaryBase = summary || contentExcerpt || (title ? `${title} hakkında kısa, anlaşılır ve güncel bir blog özeti.` : 'Bu yazı için kısa, anlaşılır ve güncel bir blog özeti.');
  const descriptionBase = String(post.seoDescription || '').trim() || summaryBase;
  const currentTags = Array.isArray(post.tags) ? post.tags : [];
  const titleTags = title
    .split(/\s+/)
    .map((word) => word.replace(/[,.!?;:]/g, '').trim())
    .filter((word) => word.length > 4)
    .slice(0, 4);
  const mergedTags = [...new Set([category, ...currentTags, ...titleTags].filter(Boolean))].slice(0, 6);

  return {
    slug: String(post.slug || '').trim() || makeSlug(title),
    summary: summary.length >= 60 ? post.summary : summaryBase.slice(0, 220),
    seoTitle: String(post.seoTitle || '').trim().length >= 30 ? post.seoTitle : (title || summaryBase).slice(0, 70),
    seoDescription: String(post.seoDescription || '').trim().length >= 90 ? post.seoDescription : descriptionBase.slice(0, 160),
    altCoverImage: !post.coverImage || String(post.altCoverImage || '').trim().length >= 8 ? post.altCoverImage : `${title || category || 'Blog yazısı'} kapak görseli`,
    tags: mergedTags.length >= 2 ? mergedTags : currentTags
  };
}

function changedFields(before, after) {
  return REPAIR_FIELDS.filter((field) => {
    if (field === 'tags') return JSON.stringify(before.tags || []) !== JSON.stringify(after.tags || []);
    return String(before[field] || '') !== String(after[field] || '');
  });
}

function pickRepairValues(post, fields = REPAIR_FIELDS) {
  return fields.reduce((acc, field) => {
    acc[field] = field === 'tags' ? [...(Array.isArray(post.tags) ? post.tags : [])] : String(post[field] || '');
    return acc;
  }, {});
}

function makeUniqueSlug(baseSlug, posts, currentId) {
  const safeBase = makeSlug(baseSlug || '') || `yazi-${crypto.randomBytes(3).toString('hex')}`;
  let candidate = safeBase;
  let counter = 2;
  while (posts.some((post) => post.id !== currentId && post.slug === candidate)) {
    candidate = `${safeBase}-${counter}`;
    counter += 1;
  }
  return candidate;
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

router.post('/batch-repair', requireAuth, requirePublisher, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map(String).filter(Boolean))] : [];
  if (!ids.length) return fail(res, 400, 'Toplu onarım için en az bir yazı seç');
  if (ids.length > 25) return fail(res, 400, 'Tek işlemde en fazla 25 yazı onarılabilir');

  const db = normalizeDb(await readDb());
  const now = new Date().toISOString();
  const results = [];
  let repairedCount = 0;
  let skippedCount = 0;
  let changedFieldCount = 0;

  ids.forEach((id) => {
    const index = db.posts.findIndex((post) => post.id === id);
    if (index === -1) {
      skippedCount += 1;
      results.push({ id, status: 'skipped', reason: 'Yazı bulunamadı', changedFields: [] });
      return;
    }

    const post = db.posts[index];
    const suggestions = getSeoSuggestions(post);
    const nextPost = {
      ...post,
      slug: makeUniqueSlug(suggestions.slug || post.slug || post.title, db.posts, post.id),
      summary: suggestions.summary || post.summary || '',
      seoTitle: suggestions.seoTitle || post.seoTitle || '',
      seoDescription: suggestions.seoDescription || post.seoDescription || '',
      altCoverImage: suggestions.altCoverImage || post.altCoverImage || '',
      tags: Array.isArray(suggestions.tags) ? suggestions.tags : (post.tags || [])
    };
    const fields = changedFields(post, nextPost);

    if (!fields.length) {
      skippedCount += 1;
      results.push({ id: post.id, title: post.title, status: 'skipped', reason: 'Değiştirilecek metadata alanı yok', changedFields: [] });
      return;
    }

    db.posts[index] = {
      ...nextPost,
      updatedAt: now
    };

    repairedCount += 1;
    changedFieldCount += fields.length;
    results.push({
      id: post.id,
      title: post.title,
      status: 'repaired',
      changedFields: fields,
      previousValues: pickRepairValues(post, fields),
      nextValues: pickRepairValues(db.posts[index], fields),
      remainingManual: getSeoChecks(db.posts[index]).filter((check) => !check.ok && !check.autoFixable).map((check) => check.label)
    });
  });

  const log = {
    id: `seo_log_${crypto.randomUUID()}`,
    createdAt: now,
    userId: req.user.id,
    requestedCount: ids.length,
    repairedCount,
    skippedCount,
    changedFieldCount,
    rollbackAvailable: repairedCount > 0,
    rollbackSchemaVersion: 1,
    results
  };

  db.seoRepairLogs.unshift(log);
  db.seoRepairLogs = db.seoRepairLogs.slice(0, 50);

  await writeDb(db);
  return ok(res, { report: log }, `${repairedCount} yazı için geri alınabilir toplu SEO onarım tamamlandı`);
});

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
