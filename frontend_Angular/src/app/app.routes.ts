import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'workflows',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'Workflows',
        loadComponent: () => import('./pages/workflow-list/workflow-list.component').then((m) => m.WorkflowListComponent)
      },
      {
        path: ':id/builder',
        title: 'Workflow Pro',
        loadComponent: () => import('./pages/workflow-builder/workflow-builder.component').then((m) => m.WorkflowBuilderComponent)
      },
      {
        path: ':id/edit',
        title: 'Workflow Editor',
        loadComponent: () => import('./pages/workflow-editor/workflow-editor.component').then((m) => m.WorkflowEditorComponent)
      },
      {
        path: ':id/run',
        title: 'Workflow Playground',
        loadComponent: () => import('./pages/workflow-playground/workflow-playground.component').then((m) => m.WorkflowPlaygroundComponent)
      }
    ]
  },
  {
    path: 'agents',
    title: 'Agents',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/agents/agents.component').then((m) => m.AgentsComponent)
  },
  {
    path: 'runs',
    title: 'Executions',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/runs/runs.component').then((m) => m.RunsComponent)
  },
  {
    path: 'settings',
    title: 'ParamÃ¨tres',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/settings/settings.component').then((m) => m.SettingsComponent)
  },
  {
    path: 'login',
    title: 'Connexion',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];

