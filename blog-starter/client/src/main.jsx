import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { PostDetail } from './pages/PostDetail';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { FilteredPosts } from './pages/FilteredPosts';
import { NotFound } from './pages/NotFound';
import './styles.css';

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
      { path: 'dashboard', element: <Dashboard /> },
      { path: '*', element: <NotFound /> }
    ]
  }
]);

createRoot(document.getElementById('root')).render(<RouterProvider router={router} />);
