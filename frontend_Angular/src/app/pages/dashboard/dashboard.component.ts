import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpiService } from '../../services/kpi.service';
import { PageHeadingComponent } from '../../components/page-heading/page-heading.component';
import { StatCardComponent } from '../../components/stat-card/stat-card.component';
import { KpiData } from '../../models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, PageHeadingComponent, StatCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  protected readonly kpis = signal<KpiData | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private readonly kpiService = inject(KpiService);

  protected get successRateLabel(): string {
    return `${Math.round((this.kpis()?.successRate ?? 0) * 100)}%`;
  }

  protected durationLabel(value?: number): string {
    if (!value) {
      return '0 ms';
    }
    return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`;
  }

  ngOnInit(): void {
    this.kpiService.getKpis().subscribe({
      next: (data) => {
        this.kpis.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les indicateurs.');
        this.loading.set(false);
      }
    });
  }
}

