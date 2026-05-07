import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SettingItem {
  label: string;
  value: string;
}

@Component({
  selector: 'app-settings-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-card.component.html',
  styleUrl: './settings-card.component.scss'
})
export class SettingsCardComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() items: SettingItem[] = [];
}
