import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ContractService } from '../services/contract.service';
import { DashboardStateService } from '../services/dashboard-state.service';

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
  private dashboardState = inject(DashboardStateService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  // Chaves para controle de cache separado apenas para os dados financeiros pesados
  private readonly CACHE_KEY = 'dashboard_finance_cache';
  private readonly TIMESTAMP_KEY = 'dashboard_finance_timestamp';

  // Contadores e Indicadores
  openContractsCount: number = 0;
  paidContractsCount: number = 0;
  completedContractsCount: number = 0;
  
  // Indicadores financeiros separados
  installmentsReceivableThisMonth: number = 0; 
  pendingReceivableThisMonth: number = 0;    

  // Listas de composição para a tela de detalhes
  contractsForInstallmentsMonth: any[] = [];
  contractsForPendingMonth: any[] = [];

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
        this.calculateFinancialMetrics(cachedData);
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
        this.calculateFinancialMetrics(contracts);
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
   * Responsável por calcular separadamente as parcelas do mês e o saldo pendente do ciclo (Dia 6 ao Dia 5)
   */
  private calculateFinancialMetrics(contracts: any[]): void {
    let totalInstallments = 0;
    let totalPendingThisMonth = 0;

    // Limpa as listas de composição a cada novo cálculo
    this.contractsForInstallmentsMonth = [];
    this.contractsForPendingMonth = [];

    const now = new Date();

    // Definição do ciclo do mês atual (do dia 6 do mês atual até o dia 5 do mês seguinte)
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const dayToday = now.getDate();

    let startCycleDate: Date;
    let endCycleDate: Date;

    if (dayToday >= 6) {
      startCycleDate = new Date(currentYear, currentMonth, 6, 0, 0, 0);
      endCycleDate = new Date(currentYear, currentMonth + 1, 5, 23, 59, 59);
    } else {
      startCycleDate = new Date(currentYear, currentMonth - 1, 6, 0, 0, 0);
      endCycleDate = new Date(currentYear, currentMonth, 5, 23, 59, 59);
    }

    contracts.forEach((contract) => {
      const ev = contract.event || contract;
      
      // 1. Cálculo real do Saldo Pendente (Contrato - Pagamentos)
      const totalContractValue = Number(ev.totalValue || contract.totalValue || 0);
      const paymentsList = contract.payments || contract.pagamentos || ev.payments || ev.pagamentos || [];
      const totalPaid = paymentsList.reduce((acc: number, p: any) => 
        acc + Number(p.amount || p.valor || 0), 0);
      
      const realPendingAmount = Math.max(0, totalContractValue - totalPaid);

      // Se já estiver quitado/zerado, pula para o próximo
      if (realPendingAmount <= 0) return;

      // 2. Verificação da Data do Evento
      const eventDateStr = ev.eventDate || ev.dataEvento || contract.eventDate || contract.dataEvento;
      const eventDate = eventDateStr ? new Date(eventDateStr.substring(0, 10) + 'T00:00:00') : null;

      // Verifica se o evento está dentro do ciclo do mês (Dia 6 ao Dia 5)
      const isEventInCurrentCycle = eventDate && eventDate >= startCycleDate && eventDate <= endCycleDate;

      // 3. Verificação do Último Pagamento dentro do ciclo atual (Dia 6 ao Dia 5)
      let installmentAlreadyPaidInCycle = false;
      if (paymentsList.length > 0) {
        const sortedPayments = [...paymentsList].sort((a, b) => 
          new Date(b.paymentDate || b.data || 0).getTime() - new Date(a.paymentDate || a.data || 0).getTime()
        );
        const lastPaymentDateStr = sortedPayments[0].paymentDate || sortedPayments[0].data || 0;
        const lastPaymentDate = new Date(lastPaymentDateStr);

        if (lastPaymentDate >= startCycleDate && lastPaymentDate <= endCycleDate) {
          installmentAlreadyPaidInCycle = true;
        }
      }

      // A) Saldo Pendente do Mês: Soma se o evento estiver no ciclo do mês atual
      if (isEventInCurrentCycle) {
        totalPendingThisMonth += realPendingAmount;
        this.contractsForPendingMonth.push(contract);
      }

      // B) Parcelas a Receber no Mês: 
      // Compõe com todos os contratos que não pagaram no ciclo e cujo evento não cai no saldo pendente do mês
      if (!isEventInCurrentCycle && !installmentAlreadyPaidInCycle) {
        const valorParcela = Number(ev.installmentValue || ev.valorParcela || 0);
        totalInstallments += Math.min(valorParcela, realPendingAmount);
        this.contractsForInstallmentsMonth.push(contract); // Agora guarda exatamente os contratos que compõem este valor
      }
    });

    this.installmentsReceivableThisMonth = totalInstallments;
    this.pendingReceivableThisMonth = totalPendingThisMonth;
  }

  /**
   * Navega para a tela de detalhes passando a respectiva lista de contratos via serviço de estado
   */
  viewContractDetails(type: 'installments' | 'pending'): void {
    if (type === 'installments') {
      this.dashboardState.setContracts('Parcelas a Receber no Mês', this.contractsForInstallmentsMonth);
    } else {
      this.dashboardState.setContracts('Saldo Pendente Total (Ciclo do Mês)', this.contractsForPendingMonth);
    }
    this.router.navigate(['/financial-details']);
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