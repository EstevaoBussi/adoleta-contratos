import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContractFormComponent } from './contract-form/contract-form.component';
import { ContractListComponent } from './contract-list/contract-list.component';
import { ContractDetailDto } from './models/contract.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ContractFormComponent,
    ContractListComponent
  ],
  templateUrl: './app.html'
})
export class AppComponent {
  @ViewChild(ContractFormComponent) formComponent!: ContractFormComponent;

  // Declaração da propriedade que controla a aba ativa
  activeTab: 'home' | 'list' | 'form' = 'home';

  openNewContract(): void {
    this.activeTab = 'form';
    if (this.formComponent) {
      this.formComponent.currentFileId = null;
      this.formComponent.message = '';
      this.formComponent.contractForm.reset({
        event: { installmentValue: 0, totalValue: 0 }
      });
      this.formComponent.payments.clear();
    }
  }

  onContractSelected(contractDetail: ContractDetailDto): void {
    this.activeTab = 'form';
    if (this.formComponent) {
      this.formComponent.currentFileId = contractDetail.fileId || null;
      this.formComponent.message = '';
      
      this.formComponent.contractForm.patchValue({
        fileId: contractDetail.fileId,
        fileName: contractDetail.fileName,
        event: contractDetail.event
      });

      this.formComponent.payments.clear();
      if (contractDetail.payments) {
        contractDetail.payments.forEach(p => {
          this.formComponent.payments.push(
            this.formComponent['fb'].group({
              paymentDate: [p.paymentDate],
              amount: [p.amount],
              pendingAmount: [p.pendingAmount]
            })
          );
        });
      }
    }
  }
}