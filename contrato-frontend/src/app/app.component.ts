import { Component, ViewChild, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

// Importações do Angular Material para a interface e menu lateral
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';

// 1. IMPORTAÇÕES NECESSÁRIAS PARA O MENU DE LOGOUT FUNCIONAR
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

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
    MatListModule,
    // 2. ADICIONE ESTES MÓDULOS AQUI NO IMPORTS DO COMPONENTE
    MatMenuModule,
    MatDividerModule
  ],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  @ViewChild('drawer') drawer!: MatSidenav;
  
  private router = inject(Router);
  isLoginRoute: boolean = false;
  
  // 3. PROPRIEDADE PARA O NOME DO USUÁRIO APARECER NO MENU
  currentUser: string = '';
  
  // Define o modo inicial baseado no tamanho da tela (celular começa fechado/over)
  sidenavMode: 'side' | 'over' = window.innerWidth < 992 ? 'over' : 'side';
  sidenavOpened: boolean = window.innerWidth >= 992;

  ngOnInit(): void {
    // Monitora as mudanças de rota para saber se estamos no login
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).forEach((event: NavigationEnd) => {
      this.isLoginRoute = event.url.includes('/login');
    });

    // Validação inicial ao carregar a página
    this.isLoginRoute = this.router.url.includes('/login');

    // Recupera o usuário logado do localStorage se houver
    const user = localStorage.getItem('currentUser');
    if (user) {
      this.currentUser = user;
    }
  }

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

  // Função de logout que limpa a sessão e redireciona
  logout() {
    localStorage.removeItem('currentUser');
    this.router.navigate(['/login']);
  }
}