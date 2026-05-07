import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { PageHeadingComponent } from '../../components/page-heading/page-heading.component';
import { WorkflowCardComponent } from '../../components/workflow-card/workflow-card.component';

@Component({
  selector: 'app-workflows',
  standalone: true,
  imports: [CommonModule, PageHeadingComponent, WorkflowCardComponent],
  templateUrl: './workflows.component.html',
  styleUrls: ['./workflows.component.scss']
})
export class WorkflowsComponent implements OnInit {
  protected workflows: Array<any> = [];
  protected loading = true;
  protected error: string | null = null;

  private readonly api = inject(ApiService);

  get automatedCount(): number {
    return this.workflows.filter((workflow) => workflow.status?.toLowerCase() === 'success' || workflow.status?.toLowerCase() === 'actif').length;
  }

  get errorCount(): number {
    return this.workflows.filter((workflow) => workflow.status?.toLowerCase().includes('error') || workflow.status?.toLowerCase() === 'failed').length;
  }

  ngOnInit(): void {
    this.api.getWorkflows().subscribe({
      next: (response: any) => {
        const payload = response?.data ?? response;
        const list = Array.isArray(payload) ? payload : payload?.data ?? [];
        this.workflows = list.map((workflow: any) => ({
          name: workflow.name || 'Workflow inconnu',
          status: workflow.status || 'DRAFT',
          statusClass: this.getStatusClass(workflow.status),
          description: workflow.description || "Workflow importé depuis l'API.",
          updated: workflow.updatedAt ? new Date(workflow.updatedAt).toLocaleDateString('fr-FR') : '—',
          tasks: workflow.nodes?.length ?? 0
        }));
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger la liste des workflows.';
        this.loading = false;
      }
    });
  }

  private getStatusClass(status: string): string {
    if (!status) {
      return 'paused';
    }
    const normalized = status.toLowerCase();
    if (normalized === 'success' || normalized === 'actif') {
      return 'active';
    }
    if (normalized === 'failed' || normalized === 'erreur') {
      return 'error';
    }
    return 'paused';
  }
}

