import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ContractDetailDto, ContractSummaryDto } from '../models/contract.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ContractService {
  private readonly API_URL = `${environment.apiUrl}/api/contracts`;

  constructor(private http: HttpClient) {}

  // Listar resumos dos contratos (GET)
  getAll(): Observable<ContractSummaryDto[]> {
    return this.http.get<ContractSummaryDto[]>(this.API_URL);
  }

  // Buscar detalhes de um contrato por fileId (GET)
  getById(fileId: string): Observable<ContractDetailDto> {
    return this.http.get<ContractDetailDto>(`${this.API_URL}/${fileId}`);
  }

  // Criar novo contrato no Google Sheets via Spring (POST)
  create(contract: ContractDetailDto, status: string = 'ABERTO'): Observable<ContractSummaryDto> {
    const params = new HttpParams().set('status', status);
    return this.http.post<ContractSummaryDto>(this.API_URL, contract, { params });
  }

  // Atualizar contrato existente e alterar o status/pasta (PUT)
  update(fileId: string, contract: ContractDetailDto, status: string = 'ABERTO'): Observable<void> {
    const params = new HttpParams().set('status', status);
    return this.http.put<void>(`${this.API_URL}/${fileId}`, contract, { params });
  }

  /**
   * Busca unificada permitindo filtrar por título, status e carregar detalhes completos (details=true)
   */
  search(title?: string, status?: string, details: boolean = false): Observable<any[]> {
    let params = new HttpParams().set('details', details.toString());
    
    if (title) {
      params = params.set('title', title);
    }
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<any[]>(`${this.API_URL}/search`, { params });
  }

  /**
   * Método de compatibilidade para a tela de listagem que busca por título
   */
  searchByTitle(title: string): Observable<any[]> {
    return this.search(title, undefined, false);
  }
}