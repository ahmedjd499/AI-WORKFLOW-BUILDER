import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WorkflowService } from '../../services/workflow.service';
import { AgentService } from '../../services/agent.service';
import { PageHeadingComponent } from '../../components/page-heading/page-heading.component';
import { Agent, Workflow, WorkflowEdge, WorkflowNode } from '../../models';

@Component({
  selector: 'app-workflow-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PageHeadingComponent],
  templateUrl: './workflow-editor.component.html',
  styleUrls: ['./workflow-editor.component.scss']
})
export class WorkflowEditorComponent implements OnInit {
  private workflowService = inject(WorkflowService);
  private agentService = inject(AgentService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  workflowId = this.route.snapshot.paramMap.get('id');
  workflow = signal<Workflow | null>(null);
  nodes = signal<WorkflowNode[]>([]);
  edges = signal<WorkflowEdge[]>([]);
  agents = signal<Agent[]>([]);
  agentSearch = signal('');
  workflowName = signal('');
  selectedNode = signal<WorkflowNode | null>(null);
  saving = signal(false);
  runningWorkflow = signal(false);
  validationResult = signal<{ valid: boolean; errors: string[] } | null>(null);
  connectingFrom = signal<string | null>(null);
  manualLinkTargetId = signal('');
  selectedEdgeId = signal<string | null>(null);
  tempEdgePath = signal<string | null>(null);
  showLeftPanel = signal(false);
  showRightPanel = signal(false);
  private dragLinkSourceNodeId: string | null = null;

  private draggingNodeId: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  filteredAgents = computed(() => {
    const query = this.agentSearch().toLowerCase().trim();
    return this.agents().filter((a) => `${a.name} ${a.family}`.toLowerCase().includes(query));
  });

  selectedEdge = computed(() => this.edges().find((edge) => edge.id === this.selectedEdgeId()) ?? null);

  edgePaths = computed(() => {
    const nodeMap = new Map(this.nodes().map((n) => [n.id, n]));
    return this.edges()
      .map((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) {
          return null;
        }

        // Node width is 230px, handles are offset by Â±8px
        const x1 = source.position.x + 230 + 8;  // Output handle (right side)
        const y1 = source.position.y + 42;        // Vertical center
        const x2 = target.position.x - 8;         // Input handle (left side)
        const y2 = target.position.y + 42;        // Vertical center
        const dx = Math.max(60, Math.abs(x2 - x1) * 0.35);

        return {
          id: edge.id,
          path: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
        };
      })
      .filter((item): item is { id: string; path: string } => !!item);
  });

  ngOnInit() {
    this.agentService.getAgents({ limit: 200 }).subscribe({
      next: (response) => this.agents.set(response.data ?? []),
      error: (err) => console.error('Failed to load agents:', err)
    });

    if (this.workflowId && this.workflowId !== 'new') {
      this.workflowService.getWorkflow(this.workflowId).subscribe({
        next: (wf: Workflow) => {
          this.workflow.set(wf);
          this.nodes.set(wf.nodes ?? []);
          this.edges.set(wf.edges ?? []);
          this.workflowName.set(wf.name);
        },
        error: (err) => console.error('Failed to load workflow:', err)
      });
      return;
    }

    this.workflowName.set('Nouveau workflow');
  }

  getEventValue(event: Event): string {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
    return target?.value ?? '';
  }

  getAgentLabel(agentId: string): string {
    const agent = this.agents().find((item) => item.id === agentId);
    return agent ? `${agent.family}.${agent.name}` : agentId;
  }

  trackNode(_: number, node: WorkflowNode) {
    return node.id;
  }

  trackEdge(_: number, edge: { id: string; path: string }) {
    return edge.id;
  }

  addAgentNode(agent: Agent) {
    const index = this.nodes().length;
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}-${index}`,
      agentId: agent.id,
      label: agent.name,
      position: { x: 80 + (index % 3) * 270, y: 80 + Math.floor(index / 3) * 140 },
      config: {},
      mappingIn: {},
      mappingOut: {},
      errorPolicy: 'STOP',
      maxRetries: 0,
      backoffMs: 1000
    };

    this.nodes.update((prev) => [...prev, newNode]);
    this.selectedNode.set(newNode);
  }

  selectNode(node: WorkflowNode) {
    this.selectedNode.set(node);
    this.selectedEdgeId.set(null);
    this.manualLinkTargetId.set('');
  }

  selectEdge(edgeId: string) {
    this.selectedEdgeId.set(edgeId);
    this.selectedNode.set(null);
    this.manualLinkTargetId.set('');
  }

  removeNode(nodeId: string) {
    this.nodes.update((prev) => prev.filter((n) => n.id !== nodeId));
    this.edges.update((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (this.selectedEdge() && (this.selectedEdge()!.source === nodeId || this.selectedEdge()!.target === nodeId)) {
      this.selectedEdgeId.set(null);
    }
    if (this.selectedNode()?.id === nodeId) {
      this.selectedNode.set(null);
    }
    if (this.connectingFrom() === nodeId) {
      this.connectingFrom.set(null);
    }
  }

  startConnection(nodeId: string, event: MouseEvent) {
    event.stopPropagation();
    this.connectingFrom.set(nodeId);
  }

  completeConnection(targetNodeId: string, event: MouseEvent) {
    event.stopPropagation();
    const sourceNodeId = this.connectingFrom();
    if (!sourceNodeId || sourceNodeId === targetNodeId) {
      this.connectingFrom.set(null);
      return;
    }

    this.createConnection(sourceNodeId, targetNodeId);
    this.connectingFrom.set(null);
  }

  connectSelectedToTarget() {
    const sourceNodeId = this.selectedNode()?.id;
    const targetNodeId = this.manualLinkTargetId();
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
      return;
    }

    this.createConnection(sourceNodeId, targetNodeId);
    this.manualLinkTargetId.set('');
  }

  private createConnection(sourceNodeId: string, targetNodeId: string) {
    const edge: WorkflowEdge = {
      id: `edge-${Date.now()}`,
      source: sourceNodeId,
      target: targetNodeId
    };

    const nextEdges = [...this.edges(), edge];
    if (this.hasCycle(this.nodes(), nextEdges)) {
      this.validationResult.set({ valid: false, errors: ['Cette liaison cree une boucle.'] });
      this.connectingFrom.set(null);
      return;
    }

    const duplicate = this.edges().some((item) => item.source === sourceNodeId && item.target === targetNodeId);
    if (!duplicate) {
      this.edges.set(nextEdges);
    }
  }

  cancelConnection() {
    this.connectingFrom.set(null);
    this.selectedEdgeId.set(null);
  }

  removeEdgeById(edgeId: string) {
    this.edges.update((prev) => prev.filter((e) => e.id !== edgeId));
    if (this.selectedEdgeId() === edgeId) {
      this.selectedEdgeId.set(null);
    }
  }

  updateSelectedEdgeSource(sourceId: string) {
    const edge = this.selectedEdge();
    if (!edge || !sourceId || sourceId === edge.source) {
      return;
    }
    this.updateSelectedEdge(sourceId, edge.target);
  }

  updateSelectedEdgeTarget(targetId: string) {
    const edge = this.selectedEdge();
    if (!edge || !targetId || targetId === edge.target) {
      return;
    }
    this.updateSelectedEdge(edge.source, targetId);
  }

  private updateSelectedEdge(sourceId: string, targetId: string) {
    const edge = this.selectedEdge();
    if (!edge || sourceId === targetId) {
      this.validationResult.set({ valid: false, errors: ['Une fleche ne peut pas relier un noeud a lui-meme.'] });
      return;
    }

    const duplicate = this.edges().some((item) => item.id !== edge.id && item.source === sourceId && item.target === targetId);
    if (duplicate) {
      this.validationResult.set({ valid: false, errors: ['Cette fleche existe deja.'] });
      return;
    }

    const nextEdges = this.edges().map((item) =>
      item.id === edge.id
        ? { ...item, source: sourceId, target: targetId }
        : item
    );

    if (this.hasCycle(this.nodes(), nextEdges)) {
      this.validationResult.set({ valid: false, errors: ['Cette modification cree une boucle.'] });
      return;
    }

    this.edges.set(nextEdges);
  }

  setNodeLabel(node: WorkflowNode, event: Event) {
    const nextLabel = this.getEventValue(event);
    this.nodes.update((prev) => prev.map((item) => (item.id === node.id ? { ...item, label: nextLabel } : item)));
    this.refreshSelectedNode(node.id);
  }

  setNodeErrorPolicy(node: WorkflowNode, value: string) {
    const nextPolicy = value === 'CONTINUE' ? 'CONTINUE' : 'STOP';
    this.nodes.update((prev) => prev.map((item) => (item.id === node.id ? { ...item, errorPolicy: nextPolicy } : item)));
    this.refreshSelectedNode(node.id);
  }

  setNodeMaxRetries(node: WorkflowNode, event: Event) {
    const parsed = Number.parseInt(this.getEventValue(event), 10);
    const nextRetries = Number.isFinite(parsed) ? parsed : 0;
    this.nodes.update((prev) => prev.map((item) => (item.id === node.id ? { ...item, maxRetries: nextRetries } : item)));
    this.refreshSelectedNode(node.id);
  }

  private refreshSelectedNode(nodeId: string) {
    const updated = this.nodes().find((item) => item.id === nodeId) ?? null;
    if (updated) {
      this.selectedNode.set(updated);
    }
  }

  startDrag(nodeId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const node = this.nodes().find((item) => item.id === nodeId);
    if (!node) {
      return;
    }

    this.draggingNodeId = nodeId;
    this.dragOffsetX = event.clientX - node.position.x;
    this.dragOffsetY = event.clientY - node.position.y;
  }

  private handleNodeDrag(event: MouseEvent) {
    if (!this.draggingNodeId) {
      return;
    }

    const draggedNodeId = this.draggingNodeId;

    const x = Math.max(10, event.clientX - this.dragOffsetX);
    const y = Math.max(10, event.clientY - this.dragOffsetY - 130);

    this.nodes.update((prev) =>
      prev.map((node) =>
        node.id === draggedNodeId
          ? { ...node, position: { x, y } }
          : node
      )
    );

    if (this.selectedNode()?.id === draggedNodeId) {
      this.refreshSelectedNode(draggedNodeId);
    }
  }

  @HostListener('window:mouseup')
  onWindowMouseUp() {
    this.draggingNodeId = null;
    this.dragLinkSourceNodeId = null;
    this.tempEdgePath.set(null);
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Delete' && event.key !== 'Backspace') {
      return;
    }

    const edgeId = this.selectedEdgeId();
    if (!edgeId) {
      return;
    }

    event.preventDefault();
    this.removeEdgeById(edgeId);
  }

  startConnectionDrag(nodeId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragLinkSourceNodeId = nodeId;
    this.updateTempEdgePath(event.clientX, event.clientY);
  }

  completeConnectionDrag(nodeId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (this.dragLinkSourceNodeId && this.dragLinkSourceNodeId !== nodeId) {
      this.createConnection(this.dragLinkSourceNodeId, nodeId);
    }

    this.dragLinkSourceNodeId = null;
    this.tempEdgePath.set(null);
  }

  private updateTempEdgePath(clientX: number, clientY: number) {
    if (!this.dragLinkSourceNodeId) {
      this.tempEdgePath.set(null);
      return;
    }

    const sourceNode = this.nodes().find((n) => n.id === this.dragLinkSourceNodeId);
    if (!sourceNode) {
      this.tempEdgePath.set(null);
      return;
    }

    const canvasEl = document.querySelector('.canvas') as HTMLElement;
    if (!canvasEl) {
      return;
    }

    const canvasRect = canvasEl.getBoundingClientRect();
    const x1 = sourceNode.position.x + 230 + 8;  // Output handle offset
    const y1 = sourceNode.position.y + 42;        // Vertical center
    const x2 = clientX - canvasRect.left;
    const y2 = clientY - canvasRect.top;

    const dx = Math.max(60, Math.abs(x2 - x1) * 0.35);
    const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    this.tempEdgePath.set(path);
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMouseMove(event: MouseEvent) {
    if (this.draggingNodeId) {
      this.handleNodeDrag(event);
    }

    if (this.dragLinkSourceNodeId) {
      this.updateTempEdgePath(event.clientX, event.clientY);
    }
  }

  saveWorkflow() {
    const workflowName = this.workflowName().trim();
    if (!workflowName) {
      this.validationResult.set({ valid: false, errors: ['Le nom du workflow est obligatoire.'] });
      return;
    }

    this.saving.set(true);
    const data = {
      name: workflowName,
      nodes: this.nodes(),
      edges: this.edges()
    };

    if (this.workflowId && this.workflowId !== 'new') {
      this.workflowService.updateWorkflow(this.workflowId, data).subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/workflows']);
        },
        error: (err: any) => {
          console.error('Save failed:', err);
          this.saving.set(false);
        }
      });
      return;
    }

    this.workflowService.createWorkflow(data).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/workflows']);
      },
      error: (err: any) => {
        console.error('Save failed:', err);
        this.saving.set(false);
      }
    });
  }

  validateWorkflow() {
    const errors: string[] = [];

    if (!this.workflowName().trim()) {
      errors.push('Le nom du workflow est obligatoire.');
    }

    if (this.nodes().length === 0) {
      errors.push('Ajoutez au moins un noeud.');
    }

    const nodeIds = new Set(this.nodes().map((node) => node.id));
    for (const edge of this.edges()) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        errors.push('Une liaison pointe vers un noeud inexistant.');
        break;
      }
    }

    if (this.hasCycle(this.nodes(), this.edges())) {
      errors.push('Le workflow contient une boucle.');
    }

    this.validationResult.set({ valid: errors.length === 0, errors });
  }

  runWorkflow() {
    if (!this.workflowId || this.workflowId === 'new') {
      return;
    }

    const workflowName = this.workflowName().trim();
    if (!workflowName) {
      this.validationResult.set({ valid: false, errors: ['Le nom du workflow est obligatoire.'] });
      return;
    }

    if (this.nodes().length === 0) {
      this.validationResult.set({ valid: false, errors: ['Ajoutez au moins un noeud avant execution.'] });
      return;
    }

    if (this.hasCycle(this.nodes(), this.edges())) {
      this.validationResult.set({ valid: false, errors: ['Le workflow contient une boucle.'] });
      return;
    }

    this.runningWorkflow.set(true);
    const data = {
      name: workflowName,
      nodes: this.nodes(),
      edges: this.edges()
    };

    this.workflowService.updateWorkflow(this.workflowId, data).subscribe({
      next: () => {
        this.runningWorkflow.set(false);
        this.router.navigate(['/workflows', this.workflowId, 'run']);
      },
      error: (err: any) => {
        console.error('Run pre-save failed:', err);
        this.runningWorkflow.set(false);
        this.validationResult.set({ valid: false, errors: ['Impossible de sauvegarder avant execution.'] });
      }
    });
  }

  hasCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
    const adjacency = new Map<string, string[]>();
    nodes.forEach((node) => adjacency.set(node.id, []));
    edges.forEach((edge) => {
      const list = adjacency.get(edge.source);
      if (list) {
        list.push(edge.target);
      }
    });

    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (id: string): boolean => {
      visited.add(id);
      stack.add(id);

      for (const next of adjacency.get(id) ?? []) {
        if (!visited.has(next) && dfs(next)) {
          return true;
        }

        if (stack.has(next)) {
          return true;
        }
      }

      stack.delete(id);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id) && dfs(node.id)) {
        return true;
      }
    }

    return false;
  }

  goBack() {
    this.router.navigate(['/workflows']);
  }
}

