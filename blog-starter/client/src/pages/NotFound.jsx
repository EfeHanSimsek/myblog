import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <section className="page narrow stack not-found">
      <p className="eyebrow">404</p>
      <h1>Sayfa bulunamadı.</h1>
      <p className="notice">Aradığın içerik taşınmış, silinmiş veya hiç oluşturulmamış olabilir.</p>
      <Link className="button-link" to="/">Ana sayfaya dön</Link>
    </section>
  );
}
