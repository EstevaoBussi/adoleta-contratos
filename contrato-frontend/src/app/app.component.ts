import { Component, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

// Importações do Angular Material para a interface e menu lateral
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSidenavModule,
    MatListModule
  ],
  templateUrl: './app.html'
})
export class AppComponent {
  @ViewChild('drawer') drawer!: MatSidenav;
  
  // Define o modo inicial baseado no tamanho da tela (celular começa fechado/over)
  sidenavMode: 'side' | 'over' = window.innerWidth < 992 ? 'over' : 'side';
  sidenavOpened: boolean = window.innerWidth >= 992;

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    if (window.innerWidth < 992) {
      this.sidenavMode = 'over';
      this.sidenavOpened = false;
    } else {
      this.sidenavMode = 'side';
      this.sidenavOpened = true;
    }
  }

  // Fecha o menu automaticamente se estivermos em modo 'over' (celular/tablet)
  onMenuItemClick(): void {
    if (this.sidenavMode === 'over') {
      this.drawer.close();
    }
  }
}