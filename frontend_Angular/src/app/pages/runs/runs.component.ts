import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RunService } from '../../services/run.service';
import { AppDataService } from '../../services/app-data.service';
import { PageHeadingComponent } from '../../components/page-heading/page-heading.component';
import { Run, RunStep } from '../../models';

@Component({
  selector: 'app-runs',
  standalone: true,
  imports: [CommonModule, PageHeadingComponent],
  templateUrl: './runs.component.html',
  styleUrls: ['./runs.component.scss']
})
export class RunsComponent implements OnInit, OnDestroy {
  protected readonly runs = signal<Run[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedRun = signal<Run | null>(null);

  protected readonly successRuns = computed(() => this.runs().filter((run) => run.status === 'SUCCESS').length);
  protected readonly failedRuns = computed(() => this.runs().filter((run) => run.status === 'FAILED').length);
  protected readonly activeRuns = computed(() => this.runs().filter((run) => run.status === 'PENDING' || run.status === 'RUNNING').length);

  private readonly runService = inject(RunService);
  private readonly data = inject(AppDataService);
  private readonly route = inject(ActivatedRoute);
  private pollingId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const cachedRuns = this.data.recentRuns();
    if (cachedRuns.length > 0) {
      this.runs.set(cachedRuns);
      this.loading.set(false);
    }
    this.loadRuns(this.route.snapshot.queryParamMap.get('runId'));
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  protected loadRuns(focusRunId?: string | null): void {
    this.loading.set(true);
    this.error.set(null);
    this.runService.getRuns({ limit: 50 }).subscribe({
      next: (response) => {
        this.runs.set(response.data);
        this.data.runs.set(response.data);
        this.loading.set(false);
        if (focusRunId) {
          this.openRunById(focusRunId);
        }
      },
      error: () => {
        this.error.set('Erreur lors du chargement des executions');
        this.loading.set(false);
      }
    });
  }

  protected viewRun(run: Run): void {
    this.openRunById(run.id, run);
  }

  protected closeDetails(): void {
    this.selectedRun.set(null);
    this.stopPolling();
  }

  protected getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      RUNNING: 'En cours',
      SUCCESS: 'Reussi',
      FAILED: 'Echoue',
      SKIPPED: 'Ignore'
    };
    return labels[status] || status;
  }

  protected statusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  protected durationLabel(value?: number): string {
    if (!value) {
      return '-';
    }
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
  }

  protected compactPrompt(prompt: string): string {
    return prompt.length > 95 ? `${prompt.substring(0, 95)}...` : prompt;
  }

  protected prettyJson(value: unknown): string {
    if (value === null || value === undefined) {
      return 'Aucune donnee';
    }
    return JSON.stringify(value, null, 2);
  }

  protected trackRun(_index: number, run: Run): string {
    return run.id;
  }

  protected trackStep(_index: number, step: RunStep): string {
    return step.id;
  }

  private openRunById(runId: string, fallback?: Run): void {
    this.runService.getRun(runId).subscribe({
      next: (fullRun) => {
        this.selectedRun.set(fullRun);
        if (fullRun.status === 'PENDING' || fullRun.status === 'RUNNING') {
          this.startPolling(fullRun.id);
        } else {
          this.stopPolling();
          this.refreshRunListQuietly();
        }
      },
      error: () => {
        if (fallback) {
          this.selectedRun.set(fallback);
        }
      }
    });
  }

  private startPolling(runId: string): void {
    if (this.pollingId) {
      return;
    }
    this.pollingId = setInterval(() => this.openRunById(runId), 1500);
  }

  private stopPolling(): void {
    if (this.pollingId) {
      clearInterval(this.pollingId);
      this.pollingId = null;
    }
  }

  private refreshRunListQuietly(): void {
    this.runService.getRuns({ limit: 50 }).subscribe({
      next: (response) => {
        this.runs.set(response.data);
        this.data.runs.set(response.data);
      }
    });
  }
}


