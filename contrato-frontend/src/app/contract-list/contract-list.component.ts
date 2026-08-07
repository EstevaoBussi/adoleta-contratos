import { Component, OnInit, inject, ChangeDetectorRef, output } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router'; // <-- 1. Importar o Router
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
  private router = inject(Router); // <-- 2. Injetar o Router aqui

  // Evento de saída para notificar o componente pai (caso ainda precise)
  onSelectContract = output<ContractDetailDto>();

  contracts: any[] = [];
  filteredContracts: any[] = [];
  searchTerm: string = '';
  loading: boolean = false;
  errorMessage: string = '';

  displayedColumns: string[] = ['name', 'id', 'status', 'actions'];

  ngOnInit(): void {
    this.loadContracts();
  }

  loadContracts(): void {
    this.loading = true;
    this.errorMessage = '';
    this.contractService.getAll().subscribe({
      next: (data: any[]) => {
        this.contracts = data.map(item => ({
          id: item.id,
          name: item.name,
          status: (item.status || 'ABERTO').toUpperCase()
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

    this.contractService.searchByTitle(term).subscribe({
      next: (data: any[]) => {
        this.filteredContracts = data.map(item => ({
          id: item.id,
          name: item.name,
          status: (item.status || 'ABERTO').toUpperCase()
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
    if (!id) {
      console.error('ID do contrato inválido.');
      return;
    }
    
    // Agora o router está injetado e vai direcionar corretamente para /edit/ID_DO_CONTRATO
    this.router.navigate(['/edit', id]);
  }
}