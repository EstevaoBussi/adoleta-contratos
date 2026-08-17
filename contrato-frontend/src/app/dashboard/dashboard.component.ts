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
   * Responsável por calcular o valor total a receber no mês (Regras 1 e 2 baseadas na parcela)
   */
  private calculateMonthlyReceivable(contracts: any[]): void {
    let totalReceivable = 0;
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    contracts.forEach((contract) => {
      const ev = contract.event || contract;
      
      // 1. Cálculo real do Saldo Pendente (Contrato - Pagamentos)
      const totalContractValue = Number(ev.totalValue || contract.totalValue || 0);
      const paymentsList = contract.payments || contract.pagamentos || ev.payments || ev.pagamentos || [];
      const totalPaid = paymentsList.reduce((acc: number, p: any) => 
        acc + Number(p.amount || p.valor || 0), 0);
      
      const realPendingAmount = Math.max(0, totalContractValue - totalPaid);

      // 2. Regra do Pagamento Recente
      // Se o cliente pagou algo nos últimos 30 dias, ele não entra na conta do mês.
      let pagouRecente = false;
      if (paymentsList.length > 0) {
        const sortedPayments = [...paymentsList].sort((a, b) => 
          new Date(b.paymentDate || b.data || 0).getTime() - new Date(a.paymentDate || a.data || 0).getTime()
        );
        const lastPaymentDate = new Date(sortedPayments[0].paymentDate || sortedPayments[0].data || 0);
        const diffDays = (now.getTime() - lastPaymentDate.getTime()) / (1000 * 3600 * 24);
        
        if (diffDays <= 30) {
          pagouRecente = true;
        }
      }

      
      // 3. Regra de Soma
      const eventDateStr = ev.eventDate || ev.dataEvento || contract.eventDate || contract.dataEvento;
      const eventDate = eventDateStr ? new Date(eventDateStr.substring(0, 10) + 'T00:00:00') : null;
      
      // Valor da parcela (se existir)
      const valorParcela = Number(ev.installmentValue || ev.valorParcela || 0);

      if (eventDate && eventDate >= now && eventDate <= thirtyDaysFromNow) {
        // Evento próximo: soma o saldo real pendente
        totalReceivable += realPendingAmount;
      } else {
        if (pagouRecente || realPendingAmount <= 0) return; 
        // Evento longe: soma a parcela (limitada ao que falta pagar)
        totalReceivable += Math.min(valorParcela, realPendingAmount);
      }
    });

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