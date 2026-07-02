import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import './AdminBatchSeoRepair.css';

function createSlug(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function cleanExcerpt(value, limit) {
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
    slug: String(post.slug || '').trim() || createSlug(title),
    summary: summary.length >= 60 ? post.summary : summaryBase.slice(0, 220),
    seoTitle: String(post.seoTitle || '').trim().length >= 30 ? post.seoTitle : (title || summaryBase).slice(0, 70),
    seoDescription: String(post.seoDescription || '').trim().length >= 90 ? post.seoDescription : descriptionBase.slice(0, 160),
    altCoverImage: !post.coverImage || String(post.altCoverImage || '').trim().length >= 8 ? post.altCoverImage : `${title || category || 'Blog yazısı'} kapak görseli`,
    tags: mergedTags.length >= 2 ? mergedTags : currentTags
  };
}

function getRepairPlan(post) {
  const checks = getSeoChecks(post);
  const missing = checks.filter((check) => !check.ok);
  const fixable = missing.filter((check) => check.autoFixable);
  const manual = missing.filter((check) => !check.autoFixable);
  const critical = missing.filter((check) => check.level === 'critical');
  const score = Math.round(((checks.length - missing.length) / checks.length) * 100);
  const priority = critical.length * 10 + fixable.length * 2 + manual.length;

  return {
    post,
    checks,
    missing,
    fixable,
    manual,
    critical,
    score,
    priority,
    suggestions: getSeoSuggestions(post),
    canBatchRepair: fixable.length > 0
  };
}

function buildPayload(post, suggestions) {
  return {
    ...post,
    ...suggestions,
    tags: suggestions.tags,
    publishedAt: post.publishedAt || ''
  };
}

export function AdminBatchSeoRepair() {
  const [posts, setPosts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filter, setFilter] = useState('fixable');
  const [isApplying, setIsApplying] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const data = await api('/posts?includeDrafts=true');
    setPosts(data.posts || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const plans = useMemo(() => {
    return posts
      .map(getRepairPlan)
      .sort((a, b) => b.priority - a.priority || a.score - b.score || String(a.post.title || '').localeCompare(String(b.post.title || ''), 'tr'));
  }, [posts]);

  const filteredPlans = useMemo(() => {
    if (filter === 'critical') return plans.filter((plan) => plan.critical.length);
    if (filter === 'manual') return plans.filter((plan) => plan.manual.length);
    if (filter === 'draft') return plans.filter((plan) => plan.post.status === 'draft' && plan.canBatchRepair);
    if (filter === 'published') return plans.filter((plan) => plan.post.status === 'published' && plan.canBatchRepair);
    return plans.filter((plan) => plan.canBatchRepair);
  }, [filter, plans]);

  const selectedPlans = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return plans.filter((plan) => selectedSet.has(plan.post.id) && plan.canBatchRepair);
  }, [plans, selectedIds]);

  const totals = useMemo(() => ({
    total: plans.length,
    fixable: plans.filter((plan) => plan.canBatchRepair).length,
    critical: plans.filter((plan) => plan.critical.length).length,
    manual: plans.filter((plan) => plan.manual.length).length,
    selected: selectedPlans.length
  }), [plans, selectedPlans]);

  function toggleSelected(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function selectVisible() {
    setSelectedIds(filteredPlans.filter((plan) => plan.canBatchRepair).map((plan) => plan.post.id));
  }

  function selectTopFive() {
    setSelectedIds(plans.filter((plan) => plan.canBatchRepair).slice(0, 5).map((plan) => plan.post.id));
  }

  async function applySelectedRepairs() {
    if (!selectedPlans.length) {
      setError('Toplu onarım için en az bir yazı seç.');
      return;
    }

    setIsApplying(true);
    setError('');
    setMessage('');

    try {
      for (const plan of selectedPlans) {
        await api(`/posts/${plan.post.id}`, {
          method: 'PUT',
          body: JSON.stringify(buildPayload(plan.post, plan.suggestions))
        });
      }
      setMessage(`${selectedPlans.length} yazı için güvenli SEO metadata önerileri uygulandı. İçerik uzunluğu gibi manuel işler değiştirilmedi.`);
      setSelectedIds([]);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <section className="page stack batch-seo-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Toplu SEO Onarım</p>
          <h1>Batch metadata düzeltme</h1>
        </div>
        <div className="actions compact-actions">
          <Link className="row-action" to="/dashboard/seo-guard">SEO Onarım</Link>
          <Link className="row-action" to="/dashboard">Editör</Link>
        </div>
      </div>

      <div className="stats">
        <div><strong>{totals.fixable}</strong><span>Otomatik düzeltilebilir</span></div>
        <div><strong>{totals.critical}</strong><span>Kritik eksikli</span></div>
        <div><strong>{totals.manual}</strong><span>Manuel iş isteyen</span></div>
        <div><strong>{totals.selected}</strong><span>Seçili</span></div>
        <div><strong>{totals.total}</strong><span>Toplam yazı</span></div>
      </div>

      <div className="panel batch-seo-control-panel">
        <div>
          <p className="eyebrow">Güvenli kapsam</p>
          <h2>Durum değiştirmeden metadata önerisi uygula</h2>
          <p className="notice">Bu işlem yazıyı yayına almaz, taslağı yayınlamaz, içerik metnini otomatik genişletmez. Sadece slug, özet, SEO başlığı, SEO açıklaması, kapak alt metni ve etiket gibi dış servis gerektirmeyen alanları doldurur.</p>
        </div>
        <div className="batch-seo-toolbar">
          <label>Filtre
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="fixable">Otomatik düzeltilebilir</option>
              <option value="critical">Kritik eksikli</option>
              <option value="manual">Manuel iş isteyen</option>
              <option value="draft">Taslak düzeltilebilir</option>
              <option value="published">Yayındaki düzeltilebilir</option>
            </select>
          </label>
          <button type="button" onClick={selectTopFive}>İlk 5 önceliği seç</button>
          <button type="button" onClick={selectVisible}>Görünenleri seç</button>
          <button type="button" onClick={() => setSelectedIds([])}>Seçimi temizle</button>
          <button type="button" onClick={applySelectedRepairs} disabled={isApplying || !selectedPlans.length}>{isApplying ? 'Uygulanıyor...' : 'Seçili önerileri uygula'}</button>
        </div>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="batch-seo-grid">
        {filteredPlans.map((plan) => {
          const selected = selectedIds.includes(plan.post.id);
          return (
            <article className={`panel batch-seo-card ${plan.critical.length ? 'batch-seo-critical' : 'batch-seo-warning'}`} key={plan.post.id}>
              <div className="batch-seo-card-head">
                <label className="batch-select-label">
                  <input type="checkbox" checked={selected} disabled={!plan.canBatchRepair} onChange={() => toggleSelected(plan.post.id)} />
                  <span>{plan.canBatchRepair ? 'Seç' : 'Manuel'}</span>
                </label>
                <div>
                  <strong>{plan.post.title || 'Başlıksız yazı'}</strong>
                  <span>{plan.post.status} · {plan.post.category || 'kategori yok'} · %{plan.score} hazır</span>
                </div>
                <Link className="row-action" to={`/dashboard?edit=${plan.post.id}&focus=seo`}>Editörde aç</Link>
              </div>

              <div className="batch-seo-columns">
                <div>
                  <h3>Eksikler</h3>
                  {plan.missing.length ? plan.missing.map((check) => (
                    <span className={`seo-state-pill ${check.level === 'critical' ? 'danger' : check.autoFixable ? 'warning' : 'neutral'}`} key={check.key}>{check.label}</span>
                  )) : <p className="success">Eksik yok.</p>}
                </div>
                <div>
                  <h3>Öneri önizlemesi</h3>
                  <dl className="batch-preview-list">
                    <div><dt>Slug</dt><dd>{plan.suggestions.slug || '—'}</dd></div>
                    <div><dt>SEO başlığı</dt><dd>{plan.suggestions.seoTitle || '—'}</dd></div>
                    <div><dt>SEO açıklaması</dt><dd>{plan.suggestions.seoDescription || '—'}</dd></div>
                    <div><dt>Etiket</dt><dd>{Array.isArray(plan.suggestions.tags) && plan.suggestions.tags.length ? plan.suggestions.tags.join(', ') : '—'}</dd></div>
                  </dl>
                </div>
              </div>

              {plan.manual.length > 0 && (
                <p className="notice">Manuel bırakılanlar: {plan.manual.map((check) => check.label).join(', ')}. Bu alanlar otomatik değiştirilmedi.</p>
              )}
            </article>
          );
        })}

        {!filteredPlans.length && <p className="success">Bu filtrede toplu onarım adayı yok.</p>}
      </div>
    </section>
  );
}
