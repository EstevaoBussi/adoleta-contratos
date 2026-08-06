import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';

// Importações do Angular Material para a interface e menu lateral
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSidenavModule,
    MatListModule
  ],
  template: `
    <mat-sidenav-container class="sidenav-container" style="height: 100vh;">
      <!-- Menu Lateral -->
      <mat-sidenav mode="side" opened style="width: 250px;">
        <mat-toolbar color="primary">Adolêta Contratos</mat-toolbar>
        <mat-nav-list>
          <a mat-list-item routerLink="/list">
            <mat-icon matListItemIcon>list</mat-icon>
            <span>Lista de Contratos</span>
          </a>
          <a mat-list-item routerLink="/new">
            <mat-icon matListItemIcon>add</mat-icon>
            <span>Novo Contrato</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <!-- Conteúdo Principal Dinâmico via Rotas -->
      <mat-sidenav-content style="padding: 20px;">
        <router-outlet></router-outlet>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `
})
export class AppComponent {}