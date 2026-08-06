import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app-routing-module'; // Importa as suas rotas

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(), // Injeta o HttpClient para falar com o Spring Boot
    provideRouter(routes, withComponentInputBinding()) // <-- ISSO FALTAVA: Ativa o roteador globalmente
  ]
}).catch((err) => console.error(err));