import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DashboardStateService {
  private currentContractsList: any[] = [];
  private currentTitle: string = '';

  setContracts(title: string, contracts: any[]): void {
    this.currentTitle = title;
    this.currentContractsList = contracts;
  }

  getContracts(): any[] {
    return this.currentContractsList;
  }

  getTitle(): string {
    return this.currentTitle;
  }
}