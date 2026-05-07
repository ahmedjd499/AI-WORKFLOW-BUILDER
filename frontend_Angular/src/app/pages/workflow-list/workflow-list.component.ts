
import { RunService } from '../../services/run.service';
import { WorkflowService } from '../../services/workflow.service';
import { Workflow, WorkflowCreate, WorkflowNode, Agent } from '../../models';
import { AppDataService } from '../../services/app-data.service';
import { PageHeadingComponent } from '../../components/page-heading/page-heading.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';


type TemplateKey = 'summarize' | 'sentiment' | 'translate-summary' | 'weather' | 'single-agent' | 'custom-chain';

@Component({
  selector: 'app-workflow-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeadingComponent],
  templateUrl: './workflow-list.component.html',
  styleUrls: ['./workflow-list.component.scss']
})
export class WorkflowListComponent implements OnInit {
  protected readonly data = inject(AppDataService);
  protected readonly workflows = this.data.workflows;
  protected readonly agents = this.data.activeAgents;
  protected readonly error = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly showCreateForm = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly selectedStatus = signal('');
  protected readonly selectedTemplate = signal<TemplateKey>('translate-summary');
  protected readonly selectedAgentId = signal('');
  protected readonly selectedChainAgentIds = signal<string[]>([]);
  protected readonly newWorkflowName = signal('Translate then summarize');
  protected readonly runWorkflowTarget = signal<Workflow | null>(null);
  protected readonly runPrompt = signal('');
  protected readonly running = signal(false);

  protected readonly filteredWorkflows = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.selectedStatus();
    return this.workflows().filter((workflow) => {
      const matchesQuery = !query || workflow.name.toLowerCase().includes(query) || workflow.nodes.some((node) => node.label.toLowerCase().includes(query));
      const matchesStatus = !status || workflow.status === status;
      return matchesQuery && matchesStatus;
    });
  });

  protected readonly templatePreview = computed(() => this.buildWorkflowPayload(false).nodes.map((node) => node.label));
  protected readonly previewEdges = computed(() => this.buildWorkflowPayload(false).edges);

  private readonly workflowService = inject(WorkflowService);
  private readonly runService = inject(RunService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.data.loadAll();
    if (!this.selectedAgentId() && this.agents().length > 0) {
      this.selectedAgentId.set(this.agents()[0].id);
    }
  }

  protected refreshAll(): void {
    this.data.loadAll(true);
  }

  protected openCreateForm(): void {
    this.router.navigate(['/workflows', 'new', 'edit']);
  }

  protected closeCreateForm(): void {
    this.showCreateForm.set(false);
    this.creating.set(false);
  }

  protected changeTemplate(template: TemplateKey): void {
    this.selectedTemplate.set(template);
    this.syncDefaultName();
  }

  protected syncDefaultName(): void {
    const names: Record<TemplateKey, string> = {
      summarize: 'Summarize text',
      sentiment: 'Sentiment analysis',
      'translate-summary': 'Translate then summarize',
      weather: 'Weather check by city',
      'single-agent': 'Single agent workflow',
      'custom-chain': 'Custom AI chain'
    };
    this.newWorkflowName.set(names[this.selectedTemplate()]);
  }

  protected addAgentToChain(agent: Agent): void {
    this.selectedChainAgentIds.update((ids) => [...ids, agent.id]);
  }

  protected clearChain(): void {
    this.selectedChainAgentIds.set([]);
  }

  protected createWorkflow(): void {
    const payload = this.buildWorkflowPayload(true);
    if (payload.nodes.length === 0) {
      this.error.set('Aucun agent compatible trouve pour ce workflow. Verifiez la bibliotheque agents.');
      return;
    }

    this.creating.set(true);
    this.error.set(null);
    this.workflowService.createWorkflow(payload).subscribe({
      next: (createdWorkflow) => {
        this.closeCreateForm();
        this.searchQuery.set('');
        this.selectedStatus.set('');
        this.data.upsertWorkflow(createdWorkflow);
      },
      error: (err) => {
        this.creating.set(false);
        this.error.set(err?.error?.error || 'Erreur lors de la creation du workflow');
      }
    });
  }

  protected validateWorkflow(workflow: Workflow): void {
    this.workflowService.validateWorkflow(workflow.id).subscribe({
      next: (result) => {
        alert(result.valid ? 'Workflow valide et pret a executer.' : `Workflow invalide:\n${result.errors.join('\n')}`);
      },
      error: () => this.error.set('Erreur lors de la validation')
    });
  }

  protected openRunForm(workflow: Workflow): void {
    this.runWorkflowTarget.set(workflow);
    this.runPrompt.set(this.defaultPromptFor(workflow));
    this.running.set(false);
  }

  protected navigateToBuilder(workflow: Workflow): void {
    this.router.navigate(['/workflows', workflow.id, 'builder']);
  }

  protected navigateToEditor(workflow: Workflow): void {
    this.router.navigate(['/workflows', workflow.id, 'edit']);
  }

  protected navigateToPlayground(workflow: Workflow): void {
    this.router.navigate(['/workflows', workflow.id, 'run']);
  }

  protected closeRunForm(): void {
    this.runWorkflowTarget.set(null);
    this.runPrompt.set('');
    this.running.set(false);
  }

  protected submitRun(): void {
    const target = this.runWorkflowTarget();
    if (!target || !this.runPrompt().trim()) return;

    this.running.set(true);
    this.error.set(null);
    this.runService.startRun({ workflowId: target.id, prompt: this.runPrompt().trim() }).subscribe({
      next: (run) => {
        this.closeRunForm();
        this.data.refreshRuns();
        this.router.navigate(['/runs'], { queryParams: { runId: run.id } });
      },
      error: (err) => {
        this.running.set(false);
        this.error.set(err?.error?.error || 'Erreur lors du lancement de l execution');
      }
    });
  }

  protected promptExamples(): string[] {
    const target = this.runWorkflowTarget();
    if (!target) return [];
    if (this.isWeatherWorkflow(target)) return ['Tunis', 'Paris', 'London'];
    return [
      'This product is excellent. Customers love the speed and the support team is great.',
      'The delivery was late and the experience was poor, but the support team helped.',
      'Translate this feedback to English, summarize it, then extract the key sentiment.'
    ];
  }

  protected deleteWorkflow(id: string): void {
    if (confirm('Supprimer ce workflow et ses runs ?')) {
      this.workflowService.deleteWorkflow(id).subscribe({
        next: () => this.data.removeWorkflow(id),
        error: () => this.error.set('Erreur lors de la suppression')
      });
    }
  }

  protected getStatusLabel(status: string): string {
    const labels: Record<string, string> = { DRAFT: 'Brouillon', RUNNING: 'En cours', SUCCESS: 'Reussi', FAILED: 'Echoue' };
    return labels[status] || status;
  }

  protected trackWorkflow(_index: number, workflow: Workflow): string { return workflow.id; }
  protected trackNode(_index: number, node: WorkflowNode): string { return node.id; }
  protected trackAgent(_index: number, agent: Agent): string { return agent.id; }

  private findAgent(name: string): Agent | undefined {
    return this.agents().find((agent) => agent.name.toLowerCase() === name);
  }

  private findAgentById(id: string): Agent | undefined {
    return this.agents().find((agent) => agent.id === id);
  }

  private defaultPromptFor(workflow: Workflow): string {
    if (this.isWeatherWorkflow(workflow)) return 'Tunis';
    return 'This product is excellent. Customers love the speed and the support team is great.';
  }

  private isWeatherWorkflow(workflow: Workflow): boolean {
    const haystack = `${workflow.name} ${workflow.nodes.map((node) => node.label).join(' ')}`.toLowerCase();
    return haystack.includes('weather') || haystack.includes('forecast') || haystack.includes('geocode');
  }

  private buildWorkflowPayload(useFormName: boolean): WorkflowCreate {
    const name = useFormName ? this.newWorkflowName().trim() : 'preview';
    const summarize = this.findAgent('summarize');
    const sentiment = this.findAgent('sentiment');
    const translate = this.findAgent('translate');
    const geocode = this.findAgent('geocode');
    const forecast = this.findAgent('forecast');

    if (this.selectedTemplate() === 'summarize' && summarize) return this.linearWorkflow(name, [summarize], ['Summarize Text']);
    if (this.selectedTemplate() === 'sentiment' && sentiment) return this.linearWorkflow(name, [sentiment], ['Analyze Sentiment']);
    if (this.selectedTemplate() === 'translate-summary' && translate && summarize) return this.linearWorkflow(name, [translate, summarize], ['Translate to English', 'Summarize Translation']);
    if (this.selectedTemplate() === 'weather' && geocode && forecast) return this.linearWorkflow(name, [geocode, forecast], ['Geocode City', 'Get Forecast']);

    if (this.selectedTemplate() === 'custom-chain') {
      const chain = this.selectedChainAgentIds().map((id) => this.findAgentById(id)).filter((agent): agent is Agent => !!agent);
      return this.linearWorkflow(name, chain, chain.map((agent) => agent.name));
    }

    const selected = this.findAgentById(this.selectedAgentId());
    return selected ? this.linearWorkflow(name, [selected], [selected.name]) : { name, nodes: [], edges: [], variables: {} };
  }

  private linearWorkflow(name: string, agents: Agent[], labels: string[]): WorkflowCreate {
    const nodes = agents.map((agent, index) => this.node(`node-${index + 1}`, agent, labels[index] ?? agent.name, 120 + index * 360, 180, this.mappingFor(agent, index)));
    const edges = nodes.slice(1).map((node, index) => ({
      id: `edge-${index + 1}`,
      source: nodes[index].id,
      target: node.id,
      sourceHandle: 'output',
      targetHandle: 'input'
    }));
    return { name, nodes, edges, variables: {} };
  }

  private node(id: string, agent: Agent, label: string, x: number, y: number, mappingIn: Record<string, unknown>): WorkflowNode {
    return { id, agentId: agent.id, label, position: { x, y }, config: {}, mappingIn, mappingOut: {}, errorPolicy: 'STOP', maxRetries: 1, backoffMs: 1000 };
  }

  private mappingFor(agent: Agent, index: number): Record<string, unknown> {
    const source = index === 0 ? '{{prompt}}' : `{{node-${index}.result}}`;
    if (agent.name === 'geocode') return { city: source };
    if (agent.name === 'forecast') return index === 0 ? { latitude: '36.8065', longitude: '10.1815' } : { latitude: `{{node-${index}.results[0].latitude}}`, longitude: `{{node-${index}.results[0].longitude}}` };
    if (agent.name === 'translate') return { text: source, toLang: 'en' };
    if (agent.name === 'summarize') return { text: source, max_points: 3, language: 'en' };
    if (agent.name === 'sentiment') return { text: source, language: 'en' };
    const properties = (agent.schemaIn?.['properties'] ?? {}) as Record<string, unknown>;
    const key = Object.keys(properties)[0] || 'text';
    return { [key]: source };
  }
}

