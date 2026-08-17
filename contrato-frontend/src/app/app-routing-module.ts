import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ContractListComponent } from './contract-list/contract-list.component';
import { ContractFormComponent } from './contract-form/contract-form.component';
import { authGuard } from './login/auth.guard'; // Iremos criar abaixo

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { 
    path: '', 
    component: DashboardComponent, 
    canActivate: [authGuard] // Protege o Dashboard
  },
  { 
    path: 'list', 
    component: ContractListComponent, 
    canActivate: [authGuard] 
  },
  { 
    path: 'new', 
    component: ContractFormComponent, 
    canActivate: [authGuard] 
  },
  { 
    path: 'edit/:id', 
    component: ContractFormComponent, 
    canActivate: [authGuard] 
  },
  { path: '**', redirectTo: '' }
];