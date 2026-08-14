import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
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
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private contractService = inject(ContractService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  // Chaves para controle de cache separado apenas para os dados financeiros pesados
  private readonly CACHE_KEY = 'dashboard_finance_cache';
  private readonly TIMESTAMP_KEY = 'dashboard_finance_timestamp';

  // Contadores e Indicadores
  openContractsCount: number = 0;
  paidContractsCount: number = 0;
  completedContractsCount: number = 0;
  receivableThisMonth: number = 0;
  
  // Estados de carregamento separados
  loadingCounts: boolean = true;
  loadingFinance: boolean = true;

  ngOnInit(): void {
    this.loadContractCounts();
    this.loadFinanceData();
  }

  /**
   * Método 1: Busca rápida de todos os contratos apenas para preencher as quantidades por status (Sem Cache)
   */
  loadContractCounts(): void {
    this.loadingCounts = true;
    this.contractService.getAll().subscribe({
      next: (contracts: any[]) => {
        this.calculateContractCounts(contracts);
        this.loadingCounts = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar contadores de status', err);
        this.loadingCounts = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Método 2: Busca os dados detalhados para o financeiro aplicando a estratégia de cache diário
   * @param forceUpdate Se true, ignora o cache e busca direto do backend filtrando apenas abertos e com detalhes
   */
  loadFinanceData(forceUpdate: boolean = false): void {
    if (!forceUpdate) {
      const cachedData = this.getCachedData();
      if (cachedData) {
        console.log('=== USANDO DADOS FINANCEIROS DO CACHE DIÁRIO ===');
        this.calculateMonthlyReceivable(cachedData);
        this.loadingFinance = false;
        this.cdr.detectChanges();
        return;
      }
    }

    this.loadingFinance = true;
    // Busca otimizada: filtra por status ABERTO e traz os detalhes completos
    this.contractService.search(undefined, 'ABERTO', true).subscribe({
      next: (contracts: any[]) => {
        this.setCachedData(contracts);
        this.calculateMonthlyReceivable(contracts);
        this.loadingFinance = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao carregar dados financeiros do dashboard', err);
        this.loadingFinance = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Responsável por calcular a quantidade de contratos por status
   */
  private calculateContractCounts(contracts: any[]): void {
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
  }

  /**
   * Responsável por calcular o valor total a receber no mês (Regras 1 e 2)
   */
  private calculateMonthlyReceivable(contracts: any[]): void {
    let totalReceivable = 0;
    const now = new Date();
    const currentMonth = now.getMonth(); 
    const currentYear = now.getFullYear();

    if (contracts && contracts.length > 0) {
      console.log("Inspecionando primeiro contrato detalhado:", contracts[0]);
    }
    
    contracts.forEach((contract) => {
      const ev = contract.event || contract;
      let shouldAdd = false;
      let valueToAdd = 0;

      const eventDateStr = ev.eventDate || ev.dataEvento || contract.eventDate || contract.dataEvento;
      const paymentsList = contract.payments || contract.pagamentos || ev.payments || ev.pagamentos;

      // 1. Verificar data do evento no mês atual
      if (eventDateStr) {
        const cleanDateStr = typeof eventDateStr === 'string' ? eventDateStr.substring(0, 10) : eventDateStr;
        const eventDate = new Date(cleanDateStr + 'T00:00:00');

        if (!isNaN(eventDate.getTime())) {
          const eventMonth = eventDate.getMonth();
          const eventYear = eventDate.getFullYear();

          if (eventMonth === currentMonth && eventYear === currentYear) {
            shouldAdd = true;
            if (paymentsList && Array.isArray(paymentsList) && paymentsList.length > 0) {
              const sortedPayments = [...paymentsList].sort((a, b) => 
                new Date(b.paymentDate || b.data || 0).getTime() - new Date(a.paymentDate || a.data || 0).getTime()
              );
              valueToAdd = Number(sortedPayments[0].pendingAmount || sortedPayments[0].valorPendente || 0);
            } else {
              valueToAdd = Number(ev.pendingAmount || ev.valorPendente || ev.totalValue || contract.totalValue || 0);
            }
          }
        }
      }

      // 2. Verificar último pagamento há 30 dias ou mais
      if (!shouldAdd && paymentsList && Array.isArray(paymentsList) && paymentsList.length > 0) {
        const sortedPayments = [...paymentsList].sort((a, b) => 
          new Date(b.paymentDate || b.data || 0).getTime() - new Date(a.paymentDate || a.data || 0).getTime()
        );
        
        const lastPayment = sortedPayments[0];
        const lastPaymentDateStr = lastPayment.paymentDate || lastPayment.data;

        if (lastPaymentDateStr) {
          const cleanPayDateStr = typeof lastPaymentDateStr === 'string' ? lastPaymentDateStr.substring(0, 10) : lastPaymentDateStr;
          const lastPaymentDate = new Date(cleanPayDateStr + 'T00:00:00');

          if (!isNaN(lastPaymentDate.getTime())) {
            const diffTime = now.getTime() - lastPaymentDate.getTime();
            const diffDays = diffTime / (1000 * 3600 * 24);

            if (diffDays >= 30) {
              shouldAdd = true;
              valueToAdd = Number(ev.installmentValue || ev.valorParcela || contract.installmentValue || 0);
            }
          }
        }
      }

      if (shouldAdd) {
        totalReceivable += valueToAdd;
      }
    });

    console.log('=== TOTAL A RECEBER CALCULADO:', totalReceivable, '===');
    this.receivableThisMonth = totalReceivable;
  }

  /**
   * Recupera os dados financeiros do cache caso ainda seja o mesmo dia
   */
  private getCachedData(): any[] | null {
    const cachedData = localStorage.getItem(this.CACHE_KEY);
    const cachedTimestamp = localStorage.getItem(this.TIMESTAMP_KEY);
    
    if (cachedData && cachedTimestamp) {
      const today = new Date().toDateString();
      if (new Date(Number(cachedTimestamp)).toDateString() === today) {
        return JSON.parse(cachedData);
      }
    }
    return null;
  }

  /**
   * Salva os dados financeiros no cache junto com o timestamp atual
   */
  private setCachedData(data: any[]): void {
    localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(this.TIMESTAMP_KEY, Date.now().toString());
  }

  /**
   * Acionado pelo botão de atualização manual na tela (força a recarga de ambos)
   */
  onForceRefresh(): void {
    this.loadContractCounts();
    this.loadFinanceData(true);
  }
}