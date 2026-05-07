import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppDataService } from './services/app-data.service';
import { AuthService } from './services/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  hint: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, NgIf, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly data = inject(AppDataService);
  protected readonly sidebarOpen = signal(false);
  protected readonly sidebarCollapsed = signal(false);
  private readonly mobileBreakpoint = 980;

  protected readonly navItems = computed<NavItem[]>(() => {
    if (!this.auth.isAuthenticated) {
      return [{ path: 'login', label: 'Connexion', icon: 'IN', hint: 'Acces securise' }];
    }

    return [
      { path: '', label: 'Dashboard', icon: 'DB', hint: 'Vue globale' },
      { path: 'workflows', label: 'Workflows', icon: 'WF', hint: `${this.data.workflows().length} charges` },
      { path: 'agents', label: 'Agents', icon: 'AG', hint: `${this.data.activeAgents().length} actifs` },
      { path: 'runs', label: 'Executions', icon: 'EX', hint: `${this.data.recentRuns().length} recentes` },
      { path: 'settings', label: 'Parametres', icon: 'PR', hint: 'Configuration' }
    ];
  });

  protected readonly userInitial = computed(() => {
    const email = this.auth.currentUser?.email ?? 'TekUp';
    return email.trim().charAt(0).toUpperCase();
  });

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated) {
        this.data.loadAll();
      } else {
        this.data.reset();
      }
    });
  }

  protected toggleSidebar(): void {
    if (this.isMobileViewport()) {
      this.sidebarOpen.update((open) => !open);
      return;
    }

    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  protected closeMobileSidebar(): void {
    this.sidebarOpen.set(false);
  }

  private isMobileViewport(): boolean {
    return window.matchMedia(`(max-width: ${this.mobileBreakpoint}px)`).matches;
  }

  protected logout(): void {
    this.closeMobileSidebar();
    this.auth.logout();
  }
}
