import React from 'react';
import './DashboardOverview.css';

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function getPostQualityIssues(post) {
  const issues = [];
  const wordCount = countWords(post.content);
  const seoTitleLength = String(post.seoTitle || '').trim().length;
  const seoDescriptionLength = String(post.seoDescription || '').trim().length;

  if (!String(post.title || '').trim()) issues.push('Başlık eksik');
  if (!String(post.slug || '').trim()) issues.push('Slug eksik');
  if (!String(post.summary || '').trim()) issues.push('Özet eksik');
  if (!String(post.category || '').trim()) issues.push('Kategori eksik');
  if (!post.coverImage) issues.push('Kapak görseli eksik');
  if (post.coverImage && !post.altCoverImage) issues.push('Kapak alt metni eksik');
  if (!Array.isArray(post.tags) || !post.tags.length) issues.push('Etiket eksik');
  if (wordCount < 300) issues.push('İçerik kısa');
  if (seoTitleLength < 30 || seoTitleLength > 70) issues.push('SEO başlığı zayıf');
  if (seoDescriptionLength < 90 || seoDescriptionLength > 160) issues.push('SEO açıklaması zayıf');

  return issues;
}

function getCriticalSeoIssues(post) {
  const issues = [];
  const titleLength = String(post.title || '').trim().length;
  const slugLength = String(post.slug || '').trim().length;
  const seoTitleLength = String(post.seoTitle || '').trim().length;
  const seoDescriptionLength = String(post.seoDescription || '').trim().length;

  if (!titleLength) issues.push('başlık yok');
  if (!slugLength || slugLength > 80) issues.push('slug kritik');
  if (seoTitleLength < 30 || seoTitleLength > 70) issues.push('SEO başlığı kritik');
  if (seoDescriptionLength < 90 || seoDescriptionLength > 160) issues.push('SEO açıklaması kritik');

  return issues;
}

function getPublishSafety(post) {
  const qualityIssues = getPostQualityIssues(post);
  const criticalSeoIssues = getCriticalSeoIssues(post);
  const score = Math.round(((10 - Math.min(qualityIssues.length, 10)) / 10) * 100);
  const isPublished = post.status === 'published';
  const publishedAt = post.publishedAt ? new Date(post.publishedAt).getTime() : 0;
  const isFuturePublished = isPublished && publishedAt > Date.now();
  const isReady = qualityIssues.length === 0 && criticalSeoIssues.length === 0;

  return {
    post,
    score,
    qualityIssues,
    criticalSeoIssues,
    isReady,
    isPublished,
    isFuturePublished,
    status: criticalSeoIssues.length ? 'critical' : qualityIssues.length ? 'warning' : 'ready'
  };
}

function getSortableDate(post) {
  const rawDate = post.publishedAt || post.updatedAt || post.createdAt || '';
  const date = new Date(rawDate).getTime();
  return Number.isNaN(date) ? Number.MAX_SAFE_INTEGER : date;
}

function getOverview(posts) {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const scheduled = posts
    .filter((post) => post.status === 'published' && post.publishedAt && new Date(post.publishedAt).getTime() > now)
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  const dueSoon = scheduled.filter((post) => new Date(post.publishedAt).getTime() - now <= sevenDays);
  const datedDrafts = posts.filter((post) => post.status === 'draft' && post.publishedAt);
  const unscheduledDrafts = posts.filter((post) => post.status === 'draft' && !post.publishedAt);
  const staleDrafts = unscheduledDrafts.filter((post) => {
    const date = new Date(post.updatedAt || post.createdAt || '').getTime();
    return Number.isNaN(date) ? false : now - date >= thirtyDays;
  });
  const safety = posts.map(getPublishSafety);
  const riskyPosts = safety
    .filter((item) => item.qualityIssues.length)
    .sort((a, b) => b.criticalSeoIssues.length - a.criticalSeoIssues.length || b.qualityIssues.length - a.qualityIssues.length || a.score - b.score);
  const publishedBlockers = safety.filter((item) => item.isPublished && item.criticalSeoIssues.length);
  const publishReadyDrafts = safety
    .filter((item) => item.post.status === 'draft' && item.isReady)
    .sort((a, b) => getSortableDate(a.post) - getSortableDate(b.post));
  const criticalDrafts = safety.filter((item) => item.post.status === 'draft' && item.criticalSeoIssues.length);
  const needsContent = safety.filter((item) => item.qualityIssues.includes('İçerik kısa'));
  const missingMediaMeta = safety.filter((item) => item.qualityIssues.includes('Kapak görseli eksik') || item.qualityIssues.includes('Kapak alt metni eksik'));
  const lowScorePosts = safety.filter((item) => item.score < 70).sort((a, b) => a.score - b.score);
  const seoQueue = safety
    .filter((item) => item.criticalSeoIssues.length || item.qualityIssues.some((issue) => issue.startsWith('SEO')))
    .sort((a, b) => b.criticalSeoIssues.length - a.criticalSeoIssues.length || a.score - b.score);
  const averageScore = safety.length ? Math.round(safety.reduce((total, item) => total + item.score, 0) / safety.length) : 100;

  return {
    scheduled,
    dueSoon,
    datedDrafts,
    unscheduledDrafts,
    staleDrafts,
    riskyPosts,
    readyPosts: safety.filter((item) => item.isReady).length,
    publishedBlockers,
    publishReadyDrafts,
    criticalDrafts,
    needsContent,
    missingMediaMeta,
    lowScorePosts,
    seoQueue,
    averageScore,
    nextPost: scheduled[0] || null,
    topRisk: riskyPosts[0] || null,
    safety
  };
}

const quickActions = [
  {
    href: '/dashboard#editor',
    selector: '.editor',
    label: 'Yeni yazı',
    detail: 'Editör formuna git'
  },
  {
    href: '/dashboard#media-library',
    selector: '.media-library',
    label: 'Medya ekle',
    detail: 'Medya kütüphanesine git'
  },
  {
    href: '/dashboard#backup',
    selector: '.backup-panel',
    label: 'Yedek indir',
    detail: 'JSON yedek alanına git'
  },
  {
    href: '/dashboard/quality',
    label: 'Kalite kontrol',
    detail: 'Yayın hazırlığını denetle'
  },
  {
    href: '/dashboard/seo-guard',
    label: 'SEO onarım',
    detail: 'Kritik kayıt eksiklerini gör'
  },
  {
    href: '/dashboard/calendar',
    label: 'Takvim',
    detail: 'Yayın planını gör'
  },
  {
    href: '/dashboard/system',
    label: 'Sistem',
    detail: 'Sağlık ve import alanı'
  }
];

const publishingChecklist = [
  'Başlık, slug ve kategori net mi?',
  'Özet ve SEO açıklaması özgün mü?',
  'Kapak görseli ile alt metin dolu mu?',
  'Kaynak, etiket ve yayın tarihi kontrol edildi mi?',
  'Yayınlamadan önce kalite panelinde kritik uyarı kalmadı mı?'
];

const safetyWorkflow = [
  'Önce yayındaki kritik SEO kayıtlarını kapat.',
  'Sonra hazır taslakları takvim tarihine göre sırala.',
  'Eksik medya ve kısa içerik kuyruğunu toplu düzelt.',
  'Yayına almadan önce son kez SEO Onarım filtresini kontrol et.'
];

function scrollToDashboardSection(event, selector) {
  if (!selector || window.location.pathname !== '/dashboard') return;

  const target = document.querySelector(selector);
  if (!target) return;

  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getEditorHref(post) {
  return `/dashboard?edit=${post.id}&focus=seo`;
}

export function DashboardOverview({ posts }) {
  const overview = getOverview(posts || []);
  const topSeoQueue = overview.seoQueue.slice(0, 3);
  const topReadyDrafts = overview.publishReadyDrafts.slice(0, 3);
  const topDueSoon = overview.dueSoon.slice(0, 3);
  const topLowScorePosts = overview.lowScorePosts.slice(0, 3);

  return (
    <div className="overview-grid">
      <article className="panel overview-card">
        <div className="section-heading">
          <div><p className="eyebrow">Kalite Özeti</p><h2>Yayına hazırlık</h2></div>
          <a className="row-action" href="/dashboard/quality">Kalite paneli</a>
        </div>
        <div className="quality-summary">
          <div><strong>{overview.readyPosts}</strong><span>Sorunsuz yazı</span></div>
          <div><strong>{overview.riskyPosts.length}</strong><span>Kontrol isteyen yazı</span></div>
          <div><strong>{overview.averageScore}%</strong><span>Ortalama skor</span></div>
        </div>
        {overview.topRisk ? (
          <p className="notice">Öncelik: <strong>{overview.topRisk.post.title}</strong> — {overview.topRisk.qualityIssues.slice(0, 3).join(', ')}</p>
        ) : (
          <p className="success">Tüm yazılar temel kalite kontrollerinden geçiyor.</p>
        )}
      </article>

      <article className="panel overview-card">
        <div className="section-heading">
          <div><p className="eyebrow">Takvim Özeti</p><h2>Yayın planı</h2></div>
          <a className="row-action" href="/dashboard/calendar">Takvime git</a>
        </div>
        <div className="quality-summary">
          <div><strong>{overview.scheduled.length}</strong><span>Zamanlanmış</span></div>
          <div><strong>{overview.dueSoon.length}</strong><span>7 gün içinde</span></div>
          <div><strong>{overview.unscheduledDrafts.length}</strong><span>Plansız taslak</span></div>
        </div>
        {overview.nextPost ? (
          <p className="notice">Sıradaki yayın: <strong>{overview.nextPost.title}</strong> — {formatDateTime(overview.nextPost.publishedAt)}</p>
        ) : (
          <p className="notice">Henüz zamanlanmış yayın yok.</p>
        )}
      </article>

      <article className="panel overview-card publish-safety-card">
        <div className="section-heading">
          <div><p className="eyebrow">Yayın Güvenliği</p><h2>Kritik SEO eşiği</h2></div>
          <a className="row-action" href="/dashboard/seo-guard?filter=critical">Kritikleri aç</a>
        </div>
        <div className="quality-summary">
          <div><strong>{overview.publishedBlockers.length}</strong><span>Yayında kritik</span></div>
          <div><strong>{overview.criticalDrafts.length}</strong><span>Taslak kritik</span></div>
          <div><strong>{overview.publishReadyDrafts.length}</strong><span>Hazır taslak</span></div>
        </div>
        {overview.publishedBlockers.length ? (
          <p className="error">Yayındaki içeriklerde kritik SEO eksikleri var. Önce SEO Onarım panelindeki kritik filtreyi kapat.</p>
        ) : overview.publishReadyDrafts.length ? (
          <p className="success">Yayına alınabilecek taslak var. Son kontrol için kalite paneli ve takvim tarihini kontrol et.</p>
        ) : (
          <p className="notice">Yayın öncesi kritik SEO eşiği izleniyor; eksik yazılar onarım kuyruğunda tutuluyor.</p>
        )}
      </article>

      <article className="panel overview-card decision-board-card">
        <div className="section-heading">
          <div><p className="eyebrow">Yayın Karar Masası</p><h2>Bugün ne yayınlanabilir?</h2></div>
          <a className="row-action" href="/dashboard/seo-guard?filter=ready">Hazırları aç</a>
        </div>
        <div className="quality-summary">
          <div><strong>{overview.publishReadyDrafts.length}</strong><span>Hazır taslak</span></div>
          <div><strong>{overview.datedDrafts.length}</strong><span>Tarihli taslak</span></div>
          <div><strong>{overview.staleDrafts.length}</strong><span>Eski plansız</span></div>
        </div>
        {topReadyDrafts.length ? (
          <div className="priority-list compact-priority-list">
            {topReadyDrafts.map((item) => (
              <a className="priority-item priority-ready" href={getEditorHref(item.post)} key={item.post.id}>
                <strong>{item.post.title}</strong>
                <span>{item.post.publishedAt ? `Plan: ${formatDateTime(item.post.publishedAt)}` : 'Tarih yok — yayın takvimine yerleştirilebilir.'}</span>
                <em>{item.score}%</em>
              </a>
            ))}
          </div>
        ) : (
          <p className="notice">Yayına tamamen hazır taslak yok; önce SEO ve içerik eksiği olanları kapat.</p>
        )}
      </article>

      <article className="panel overview-card schedule-risk-card">
        <div className="section-heading">
          <div><p className="eyebrow">Haftalık Takvim Riski</p><h2>Yaklaşan yayınlar</h2></div>
          <a className="row-action" href="/dashboard/calendar">Takvimi aç</a>
        </div>
        {topDueSoon.length ? (
          <div className="priority-list compact-priority-list">
            {topDueSoon.map((post) => (
              <a className="priority-item priority-ready" href={getEditorHref(post)} key={post.id}>
                <strong>{post.title}</strong>
                <span>{formatDateTime(post.publishedAt)}</span>
                <em>7g</em>
              </a>
            ))}
          </div>
        ) : (
          <p className="notice">Önümüzdeki 7 gün için zamanlanmış yayın görünmüyor. Hazır taslaklardan takvime yayın ekleyebilirsin.</p>
        )}
      </article>

      <article className="panel overview-card production-queue-card">
        <div className="section-heading">
          <div><p className="eyebrow">Üretim Kuyruğu</p><h2>Eksik iş paketleri</h2></div>
          <a className="row-action" href="/dashboard/seo-guard">Onarım kuyruğu</a>
        </div>
        <div className="quality-summary">
          <div><strong>{overview.needsContent.length}</strong><span>Kısa içerik</span></div>
          <div><strong>{overview.missingMediaMeta.length}</strong><span>Medya eksiği</span></div>
          <div><strong>{overview.seoQueue.length}</strong><span>SEO kuyruğu</span></div>
        </div>
        <p className="notice">Bu kart içerik üretiminde sıradaki toplu işleri gösterir; dış servis gerektirmez ve yerel testte yalnızca okuma/bağlantı davranışı oluşturur.</p>
      </article>

      <article className="panel overview-card batch-repair-card">
        <div className="section-heading">
          <div><p className="eyebrow">Toplu Onarım Paketleri</p><h2>En düşük skorlar</h2></div>
          <a className="row-action" href="/dashboard/quality">Kaliteye git</a>
        </div>
        {topLowScorePosts.length ? (
          <div className="priority-list compact-priority-list">
            {topLowScorePosts.map((item) => (
              <a className={`priority-item priority-${item.status}`} href={getEditorHref(item.post)} key={item.post.id}>
                <strong>{item.post.title}</strong>
                <span>{item.qualityIssues.slice(0, 3).join(', ')}</span>
                <em>{item.score}%</em>
              </a>
            ))}
          </div>
        ) : (
          <p className="success">70 altı kalite skoru olan yazı yok.</p>
        )}
      </article>

      <article className="panel overview-card seo-priority-card">
        <div className="section-heading">
          <div><p className="eyebrow">SEO Öncelik Listesi</p><h2>İlk düzeltilecekler</h2></div>
          <a className="row-action" href="/dashboard/seo-guard?filter=critical">Filtrele</a>
        </div>
        {topSeoQueue.length ? (
          <div className="priority-list">
            {topSeoQueue.map((item) => (
              <a className={`priority-item priority-${item.status}`} href={getEditorHref(item.post)} key={item.post.id}>
                <strong>{item.post.title}</strong>
                <span>{item.criticalSeoIssues.length ? item.criticalSeoIssues.join(', ') : item.qualityIssues.filter((issue) => issue.startsWith('SEO')).join(', ')}</span>
                <em>{item.score}%</em>
              </a>
            ))}
          </div>
        ) : (
          <p className="success">SEO onarım kuyruğunda kritik yazı yok.</p>
        )}
      </article>

      <article className="panel overview-card workflow-card">
        <div className="section-heading">
          <div><p className="eyebrow">Yayın Akışı</p><h2>Güvenli sıra</h2></div>
          <a className="row-action" href="/dashboard/calendar">Takvim</a>
        </div>
        <ol className="publishing-checklist compact-checklist">
          {safetyWorkflow.map((item) => <li key={item}>{item}</li>)}
        </ol>
      </article>

      <article className="panel overview-card quick-actions-card">
        <div className="section-heading">
          <div><p className="eyebrow">Hızlı Aksiyonlar</p><h2>Admin kısayolları</h2></div>
          <a className="row-action" href="/dashboard/system">Sistem</a>
        </div>
        <div className="quick-actions-grid">
          {quickActions.map((action) => (
            <a
              className="button-link quick-action-link"
              href={action.href}
              key={action.href}
              onClick={(event) => scrollToDashboardSection(event, action.selector)}
            >
              <strong>{action.label}</strong>
              <span>{action.detail}</span>
            </a>
          ))}
        </div>
        <p className="notice">Kısayollar artık doğrudan ilgili admin alanına yönlenir; yerel testte form state'ini değiştirmeden güvenli anchor geçişi sağlar.</p>
      </article>

      <article className="panel overview-card publishing-checklist-card">
        <div className="section-heading">
          <div><p className="eyebrow">İçerik Rehberi</p><h2>Yayın öncesi checklist</h2></div>
          <a className="row-action" href="/dashboard/seo-guard">SEO onarım</a>
        </div>
        <ol className="publishing-checklist">
          {publishingChecklist.map((item) => <li key={item}>{item}</li>)}
        </ol>
        <p className="notice">Yeni haber veya blog yazısı eklerken önce bu listeyi, sonra SEO onarım ve kalite panelini kontrol et.</p>
      </article>
    </div>
  );
}
