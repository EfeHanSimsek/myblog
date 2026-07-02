import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardOps } from '../components/DashboardOps';

export function AdminOps() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  return (
    <section className="page dashboard stack">
      <div>
        <p className="eyebrow">Yayımcı Paneli</p>
        <h1>Sistem ve Yedekleme</h1>
        <p className="notice"><Link to="/dashboard/calendar">İçerik takvimine git</Link></p>
      </div>
      <DashboardOps onMessage={setMessage} onError={setError} />
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
