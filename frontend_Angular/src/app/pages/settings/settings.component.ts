import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { PageHeadingComponent } from '../../components/page-heading/page-heading.component';
import { SettingsCardComponent, SettingItem } from '../../components/settings-card/settings-card.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, PageHeadingComponent, SettingsCardComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  private readonly auth = inject(AuthService);

  protected get cards() {
    const user = this.auth.currentUser;

    return [
      {
        title: 'Profil',
        description: "Informations de compte et identité de lâ€™utilisateur.",
        items: [
          { label: 'Email', value: user?.email ?? 'Aucun utilisateur' },
          { label: 'RÃ´le', value: user?.role ?? 'Invité' }
        ] as SettingItem[]
      },
      {
        title: 'Notifications',
        description: 'Gérez les alertes email et mobile.',
        items: [
          { label: 'Alertes workflow', value: 'Activé' },
          { label: 'Résumé quotidien', value: 'Activé' }
        ] as SettingItem[]
      },
      {
        title: 'Intégrations',
        description: 'Connectez les outils CRM, BI et stockage cloud.',
        items: [
          { label: 'CRM', value: 'Salesforce' },
          { label: 'Stockage', value: 'Azure Blob' }
        ] as SettingItem[]
      }
    ];
  }
}

