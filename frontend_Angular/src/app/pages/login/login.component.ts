import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected credentials = {
    email: '',
    password: ''
  };

  protected loading = false;
  protected readonly error = signal<string | null>(null);
  protected readonly successMsg = signal<string | null>(null);

  protected dismissError(): void {
    this.error.set(null);
  }

  protected submit(form: NgForm): void {
    if (form.valid !== true) {
      return;
    }
    this.loading = true;
    this.error.set(null);
    this.successMsg.set(null);

    this.authService.login(this.credentials).subscribe({
      next: () => {
        this.loading = false;
        this.successMsg.set('Connexion réussie ! Redirection en cours');
        setTimeout(() => this.router.navigate(['/']), 1000);
      },
      error: () => {
        this.loading = false;
        this.error.set('Email ou mot de passe incorrect. Veuillez réessayer.');
      }
    });
  }
}

