import { Component, OnInit, inject, ChangeDetectorRef, output } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ContractService } from '../services/contract.service';
import { ContractSummaryDto, ContractDetailDto } from '../models/contract.model';

// Importações do Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-contract-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSelectModule
  ],
  templateUrl: './contract-list.component.html'
})
export class ContractListComponent implements OnInit {
  private contractService = inject(ContractService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  onSelectContract = output<ContractDetailDto>();

  contracts: any[] = [];
  filteredContracts: any[] = [];
  searchTerm: string = '';
  statusFilter: string = 'ABERTO'; // <-- Iniciando selecionado como ABERTO por padrão
  loading: boolean = false;
  errorMessage: string = '';

  displayedColumns: string[] = ['name', 'id', 'status', 'actions'];

  ngOnInit(): void {
    this.loadContracts();
  }

  loadContracts(): void {
    this.loading = true;
    this.errorMessage = '';
    
    // Se o backend já filtra os abertos no getAll ou se preferir passar o filtro de status na busca:
    this.contractService.getAll().subscribe({
      next: (data: any[]) => {
        this.contracts = data.map(item => ({
          id: item.id,
          name: item.name,
          status: (item.status || 'ABERTO').toUpperCase()
        }));
        this.applyFilters(); 
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Não foi possível carregar os contratos do Google Drive.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearchChange(): void {
    const term = this.searchTerm ? this.searchTerm.trim() : '';

    if (term.length === 0) {
      this.loadContracts();
      return;
    }

    if (term.length > 0 && term.length < 3) {
      this.loading = false;
      return; 
    }

    this.loading = true;
    this.errorMessage = '';

    // Passa também o statusFilter atual caso seu service aceite, ou busca pelo termo e filtra localmente
    this.contractService.searchByTitle(term).subscribe({
      next: (data: any[]) => {
        this.contracts = data.map(item => ({
          id: item.id,
          name: item.name,
          status: (item.status || 'ABERTO').toUpperCase()
        }));
        this.applyFilters(); 
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao buscar contratos:', err);
        this.errorMessage = 'Não foi possível buscar os contratos.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onStatusFilterChange(): void {
    this.applyFilters();
  }

  private applyFilters(): void {
    if (this.statusFilter === 'TODOS') {
      this.filteredContracts = this.contracts;
    } else {
      this.filteredContracts = this.contracts.filter(c => c.status === this.statusFilter);
    }
  }

  navigateToNewContract(): void {
    this.router.navigate(['/new']); 
  }

  editContract(id: string): void {
    if (!id) {
      console.error('ID do contrato inválido.');
      return;
    }
    this.router.navigate(['/edit', id]);
  }
}