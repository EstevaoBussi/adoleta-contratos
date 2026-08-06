import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ContractDetailDto, ContractSummaryDto } from '../models/contract.model';
import { environment } from '../../environments/environment'; // Importe o environment

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

  // Criar novo contrato no Google Sheets via Spring (POST)
  create(contract: ContractDetailDto): Observable<ContractSummaryDto> {
    return this.http.post<ContractSummaryDto>(this.API_URL, contract);
  }

  // Atualizar contrato existente (PUT)
  update(fileId: string, contract: ContractDetailDto): Observable<void> {
    return this.http.put<void>(`${this.API_URL}/${fileId}`, contract);
  }

  // Método novo para buscar por título no backend
  searchByTitle(title: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/search?title=${encodeURIComponent(title)}`);
  }
}