import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import './AdminSeoGuard.css';

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function getSeoChecks(post) {
  const titleLength = String(post.title || '').trim().length;
  const slugLength = String(post.slug || '').trim().length;
  const summaryLength = String(post.summary || '').trim().length;
  const seoTitleLength = String(post.seoTitle || '').trim().length;
  const seoDescriptionLength = String(post.seoDescription || '').trim().length;
  const tagCount = Array.isArray(post.tags) ? post.tags.length : 0;
  const wordCount = countWords(post.content);

  return [
    {
      key: 'title',
      level: titleLength ? 'warning' : 'critical',
      ok: titleLength >= 20 && titleLength <= 80,
      label: 'Başlık',
      detail: titleLength ? `${titleLength} karakter. İdeal aralık 20-80.` : 'Başlık boş bırakılamaz.',
      fix: titleLength < 20 ? 'Başlığı daha açıklayıcı hale getir.' : titleLength > 80 ? 'Başlığı 80 karakterin altına indir.' : 'Hazır.'
    },
    {
      key: 'slug',
      level: 'critical',
      ok: slugLength > 0 && slugLength <= 80,
      label: 'Slug',
      detail: slugLength ? `${slugLength} karakterlik slug var.` : 'Slug eksik.',
      fix: 'Editörde başlıktan otomatik slug üret veya kısa, okunabilir bir slug yaz.'
    },
    {
      key: 'summary',
      level: 'warning',
      ok: summaryLength >= 60,
      label: 'Özet',
      detail: `${summaryLength} karakter. Listeleme ve paylaşım için en az 60 önerilir.`,
      fix: 'Yazının ana fikrini 1-2 özgün cümleyle özetle.'
    },
    {
      key: 'seoTitle',
      level: 'critical',
      ok: seoTitleLength >= 30 && seoTitleLength <= 70,
      label: 'SEO başlığı',
      detail: `${seoTitleLength}/70 karakter. İdeal aralık 30-70.`,
      fix: 'Ana anahtar kelimeyi içeren, tıklanabilir ama abartısız bir SEO başlığı yaz.'
    },
    {
      key: 'seoDescription',
      level: 'critical',
      ok: seoDescriptionLength >= 90 && seoDescriptionLength <= 160,
      label: 'SEO açıklaması',
      detail: `${seoDescriptionLength}/160 karakter. İdeal aralık 90-160.`,
      fix: 'Yazının faydasını ve konusunu anlatan 90-160 karakterlik özgün açıklama ekle.'
    },
    {
      key: 'coverAlt',
      level: 'warning',
      ok: !post.coverImage || String(post.altCoverImage || '').trim().length >= 8,
      label: 'Kapak alt metni',
      detail: post.coverImage ? 'Kapak görseli var; erişilebilirlik açıklaması gerekli.' : 'Kapak görseli yok.',
      fix: 'Görselde ne olduğunu tarif eden kısa ve doğal bir alt metin yaz.'
    },
    {
      key: 'tags',
      level: 'warning',
      ok: tagCount >= 2,
      label: 'Etiket',
      detail: `${tagCount} etiket. Keşif için en az 2 önerilir.`,
      fix: 'Konuyu ve alt temayı temsil eden 2-5 etiket ekle.'
    },
    {
      key: 'content',
      level: 'warning',
      ok: wordCount >= 300,
      label: 'İçerik uzunluğu',
      detail: `${wordCount} kelime. Kalıcı blog yazıları için en az 300 önerilir.`,
      fix: 'Giriş, bağlam, ana detaylar ve sonuç bölümüyle içeriği genişlet.'
    }
  ];
}

function getPostGuard(post) {
  const checks = getSeoChecks(post);
  const missing = checks.filter((check) => !check.ok);
  const critical = missing.filter((check) => check.level === 'critical');
  const warning = missing.filter((check) => check.level === 'warning');
  const score = Math.round(((checks.length - missing.length) / checks.length) * 100);
  const isPublished = post.status === 'published';
  const publishBlocked = isPublished && critical.length > 0;
  const readyToPublish = post.status === 'draft' && missing.length === 0;
  const priority = publishBlocked ? 4 : critical.length ? 3 : warning.length ? 2 : readyToPublish ? 1 : 0;

  return {
    post,
    checks,
    missing,
    critical,
    warning,
    score,
    publishBlocked,
    readyToPublish,
    priority,
    status: critical.length ? 'critical' : missing.length ? 'warning' : 'ready'
  };
}

export function AdminSeoGuard() {
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('filter') || 'needs-work');

  useEffect(() => {
    api('/posts?includeDrafts=true')
      .then((data) => setPosts(data.posts || []))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter) setStatusFilter(filter);
  }, [searchParams]);

  const guards = useMemo(() => {
    return posts
      .map(getPostGuard)
      .sort((a, b) => b.priority - a.priority || b.critical.length - a.critical.length || b.missing.length - a.missing.length || a.score - b.score);
  }, [posts]);

  const filteredGuards = useMemo(() => {
    if (statusFilter === 'critical') return guards.filter((item) => item.critical.length);
    if (statusFilter === 'published-blockers') return guards.filter((item) => item.publishBlocked);
    if (statusFilter === 'ready-to-publish') return guards.filter((item) => item.readyToPublish);
    if (statusFilter === 'ready') return guards.filter((item) => item.status === 'ready');
    if (statusFilter === 'published') return guards.filter((item) => item.post.status === 'published');
    if (statusFilter === 'draft') return guards.filter((item) => item.post.status === 'draft');
    return guards.filter((item) => item.status !== 'ready');
  }, [guards, statusFilter]);

  const criticalCount = guards.filter((item) => item.critical.length).length;
  const warningCount = guards.filter((item) => item.status === 'warning').length;
  const readyCount = guards.filter((item) => item.status === 'ready').length;
  const publishBlockedCount = guards.filter((item) => item.publishBlocked).length;
  const readyToPublishCount = guards.filter((item) => item.readyToPublish).length;
  const topPriority = guards[0];

  return (
    <section className="page stack seo-guard-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SEO Onarım</p>
          <h1>Kayıt öncesi kritik kontrol</h1>
        </div>
        <div className="actions compact-actions">
          <Link className="row-action" to="/dashboard/batch-seo-repair">Toplu SEO</Link>
          <Link className="row-action" to="/dashboard/quality">Kalite paneli</Link>
        </div>
      </div>

      <div className="stats">
        <div><strong>{criticalCount}</strong><span>Kritik yazı</span></div>
        <div><strong>{publishBlockedCount}</strong><span>Yayında engel</span></div>
        <div><strong>{warningCount}</strong><span>Uyarı alan</span></div>
        <div><strong>{readyToPublishCount}</strong><span>Yayına hazır taslak</span></div>
        <div><strong>{readyCount}</strong><span>Hazır</span></div>
        <div><strong>{posts.length}</strong><span>Toplam yazı</span></div>
      </div>

      <div className="panel seo-guard-intro">
        <div>
          <p className="eyebrow">Yayın güvenliği</p>
          <h2>Önce kritik alanları kapat</h2>
        </div>
        <p>
          Bu panel yazıları kaydetmeden veya yayına almadan önce kritik SEO eksiklerini görünür yapar. Dış servis, ödeme, CDN veya mail hesabı gerektirmez; mevcut custom backend verisini okur.
        </p>
        <p className="notice">Birden fazla yazıda aynı metadata eksiği varsa Toplu SEO sayfasından güvenli önerileri seçili yazılara batch uygulayabilirsin.</p>
        {topPriority && topPriority.status !== 'ready' && (
          <div className={`seo-priority-callout seo-priority-${topPriority.status}`}>
            <strong>İlk müdahale: {topPriority.post.title || 'Başlıksız yazı'}</strong>
            <span>{topPriority.publishBlocked ? 'Yayındaki yazıda kritik SEO engeli var.' : `${topPriority.missing.length} eksik kontrol var.`}</span>
            <Link className="row-action" to={`/dashboard?edit=${topPriority.post.id}&focus=seo`}>Öncelikli yazıyı aç</Link>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Filtre</p>
            <h2>Onarım kuyruğu</h2>
          </div>
          <select className="compact-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="needs-work">Eksik olanlar</option>
            <option value="published-blockers">Yayındaki kritikler</option>
            <option value="critical">Sadece kritik</option>
            <option value="ready-to-publish">Yayına hazır taslaklar</option>
            <option value="published">Yayındaki yazılar</option>
            <option value="draft">Taslaklar</option>
            <option value="ready">Hazır olanlar</option>
          </select>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="seo-guard-list">
          {filteredGuards.map((item) => (
            <article className={`seo-guard-card seo-guard-${item.status}`} key={item.post.id}>
              <div className="seo-guard-card-head">
                <div>
                  <strong>{item.post.title || 'Başlıksız yazı'}</strong>
                  <span>{item.post.status} · {item.post.category || 'kategori yok'} · %{item.score} hazır</span>
                </div>
                <div className="seo-guard-actions">
                  {item.publishBlocked && <span className="seo-state-pill danger">Yayında kritik</span>}
                  {item.readyToPublish && <span className="seo-state-pill success">Yayına hazır</span>}
                  <Link className="row-action" to={`/dashboard?edit=${item.post.id}&focus=seo`}>SEO eksiklerini düzelt</Link>
                </div>
              </div>

              {item.status === 'ready' ? (
                <p className="success">Bu yazı temel SEO kayıt kontrollerinden geçiyor.</p>
              ) : (
                <div className="seo-repair-grid">
                  {item.missing.map((check) => (
                    <div className={`seo-repair-item seo-repair-${check.level}`} key={check.key}>
                      <strong>{check.level === 'critical' ? 'Kritik' : 'Uyarı'} · {check.label}</strong>
                      <span>{check.detail}</span>
                      <em>{check.fix}</em>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}

          {!filteredGuards.length && <p className="success">Bu filtrede onarım gerektiren yazı yok.</p>}
        </div>
      </div>
    </section>
  );
}
