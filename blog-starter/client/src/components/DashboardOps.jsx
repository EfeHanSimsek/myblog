import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || '{}')));
      } catch (error) {
        reject(new Error('Seçilen dosya geçerli JSON değil.'));
      }
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsText(file, 'utf-8');
  });
}

function getBackupData(payload) {
  if (payload?.backup?.data) return payload.backup.data;
  if (payload?.data) return payload.data;
  return payload;
}

function countOf(value) {
  return Array.isArray(value) ? value.length : 0;
}

function formatDateTime(value) {
  if (!value) return 'Bilinmiyor';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Bilinmiyor';
  return date.toLocaleString('tr-TR');
}

export function DashboardOps({ onReload, onMessage, onError }) {
  const [health, setHealth] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  async function loadHealth() {
    setIsChecking(true);
    try {
      const data = await api('/health');
      setHealth(data);
    } catch (error) {
      setHealth(null);
      onError?.(error.message);
    } finally {
      setIsChecking(false);
    }
  }

  useEffect(() => { loadHealth(); }, []);

  async function exportBackup() {
    onError?.('');
    onMessage?.('');
    setIsExporting(true);

    try {
      const data = await api('/backup/export');
      const backup = data.backup || data;
      const exportedDate = backup.exportedAt ? backup.exportedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
      downloadJson(`novablog-backup-${exportedDate}.json`, backup);
      onMessage?.('Yedek dosyası indirildi.');
    } catch (error) {
      onError?.(error.message);
    } finally {
      setIsExporting(false);
    }
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    onError?.('');
    onMessage?.('');

    try {
      const backup = await readJsonFile(file);
      const data = getBackupData(backup);
      if (!data || typeof data !== 'object') throw new Error('Yedek dosyası beklenen veri yapısında değil.');

      const summary = `${countOf(data.posts)} yazı, ${countOf(data.users)} kullanıcı, ${countOf(data.comments)} yorum ve ${countOf(data.media)} medya kaydı`;
      if (!confirm(`${file.name} içe aktarılsın mı? Mevcut veriler değişir. Sunucu işlemden önce otomatik snapshot alacak.\n\nDosya özeti: ${summary}`)) return;

      setIsImporting(true);
      const result = await api('/backup/import', { method: 'POST', body: JSON.stringify({ backup }) });
      onMessage?.(`Yedek içe aktarıldı. Önceki veri snapshot olarak saklandı: ${result.snapshot?.filename || 'oluşturuldu'}.`);
      await onReload?.();
      await loadHealth();
    } catch (error) {
      onError?.(error.message);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="ops-grid">
      <div className="panel health-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Sistem</p>
            <h2>Sağlık Durumu</h2>
          </div>
          <button type="button" onClick={loadHealth} disabled={isChecking}>{isChecking ? 'Kontrol...' : 'Yenile'}</button>
        </div>
        {health ? (
          <div className="health-grid">
            <div><strong>{health.database?.status || 'ok'}</strong><span>Veritabanı</span></div>
            <div><strong>{health.database?.posts ?? 0}</strong><span>Yazı</span></div>
            <div><strong>{health.database?.users ?? 0}</strong><span>Kullanıcı</span></div>
            <div><strong>{health.database?.media ?? 0}</strong><span>Medya</span></div>
            <div><strong>{Math.round((health.uptime || 0) / 60)} dk</strong><span>Çalışma süresi</span></div>
            <div><strong>{health.environment?.node || '-'}</strong><span>Node</span></div>
          </div>
        ) : <p className="notice">Sağlık bilgisi alınamadı. API çalışıyorsa yenilemeyi deneyin.</p>}
        <p className="notice">Son kontrol: {formatDateTime(health?.checkedAt)}</p>
      </div>

      <div className="panel backup-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Yedekleme</p>
            <h2>Veri Yedeği</h2>
          </div>
        </div>
        <div className="actions">
          <button type="button" onClick={exportBackup} disabled={isExporting || isImporting}>
            {isExporting ? 'Hazırlanıyor...' : 'JSON Yedeği İndir'}
          </button>
          <label className="file-button">
            {isImporting ? 'İçe Aktarılıyor...' : 'JSON Yedeği İçe Aktar'}
            <input type="file" accept="application/json,.json" onChange={importBackup} disabled={isImporting || isExporting} />
          </label>
        </div>
        <p className="notice">Yazılar, kullanıcılar, yorumlar, medya kayıtları ve ayarlar dışa aktarılır. İçe aktarma öncesinde sunucu otomatik snapshot alır.</p>
      </div>
    </div>
  );
}
