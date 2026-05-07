import { AgentService } from './../../services/agent.service';
import { AppDataService } from './../../services/app-data.service';
import { PageHeadingComponent } from './../../components/page-heading/page-heading.component';
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Agent } from '../../models';


@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeadingComponent],
  templateUrl: './agents.component.html',
  styleUrls: ['./agents.component.scss']
})
export class AgentsComponent implements OnInit {
  protected agents: Agent[] = [];
  protected loading = true;
  protected error: string | null = null;
  protected showCreateForm = false;
  protected editingAgent: Agent | null = null;
  protected searchQuery = '';
  protected selectedFamily = '';
  protected formData = { name: '', family: '', version: '', endpointUrl: '' };

  private readonly agentService = inject(AgentService);
  private readonly data = inject(AppDataService);

  ngOnInit(): void {
    const cachedAgents = this.data.activeAgents();
    if (cachedAgents.length > 0) {
      this.agents = cachedAgents;
      this.loading = false;
    }
    this.loadAgents();
  }

  private loadAgents(): void {
    this.loading = true;
    this.agentService.getAgents({
      search: this.searchQuery || undefined,
      family: this.selectedFamily || undefined
    }).subscribe({
      next: (response) => {
        this.agents = response.data;
        this.data.agents.set(response.data);
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur lors du chargement des agents';
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    this.loadAgents();
  }

  onFilterChange(): void {
    this.loadAgents();
  }

  editAgent(agent: Agent): void {
    this.editingAgent = agent;
    this.formData = {
      name: agent.name,
      family: agent.family,
      version: agent.version,
      endpointUrl: agent.endpointUrl
    };
    this.showCreateForm = true;
  }

  saveAgent(): void {
    const payload = {
      ...this.formData,
      schemaIn: { type: 'object', properties: { prompt: { type: 'string' } } },
      schemaOut: { type: 'object', properties: { result: { type: 'string' } } },
      tags: this.formData.family ? [this.formData.family] : []
    };

    if (this.editingAgent) {
      this.agentService.updateAgent(this.editingAgent.id, payload).subscribe({
        next: (updatedAgent) => {
          this.closeForm();
          this.agents = this.agents.map((agent) => agent.id === updatedAgent.id ? updatedAgent : agent);
          this.data.agents.set(this.agents);
        },
        error: () => this.error = 'Erreur lors de la mise à jour'
      });
    } else {
      this.agentService.createAgent(payload).subscribe({
        next: (createdAgent) => {
          this.closeForm();
          this.searchQuery = '';
          this.selectedFamily = '';
          this.agents = [createdAgent, ...this.agents.filter((agent) => agent.id !== createdAgent.id)];
          this.data.agents.set(this.agents);
        },
        error: () => this.error = 'Erreur lors de la création'
      });
    }
  }

  deleteAgent(id: string): void {
    if (confirm('ÃŠtes-vous sÃ»r de vouloir supprimer cet agent ?')) {
      this.agentService.deleteAgent(id).subscribe({
        next: () => this.loadAgents(),
        error: () => this.error = 'Erreur lors de la suppression'
      });
    }
  }

  closeForm(): void {
    this.showCreateForm = false;
    this.editingAgent = null;
    this.formData = { name: '', family: '', version: '', endpointUrl: '' };
  }
}


