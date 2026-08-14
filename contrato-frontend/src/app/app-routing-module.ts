import { Routes } from '@angular/router';
import { ContractListComponent } from './contract-list/contract-list.component';
import { ContractFormComponent } from './contract-form/contract-form.component';
import { DashboardComponent } from './dashboard/dashboard.component'; // <-- Importe o componente do dashboard

export const routes: Routes = [
  { path: '', component: DashboardComponent }, // O Dashboard abre na raiz do sistema
  { path: 'list', component: ContractListComponent },
  { path: 'new', component: ContractFormComponent },
  { path: 'edit/:id', component: ContractFormComponent },
  { path: '**', redirectTo: '' } // Rota coringa redireciona para o dashboard
];