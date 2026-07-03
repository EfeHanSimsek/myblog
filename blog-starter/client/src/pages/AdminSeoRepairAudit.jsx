import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import './AdminSeoRepairAudit.css';

const FIELD_LABELS = {
  slug: 'Slug',
  summary: 'Özet',
  seoTitle: 'SEO başlığı',
  seoDescription: 'SEO açıklaması',
  altCoverImage: 'Kapak alt metni',
  tags: 'Etiketler'
};

const ROLLBACK_STATUS_LABELS = {
  restored: 'Geri alındı',
  skipped: 'Atlandı',
  error: 'Hata',
  missing: 'Bulunamadı',
  invalid: 'Geçersiz'
};

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value || '').trim() || '—';
}

function statusOf(log) {
  if (log?.rolledBackAt) return { key: 'done', label: 'Geri alınmış', className: 'locked' };
  if (log?.rollbackAvailable) return { key: 'ready', label: 'Hazır', className: 'ready' };
  return { key: 'legacy', label: 'Eski / verisiz', className: 'locked' };
}

function rollbackLabel(status) {
  return ROLLBACK_STATUS_LABELS[status] || status || 'Bilinmiyor';
}

function previewFrom(log) {
  const rows = (log?.results || []).filter((item) => item.status === 'repaired' && item.previousValues);
  const fieldTotals = rows.reduce((acc, item) => {
    (item.changedFields || []).forEach((field) => { acc[field] = (acc[field] || 0) + 1; });
    return acc;
  }, {});
  const skippedRows = (log?.results || []).filter((item) => item.status !== 'repaired');
  const rollbackResults = log?.rollbackResults || [];
  const rollbackSummary = rollbackResults.reduce((acc, item) => {
    const key = item.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const restoredResults = rollbackResults.filter((item) => item.status === 'restored');
  const skippedRollbackResults = rollbackResults.filter((item) => item.status !== 'restored');
  const rollbackRisk = !log ? 'none' : log.rolledBackAt ? 'done' : log.rollbackAvailable && rows.length ? 'safe' : 'blocked';
  return {
    rows,
    fieldTotals,
    skippedRows,
    rollbackResults,
    rollbackSummary,
    restoredResults,
    skippedRollbackResults,
    rollbackRisk,
    hiddenRows: Math.max(rows.length - 10, 0),
    hiddenRestoredRows: Math.max(restoredResults.length - 10, 0),
    hiddenSkippedRollbackRows: Math.max(skippedRollbackResults.length - 10, 0)
  };
}

function csvEscape(value) {
  const normalized = formatValue(value).replace(/\r?\n/g, ' ');
  return `"${normalized.replace(/"/g, '""')}"`;
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildCsv(log, rows) {
  const header = ['logId', 'createdAt', 'postId', 'title', 'field', 'oldValue', 'newValue'];
  const body = rows.flatMap((item) => (item.changedFields || []).map((field) => [
    log.id,
    log.createdAt,
    item.id,
    item.title || item.id,
    FIELD_LABELS[field] || field,
    item.previousValues?.[field],
    item.nextValues?.[field]
  ]));
  return [header, ...body].map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function AdminSeoRepairAudit() {
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fieldFilter, setFieldFilter] = useState('all');
  const [selectedLogId, setSelectedLogId] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [lastRollbackReport, setLastRollbackReport] = useState(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function loadLogs() {
    setError('');
    const data = await api('/seo-repair/logs');
    setLogs(data.logs || []);
  }

  async function loadLogDetail(id) {
    const data = await api(`/seo-repair/logs/${id}`);
    setSelectedLog(data.log || null);
  }

  useEffect(() => {
    loadLogs().catch((err) => setError(err.message));
  }, []);

  const fields = useMemo(() => {
    const found = new Set();
    logs.forEach((log) => Object.keys(log.changedFieldSummary || {}).forEach((field) => found.add(field)));
    return [...found].sort((a, b) => (FIELD_LABELS[a] || a).localeCompare(FIELD_LABELS[b] || b, 'tr'));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    return logs.filter((log) => {
      const state = statusOf(log).key;
      const fieldText = Object.keys(log.changedFieldSummary || {}).map((field) => FIELD_LABELS[field] || field).join(' ');
      const text = [log.id, log.createdAt, fieldText].join(' ').toLocaleLowerCase('tr-TR');
      return (statusFilter === 'all' || statusFilter === state)
        && (fieldFilter === 'all' || Boolean(log.changedFieldSummary?.[fieldFilter]))
        && (!q || text.includes(q));
    });
  }, [fieldFilter, logs, query, statusFilter]);

  const totals = useMemo(() => ({
    ready: logs.filter((log) => statusOf(log).key === 'ready').length,
    done: logs.filter((log) => statusOf(log).key === 'done').length,
    legacy: logs.filter((log) => statusOf(log).key === 'legacy').length,
    visible: filteredLogs.length,
    total: logs.length,
    exportedFields: filteredLogs.reduce((total, log) => total + Number(log.changedFieldCount || 0), 0)
  }), [filteredLogs, logs]);

  const preview = useMemo(() => previewFrom(selectedLog), [selectedLog]);
  const canRollback = Boolean(selectedLog && preview.rollbackRisk === 'safe' && !isRollingBack);

  async function openLog(log) {
    setNotice('');
    setError('');
    setLastRollbackReport(null);
    if (selectedLogId === log.id && selectedLog) {
      setSelectedLogId('');
      setSelectedLog(null);
      return;
    }
    setSelectedLogId(log.id);
    try {
      await loadLogDetail(log.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function rollbackSelectedLog() {
    if (!selectedLog || preview.rollbackRisk !== 'safe') {
      setError('Geri alma için önce previousValues taşıyan, geri alınmamış bir log seç.');
      return;
    }
    const affectedPosts = preview.rows.length;
    const affectedFields = Object.values(preview.fieldTotals).reduce((a, b) => a + b, 0);
    const confirmed = window.confirm(`${affectedPosts} yazıda ${affectedFields} SEO alanı eski değerlerine döndürülecek. Bu işlem yayın durumunu değiştirmez. Devam edilsin mi?`);
    if (!confirmed) return;
    setIsRollingBack(true);
    setNotice('');
    setError('');
    setLastRollbackReport(null);
    try {
      const data = await api(`/seo-repair/logs/${selectedLog.id}/rollback`, { method: 'POST' });
      await loadLogs();
      await loadLogDetail(selectedLog.id);
      const rollbackResults = data.rollbackResults || [];
      const restored = data.report?.restoredCount || rollbackResults.filter((item) => item.status === 'restored').length || 0;
      const skipped = data.report?.skippedCount || rollbackResults.filter((item) => item.status !== 'restored').length || 0;
      setLastRollbackReport({ restored, skipped, rollbackResults });
      setNotice(`Rollback tamamlandı. Geri alınan yazı: ${restored}, atlanan kayıt: ${skipped}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRollingBack(false);
    }
  }

  function exportSelectedCsv() {
    if (!selectedLog || !preview.rows.length) {
      setError('CSV dışa aktarma için önce geri alma verisi olan bir log seç.');
      return;
    }
    downloadText(`seo-audit-${selectedLog.id}.csv`, buildCsv(selectedLog, preview.rows), 'text/csv;charset=utf-8');
    setNotice('Seçili log CSV olarak indirildi.');
  }

  function exportSelectedJson() {
    if (!selectedLog) {
      setError('JSON dışa aktarma için önce bir log seç.');
      return;
    }
    downloadText(`seo-audit-${selectedLog.id}.json`, JSON.stringify(selectedLog, null, 2), 'application/json;charset=utf-8');
    setNotice('Seçili log JSON olarak indirildi.');
  }

  function exportVisibleSummary() {
    const payload = filteredLogs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      status: statusOf(log).label,
      repairedCount: log.repairedCount,
      skippedCount: log.skippedCount,
      changedFieldCount: log.changedFieldCount,
      changedFieldSummary: log.changedFieldSummary || {}
    }));
    downloadText('seo-audit-filtered-summary.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    setNotice('Filtrelenmiş log özeti JSON olarak indirildi.');
  }

  async function copySelectedSummary() {
    if (!selectedLog) {
      setError('Kopyalama için önce bir log seç.');
      return;
    }
    const lines = [
      `SEO batch log: ${selectedLog.id}`,
      `Tarih: ${formatDate(selectedLog.createdAt)}`,
      `Durum: ${statusOf(selectedLog).label}`,
      `Onarılan: ${selectedLog.repairedCount || 0}`,
      `Atlanan: ${selectedLog.skippedCount || 0}`,
      `Alan değişimi: ${selectedLog.changedFieldCount || 0}`,
      `Alanlar: ${Object.entries(preview.fieldTotals).map(([field, count]) => `${FIELD_LABELS[field] || field} ${count}`).join(', ') || '—'}`,
      `Rollback sonuçları: ${Object.entries(preview.rollbackSummary).map(([status, count]) => `${rollbackLabel(status)} ${count}`).join(', ') || '—'}`
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setNotice('Seçili log özeti panoya kopyalandı.');
    } catch (err) {
      setError('Tarayıcı pano izni vermedi; JSON/CSV dışa aktarmayı kullan.');
    }
  }

  return (
    <section className="page stack seo-audit-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SEO işlem denetimi</p>
          <h1>Log arama, filtreleme ve güvenli rollback</h1>
        </div>
        <div className="actions compact-actions">
          <Link className="row-action" to="/dashboard/batch-seo-repair">Toplu SEO</Link>
          <Link className="row-action" to="/dashboard/seo-guard">SEO Onarım</Link>
          <Link className="row-action" to="/dashboard">Editör</Link>
        </div>
      </div>

      <div className="stats seo-audit-stats">
        <div><strong>{totals.ready}</strong><span>Hazır log</span></div>
        <div><strong>{totals.done}</strong><span>Geri alınmış</span></div>
        <div><strong>{totals.legacy}</strong><span>Eski/verisiz</span></div>
        <div><strong>{totals.visible}</strong><span>Filtre sonucu</span></div>
        <div><strong>{totals.exportedFields}</strong><span>Görünen alan değişimi</span></div>
        <div><strong>{totals.total}</strong><span>Toplam log</span></div>
      </div>

      <div className="panel seo-audit-filter-panel">
        <div>
          <p className="eyebrow">Kontrollü denetim</p>
          <h2>Logları daralt ve etkiyi incele</h2>
          <p className="notice">Bu sayfa okuma, önizleme, dışa aktarma ve seçili log için kontrollü rollback yapar. Rollback sadece previousValues taşıyan yeni loglarda aktif olur.</p>
        </div>
        <div className="seo-audit-toolbar">
          <label>Arama<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Log ID, tarih veya alan ara" /></label>
          <label>Durum<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tümü</option><option value="ready">Hazır</option><option value="done">Geri alınmış</option><option value="legacy">Eski / verisiz</option></select></label>
          <label>Alan<select value={fieldFilter} onChange={(event) => setFieldFilter(event.target.value)}><option value="all">Tüm alanlar</option>{fields.map((field) => <option value={field} key={field}>{FIELD_LABELS[field] || field}</option>)}</select></label>
          <button type="button" onClick={() => { setQuery(''); setStatusFilter('all'); setFieldFilter('all'); }}>Temizle</button>
          <button type="button" onClick={() => loadLogs().catch((err) => setError(err.message))}>Yenile</button>
          <button type="button" onClick={exportVisibleSummary}>Görünen özeti indir</button>
        </div>
      </div>

      {notice && <p className="success">{notice}</p>}
      {error && <p className="error">{error}</p>}

      <div className="seo-audit-layout">
        <div className="panel seo-audit-log-panel">
          <div className="section-heading compact-heading"><div><p className="eyebrow">İşlem geçmişi</p><h2>Filtrelenmiş loglar</h2></div></div>
          <div className="seo-audit-log-list">
            {filteredLogs.map((log) => {
              const state = statusOf(log);
              return (
                <button className={`seo-audit-log-row ${selectedLogId === log.id ? 'active' : ''}`} type="button" onClick={() => openLog(log)} key={log.id}>
                  <strong>{formatDate(log.createdAt)}</strong>
                  <span>{log.repairedCount} onarıldı · {log.skippedCount} atlandı · {log.changedFieldCount} alan değişti</span>
                  <em className={`batch-rollback-note ${state.className}`}>{state.label}</em>
                </button>
              );
            })}
            {!filteredLogs.length && <p className="notice">Bu filtrelerle eşleşen log yok.</p>}
          </div>
        </div>

        <div className="panel seo-audit-preview-panel">
          <div className="section-heading compact-heading">
            <div><p className="eyebrow">Önizleme</p><h2>{selectedLog ? `${formatDate(selectedLog.createdAt)} işlem etkisi` : 'Log seç'}</h2></div>
          </div>

          {!selectedLog && <p className="notice">Sol listeden bir log seçince eski/yeni SEO değerleri burada görünür.</p>}

          {selectedLog && (
            <>
              <div className={`seo-audit-safety-banner seo-audit-safety-${preview.rollbackRisk}`}>
                <strong>{preview.rollbackRisk === 'safe' ? 'Geri alma önizlemesi güvenli' : preview.rollbackRisk === 'done' ? 'Bu işlem daha önce geri alınmış' : 'Geri alma verisi yok veya eksik'}</strong>
                <span>{preview.rollbackRisk === 'safe' ? 'Bu log eski/yeni değerleri taşıyor; rollback butonu yalnızca bu durumda aktiftir.' : preview.rollbackRisk === 'done' ? 'Tekrar geri alma yerine detay kayıtları denetim amacıyla görüntülenir.' : 'Eski loglarda previousValues bulunmadığı için sadece özet denetim yapılabilir.'}</span>
              </div>

              <div className="batch-report-grid seo-audit-preview-grid">
                <div><strong>{preview.rows.length}</strong><span>Etkilenen yazı</span></div>
                <div><strong>{Object.values(preview.fieldTotals).reduce((a, b) => a + b, 0)}</strong><span>Alan değişimi</span></div>
                <div><strong>{preview.skippedRows.length}</strong><span>Atlanan kayıt</span></div>
                <div><strong>{preview.rollbackResults.length}</strong><span>Geri alma sonucu</span></div>
              </div>

              <div className="seo-audit-rollback-panel">
                <div><strong>Rollback önizlemesi</strong><span>İşlem yayın durumunu değiştirmeden sadece logdaki eski SEO metadata değerlerini geri yazar.</span></div>
                <button type="button" className="danger-action" onClick={rollbackSelectedLog} disabled={!canRollback}>{isRollingBack ? 'Geri alınıyor...' : 'Bu logu geri al'}</button>
              </div>

              {(lastRollbackReport || preview.rollbackResults.length > 0) && (
                <div className="seo-audit-result-panel">
                  <div>
                    <p className="eyebrow">Rollback sonucu</p>
                    <h3>Başarılı ve atlanan kayıtlar</h3>
                  </div>
                  {lastRollbackReport && (
                    <p className="success compact-result-note">Son işlem: {lastRollbackReport.restored} geri alındı, {lastRollbackReport.skipped} atlandı.</p>
                  )}
                  <div className="seo-audit-result-summary">
                    {Object.entries(preview.rollbackSummary).map(([status, count]) => (
                      <span className={`seo-audit-result-pill result-${status}`} key={status}>{rollbackLabel(status)}: {count}</span>
                    ))}
                    {!Object.keys(preview.rollbackSummary).length && <span className="seo-audit-result-pill result-empty">Henüz kayıtlı sonuç yok</span>}
                  </div>
                  <div className="seo-audit-result-columns">
                    <div className="seo-audit-result-box success-box">
                      <strong>Başarılı geri alınanlar</strong>
                      {preview.restoredResults.slice(0, 10).map((item) => (
                        <article key={`restored-${item.id || item.postId}`}>
                          <span>{item.title || item.postTitle || item.id || item.postId}</span>
                          <em>{rollbackLabel(item.status)}</em>
                        </article>
                      ))}
                      {!preview.restoredResults.length && <p className="notice">Başarılı rollback sonucu yok.</p>}
                      {preview.hiddenRestoredRows > 0 && <p className="notice">Gizlenen başarılı kayıt: {preview.hiddenRestoredRows}</p>}
                    </div>
                    <div className="seo-audit-result-box warning-box">
                      <strong>Atlanan / hata verenler</strong>
                      {preview.skippedRollbackResults.slice(0, 10).map((item) => (
                        <article key={`skipped-${item.id || item.postId || item.reason}`}>
                          <span>{item.title || item.postTitle || item.id || item.postId || 'Kayıt'}</span>
                          <em>{rollbackLabel(item.status)}{item.reason ? ` · ${item.reason}` : ''}</em>
                        </article>
                      ))}
                      {!preview.skippedRollbackResults.length && <p className="notice">Atlanan veya hata veren rollback sonucu yok.</p>}
                      {preview.hiddenSkippedRollbackRows > 0 && <p className="notice">Gizlenen atlanan/hatalı kayıt: {preview.hiddenSkippedRollbackRows}</p>}
                    </div>
                  </div>
                </div>
              )}

              <div className="seo-audit-export-actions">
                <button type="button" onClick={exportSelectedCsv}>CSV indir</button>
                <button type="button" onClick={exportSelectedJson}>JSON indir</button>
                <button type="button" onClick={copySelectedSummary}>Özeti kopyala</button>
              </div>

              <div className="seo-audit-field-summary">
                {Object.entries(preview.fieldTotals).map(([field, count]) => <span className="seo-state-pill neutral" key={field}>{FIELD_LABELS[field] || field}: {count}</span>)}
                {!Object.keys(preview.fieldTotals).length && <p className="notice">Bu logda alan bazlı değişiklik önizlemesi yok.</p>}
              </div>

              {preview.hiddenRows > 0 && <p className="notice">Performans için ilk 10 yazı gösteriliyor. Tüm kayıtları CSV/JSON dışa aktarma ile incele. Gizlenen yazı: {preview.hiddenRows}</p>}

              <div className="seo-audit-diff-list">
                {preview.rows.slice(0, 10).map((item) => (
                  <article className="batch-diff-card" key={`${selectedLog.id}-${item.id}`}>
                    <div className="batch-diff-card-head">
                      <div><strong>{item.title || item.id}</strong><span>{(item.changedFields || []).length} alan işlem kapsamında</span></div>
                      <Link className="row-action" to={`/dashboard?edit=${item.id}&focus=seo`}>Editörde aç</Link>
                    </div>
                    <div className="batch-diff-table">
                      {(item.changedFields || []).map((field) => (
                        <div className="batch-diff-row" key={`${item.id}-${field}`}>
                          <strong>{FIELD_LABELS[field] || field}</strong>
                          <div><span>Eski değer</span><p>{formatValue(item.previousValues?.[field])}</p></div>
                          <div><span>Yeni değer</span><p>{formatValue(item.nextValues?.[field])}</p></div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
