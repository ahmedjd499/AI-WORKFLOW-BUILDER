import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workflow-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workflow-card.component.html',
  styleUrl: './workflow-card.component.scss'
})
export class WorkflowCardComponent {
  @Input() name = '';
  @Input() status = '';
  @Input() statusClass = '';
  @Input() description = '';
  @Input() updated = '';
  @Input() tasks = 0;
}
