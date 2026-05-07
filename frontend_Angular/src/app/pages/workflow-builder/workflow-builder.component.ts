import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WorkflowService } from '../../services/workflow.service';
import { Workflow, WorkflowNode } from '../../models';
import { PageHeadingComponent } from '../../components/page-heading/page-heading.component';

@Component({
  selector: 'app-workflow-builder',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeadingComponent],
  templateUrl: './workflow-builder.component.html',
  styleUrls: ['./workflow-builder.component.scss']
})
export class WorkflowBuilderComponent implements OnInit {
  protected readonly workflow = signal<Workflow | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly edgePaths = computed(() => {
    const wf = this.workflow();
    if (!wf) {
      return [];
    }

    const nodeMap = new Map(wf.nodes.map((node) => [node.id, node]));
    return wf.edges
      .map((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) {
          return null;
        }

        const sourceX = (source.position?.x ?? 0) + 220;
        const sourceY = (source.position?.y ?? 0) + 42;
        const targetX = target.position?.x ?? 0;
        const targetY = (target.position?.y ?? 0) + 42;
        const offset = Math.max(80, Math.abs(targetX - sourceX) / 2);
        const path = `M ${sourceX} ${sourceY} C ${sourceX + offset} ${sourceY} ${targetX - offset} ${targetY} ${targetX} ${targetY}`;
        return { path };
      })
      .filter((item): item is { path: string } => !!item);
  });

  private readonly workflowService = inject(WorkflowService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Workflow introuvable.');
      this.loading.set(false);
      return;
    }

    this.workflowService.getWorkflow(id).subscribe({
      next: (workflow) => {
        this.workflow.set(workflow);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger le workflow.');
        this.loading.set(false);
      }
    });
  }

  protected goBack(): void {
    this.router.navigate(['/workflows']);
  }

  protected getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: 'Brouillon',
      RUNNING: 'En cours',
      SUCCESS: 'Réussi',
      FAILED: 'Ã‰choué'
    };
    return labels[status] || status;
  }
}

