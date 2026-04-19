import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

type AppPage = {
  path: string;
  label: string;
  component: LazyExoticComponent<ComponentType>;
};

const OverviewPage = lazy(async () => {
  const mod = await import('@/pages/OverviewPage');
  return { default: mod.OverviewPage };
});

export const appPages: AppPage[] = [
  { path: '/overview', label: '总览', component: OverviewPage }
];

export const defaultRoute = '/overview';
