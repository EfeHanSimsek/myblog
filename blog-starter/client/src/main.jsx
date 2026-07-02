import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { PostDetail } from './pages/PostDetail';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AdminOps } from './pages/AdminOps';
import { AdminQuality } from './pages/AdminQuality';
import { AdminCalendar } from './pages/AdminCalendar';
import { FilteredPosts } from './pages/FilteredPosts';
import { NotFound } from './pages/NotFound';
import { isAuthenticated } from './lib/api';
import './styles.css';

function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'posts/:slug', element: <PostDetail /> },
      { path: 'kategori/:slug', element: <FilteredPosts type="category" /> },
      { path: 'etiket/:slug', element: <FilteredPosts type="tag" /> },
      { path: 'login', element: <Login /> },
      { path: 'dashboard', element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
      { path: 'dashboard/calendar', element: <ProtectedRoute><AdminCalendar /></ProtectedRoute> },
      { path: 'dashboard/quality', element: <ProtectedRoute><AdminQuality /></ProtectedRoute> },
      { path: 'dashboard/system', element: <ProtectedRoute><AdminOps /></ProtectedRoute> },
      { path: '*', element: <NotFound /> }
    ]
  }
]);

createRoot(document.getElementById('root')).render(<RouterProvider router={router} />);
