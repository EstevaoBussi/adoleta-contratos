import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="login-wrapper">
      <!-- Card de Login com a logo como fundo interno -->
      <mat-card class="login-card">
        <h2>Adolêta Kids</h2>
        <p class="subtitle">Gerenciamento de Contratos</p>
        
        <mat-form-field appearance="outline">
          <mat-label>Usuário</mat-label>
          <input matInput [(ngModel)]="username" name="username" (keyup.enter)="onLogin()">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Senha</mat-label>
          <input matInput type="password" [(ngModel)]="password" name="password" (keyup.enter)="onLogin()">
        </mat-form-field>

        <button mat-raised-button color="primary" class="login-btn" (click)="onLogin()" [disabled]="loading">
          {{ loading ? 'Entrando...' : 'Entrar' }}
        </button>
        
        <p *ngIf="error" class="error">{{error}}</p>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-wrapper {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      z-index: 9999;
      overflow: hidden;
    }

    /* Card de login com a logo como marca d'água interna */
    .login-card {
      position: relative;
      width: 100%;
      max-width: 380px;
      padding: 32px 24px;
      text-align: center;
      
      /* Adiciona a logo centralizada no fundo do card com transparência */
      background: linear-gradient(rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.92)), 
                  url('/assets/logo.jpeg') center center / 75% no-repeat !important;
      
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 16px !important;
      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15) !important;
      border: 1px solid rgba(255, 255, 255, 0.18);
    }

    .login-card h2 {
      margin: 0 0 4px 0;
      font-size: 24px;
      font-weight: 600;
      color: #333;
    }

    .subtitle {
      margin: 0 0 24px 0;
      font-size: 14px;
      color: #666;
    }

    mat-form-field {
      width: 100%;
      margin-bottom: 8px;
      background: rgba(255, 255, 255, 0.5); /* Deixa os inputs levemente translúcidos para mesclar com a logo */
      border-radius: 4px;
    }

    .login-btn {
      width: 100%;
      padding: 10px 0;
      font-size: 16px;
      margin-top: 12px;
      border-radius: 8px !important;
    }

    .error {
      color: #d32f2f;
      font-size: 14px;
      margin-top: 16px;
      background: rgba(211, 47, 47, 0.08);
      padding: 8px;
      border-radius: 4px;
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';
  loading = false;
  
  private router = inject(Router);
  private http = inject(HttpClient);

  onLogin() {
    if (!this.username || !this.password) {
      this.error = 'Preencha usuário e senha.';
      return;
    }

    this.loading = true;
    this.error = '';

    this.http.post('http://localhost:8080/api/auth/login', {
      username: this.username,
      password: this.password
    }, { responseType: 'text' }).subscribe({
      next: () => {
        localStorage.setItem('currentUser', this.username);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Usuário ou senha inválidos.';
        console.error('Erro no login:', err);
      }
    });
  }
}