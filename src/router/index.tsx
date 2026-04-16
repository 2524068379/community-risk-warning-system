import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { OverviewPage } from '@/pages/OverviewPage';
import { MonitorPage } from '@/pages/MonitorPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { ModelCenterPage } from '@/pages/ModelCenterPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: '/overview', element: <OverviewPage /> },
      { path: '/monitor', element: <MonitorPage /> },
      { path: '/alerts', element: <AlertsPage /> },
      { path: '/model-center', element: <ModelCenterPage /> }
    ]
  },
  {
    path: '*',
    element: <NotFoundPage />
  }
]);
