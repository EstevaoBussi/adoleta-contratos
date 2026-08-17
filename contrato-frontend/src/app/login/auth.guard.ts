import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const authGuard = () => {
  const router = inject(Router);
  
  // Verifica se o usuário está logado
  if (localStorage.getItem('currentUser')) {
    return true;
  }
  
  // Se não estiver, manda para o login
  return router.parseUrl('/login');
};