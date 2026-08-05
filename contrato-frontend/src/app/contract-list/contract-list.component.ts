import { Component, OnInit, inject, output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContractService } from '../services/contract.spec';
import { ContractSummaryDto, ContractDetailDto } from '../models/contract.model';

// Importações do Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

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
    MatProgressSpinnerModule
  ],
  templateUrl: './contract-list.component.html'
})
export class ContractListComponent implements OnInit {
  private contractService = inject(ContractService);
  private cdr = inject(ChangeDetectorRef);

  // Evento para avisar o componente pai quando um contrato for selecionado para edição
  onSelectContract = output<ContractDetailDto>();

  contracts: ContractSummaryDto[] = [];
  filteredContracts: ContractSummaryDto[] = [];
  searchTerm: string = '';
  loading: boolean = false;
  errorMessage: string = '';

  // Colunas exibidas na mat-table
  displayedColumns: string[] = ['name', 'id', 'actions'];

  ngOnInit(): void {
    this.loadContracts(); // Carrega os contratos ao iniciar a tela
  }

  loadContracts(): void {
    this.loading = true;
    this.errorMessage = '';
    this.contractService.getAll().subscribe({
      next: (data: any[]) => {
        this.contracts = data.map(item => ({
          id: item.id,
          name: item.name
        }));
        this.filteredContracts = this.contracts;
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

    // Se o campo de busca estiver totalmente vazio, recarrega todos os contratos
    if (term.length === 0) {
      this.loadContracts();
      return;
    }

    // Se digitou algo mas tem menos de 3 caracteres, não dispara requisição para evitar erro 500
    if (term.length > 0 && term.length < 3) {
      this.loading = false;
      return; 
    }

    this.loading = true;
    this.errorMessage = '';

    this.contractService.searchByTitle(term).subscribe({
      next: (data: any[]) => {
        this.filteredContracts = data.map(item => ({
          id: item.id,
          name: item.name
        }));
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

  editContract(id: string): void {
    this.loading = true;
    this.contractService.getById(id).subscribe({
      next: (detail) => {
        detail.fileId = id;
        this.onSelectContract.emit(detail);
        this.loading = false;
      },
      error: (err) => {
        alert('Erro ao buscar detalhes do contrato: ' + err.message);
        this.loading = false;
      }
    });
  }
}