import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router'; // <-- Adicionado RouterModule e Router
import { ContractService } from '../services/contract.service';

// Importações do Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule, // <-- Adicionado aqui para o routerLink funcionar
    MatCardModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private contractService = inject(ContractService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router); // Injeção de dependência do Router

  // Contadores
  openContractsCount: number = 0;
  paidContractsCount: number = 0;
  completedContractsCount: number = 0;
  loading: boolean = true;

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    this.contractService.getAll().subscribe({
      next: (contracts: any[]) => {
        let open = 0;
        let paid = 0;
        let completed = 0;

        contracts.forEach(contract => {
          const status = (contract.status || '').toUpperCase();
          if (status === 'ABERTO') open++;
          else if (status === 'QUITADO') paid++;
          else if (status === 'REALIZADO') completed++;
        });

        this.openContractsCount = open;
        this.paidContractsCount = paid;
        this.completedContractsCount = completed;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar dados do dashboard', err);
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
}