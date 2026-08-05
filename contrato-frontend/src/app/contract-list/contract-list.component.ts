import { Component, OnInit, inject, output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContractService } from '../services/contract.spec';
import { ContractSummaryDto, ContractDetailDto } from '../models/contract.model';

@Component({
  selector: 'app-contract-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contract-list.component.html'
})
export class ContractListComponent implements OnInit {
  private contractService = inject(ContractService);
  private cdr = inject(ChangeDetectorRef); // <--- Injeta o detector de mudanças

  // Evento para avisar o componente pai quando um contrato for selecionado para edição
  onSelectContract = output<ContractDetailDto>();

  contracts: ContractSummaryDto[] = [];
  filteredContracts: ContractSummaryDto[] = [];
  searchTerm: string = '';
  loading: boolean = false;
  errorMessage: string = '';

  ngOnInit(): void {
    
  }

  loadContracts(): void {
    this.loading = true;
    this.errorMessage = '';
    this.contractService.getAll().subscribe({
      next: (data: any[]) => {
      // Aqui o backend manda 'id' e 'name', e nós convertemos para 'fileId' e 'fileName'
        this.contracts = data.map(item => ({
          id: item.id,     // Pega o 'id' do backend e joga no 'fileId' do front
          name: item.name  // Pega o 'name' do backend e joga no 'fileName' do front
        }));
        this.filteredContracts = this.contracts;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    this.loading = true;
    this.errorMessage = '';

    const term = this.searchTerm ? this.searchTerm.trim() : '';
    if (term.length > 0 && term.length < 3) {
      console.log('Mínimo de 3 caracteres necessário para buscar...');
      this.loading = false;
      return; 
    }
    this.contractService.searchByTitle(term).subscribe({
      next: (data: any[]) => {
        this.contracts = data.map(item => ({
          id: item.id,
          name: item.name
        }));
        this.filteredContracts = this.contracts;
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