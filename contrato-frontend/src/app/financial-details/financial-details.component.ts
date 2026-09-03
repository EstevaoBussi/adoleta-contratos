import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DashboardStateService } from '../services/dashboard-state.service'; // Ajuste o caminho se necessário

@Component({
  selector: 'app-financial-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <button class="btn btn-outline-secondary mb-2" (click)="goBack()">
            <span class="material-icons align-middle" style="font-size: 1.2rem;">arrow_back</span> Voltar ao Dashboard
          </button>
          <h3 class="fw-bold" style="color: #2b303b;">Composição: {{ pageTitle }}</h3>
        </div>
      </div>

      <div class="card border-0 shadow-sm bg-white p-4">
        <div *ngIf="contracts.length === 0" class="text-center py-4 text-muted">
          Nenhum contrato encontrado para esta categoria neste período.
        </div>

        <div *ngIf="contracts.length > 0" class="table-responsive">
          <table class="table table-hover align-middle">
            <thead class="table-light">
              <tr>
                <th>Cliente / Contrato</th>
                <th>Valor da Parcela</th>
                <th>Valor Total</th>
                <th>Valor Pendente</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of contracts">
                <td>
                  <strong>{{ c.client?.name || c.nomeCliente || 'Cliente' }}</strong>
                  <div class="small text-muted">Contrato: {{ c.fileName || c.id || c.codigo || 'N/D' }}</div>
                </td>
                <td>{{ getInstallmentValue(c) | currency:'BRL' }}</td>
                <td>{{ (c.event?.totalValue || c.totalValue || 0) | currency:'BRL' }}</td>
                <td class="fw-bold text-danger">
                  {{ calculatePending(c) | currency:'BRL' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class FinancialDetailsComponent implements OnInit {
  private dashboardState = inject(DashboardStateService);
  private router = inject(Router);

  pageTitle: string = '';
  contracts: any[] = [];

  ngOnInit(): void {
    this.pageTitle = this.dashboardState.getTitle();
    this.contracts = this.dashboardState.getContracts();
    
    // Se a página for recarregada direto pelo navegador e o estado zerar, volta para o dashboard
    if (!this.pageTitle) {
      this.router.navigate(['/']);
    }
  }

  getInstallmentValue(contract: any): number {
    const ev = contract.event || contract;
    return Number(ev.installmentValue || contract.installmentValue || ev.valorParcela || contract.valorParcela || 0);
  }

  calculatePending(contract: any): number {
    const ev = contract.event || contract;
    const total = Number(ev.totalValue || contract.totalValue || 0);
    const payments = contract.payments || contract.pagamentos || ev.payments || ev.pagamentos || [];
    const paid = payments.reduce((acc: number, p: any) => acc + Number(p.amount || p.valor || 0), 0);
    return Math.max(0, total - paid);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}