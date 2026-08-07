import { Routes } from '@angular/router';
import { ContractListComponent } from './contract-list/contract-list.component';
import { ContractFormComponent } from './contract-form/contract-form.component';

export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  { path: 'list', component: ContractListComponent },
  { path: 'new', component: ContractFormComponent },
  { path: 'edit/:id', component: ContractFormComponent }, // <-- Tem que estar exatamente assim!
  { path: '**', redirectTo: 'list' } // Rota coringa para evitar erros de navegação
];