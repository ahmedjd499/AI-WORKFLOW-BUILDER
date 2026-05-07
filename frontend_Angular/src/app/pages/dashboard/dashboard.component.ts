import { PageHeadingComponent } from './../../components/page-heading/page-heading.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpiService } from '../../services/kpi.service';
import { StatCardComponent } from '../../components/stat-card/stat-card.component';
import { KpiData } from '../../models';

type TopAgent = KpiData['topAgents'][number];
type ErrorFamily = KpiData['errorsByFamily'][number];
type DurationBucket = KpiData['durationDistribution'][number];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, StatCardComponent,PageHeadingComponent],
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

  protected get topAgents(): TopAgent[] {
    return this.kpis()?.topAgents ?? [];
  }

  protected get durationDistribution(): DurationBucket[] {
    return this.kpis()?.durationDistribution ?? [];
  }

  protected get errorFamilies(): ErrorFamily[] {
    return this.kpis()?.errorsByFamily ?? [];
  }

  protected get topAgent(): TopAgent | null {
    return this.topAgents[0] ?? null;
  }

  protected get highestErrorFamily(): ErrorFamily | null {
    return this.errorFamilies.reduce<ErrorFamily | null>((current, item) => {
      if (!current || item.error_count > current.error_count) {
        return item;
      }
      return current;
    }, null);
  }

  protected get distributionPeak(): number {
    return Math.max(1, ...this.durationDistribution.map((bucket) => bucket.count));
  }

  protected durationLabel(value?: number): string {
    if (!value) {
      return '0 ms';
    }
    return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`;
  }

  protected agentSuccessLabel(agent: TopAgent): string {
    return `${Math.round(agent.successRate * 100)}%`;
  }

  protected barWidth(count: number): number {
    return Math.max(10, Math.round((count / this.distributionPeak) * 100));
  }

  protected trackByBucket(index: number, bucket: DurationBucket): string {
    return bucket.bucket;
  }

  protected trackByAgent(index: number, agent: TopAgent): string {
    return agent.id;
  }

  protected trackByFamily(index: number, family: ErrorFamily): string {
    return family.family;
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

