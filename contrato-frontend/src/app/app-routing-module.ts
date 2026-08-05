import { Routes } from '@angular/router';
import { ContractFormComponent } from './contract-form/contract-form.component';
import { ContractListComponent } from './contract-list/contract-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  { path: 'list', component: ContractListComponent },
  { path: 'new', component: ContractFormComponent },
  // Adicione outras rotas conforme necessário
];
