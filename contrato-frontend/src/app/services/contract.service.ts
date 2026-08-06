import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ContractDetailDto, ContractSummaryDto } from '../models/contract.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ContractService {
  // Usa o environment e concatena com o recurso de contracts
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

  // Criar novo contrato no Google Sheets via Spring (POST) - Aceita status opcionalmente
  create(contract: ContractDetailDto, status: string = 'ABERTO'): Observable<ContractSummaryDto> {
    const params = new HttpParams().set('status', status);
    return this.http.post<ContractSummaryDto>(this.API_URL, contract, { params });
  }

  // Atualizar contrato existente e alterar o status/pasta (PUT)
  update(fileId: string, contract: ContractDetailDto, status: string = 'ABERTO'): Observable<void> {
    const params = new HttpParams().set('status', status);
    return this.http.put<void>(`${this.API_URL}/${fileId}`, contract, { params });
  }

  // Método novo para buscar por título no backend
  searchByTitle(title: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/search?title=${encodeURIComponent(title)}`);
  }
}