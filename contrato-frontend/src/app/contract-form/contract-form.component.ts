import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ContractService } from '../services/contract.spec';
import { ContractDetailDto } from '../models/contract.model';

// Importações do Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-contract-form',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './contract-form.component.html'
})
export class ContractFormComponent implements OnInit {
  public fb = inject(FormBuilder);
  private contractService = inject(ContractService);

  contractForm!: FormGroup;
  currentFileId: string | null = null;
  message: string = '';

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.contractForm = this.fb.group({
      fileId: [''],
      fileName: [''],
      event: this.fb.group({
        clientName: ['', Validators.required],
        eventDate: ['', Validators.required],
        guestCount: [50, [Validators.required, Validators.min(1)]],
        startTime: ['13:30', Validators.required],
        endTime: ['17:30', Validators.required],
        installmentValue: [0, [Validators.required, Validators.min(0)]],
        totalValue: [0, [Validators.required, Validators.min(0)]],
        bolo: [''],
        opcionais: [''],
        descricao: ['']
      }),
      payments: this.fb.array([])
    });

    this.contractForm.get('event.totalValue')?.valueChanges.subscribe(() => this.recalculateBalances());
  }

  // Função para preenchimento rápido dos horários
  setShift(start: string, end: string): void {
    this.contractForm.get('event')?.patchValue({
      startTime: start,
      endTime: end
    });
  }

  get payments(): FormArray {
    return this.contractForm.get('payments') as FormArray;
  }

  addPayment(): void {
    const paymentGroup = this.fb.group({
      paymentDate: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      pendingAmount: [{ value: 0, disabled: false }]
    });

    paymentGroup.get('amount')?.valueChanges.subscribe(() => this.recalculateBalances());

    this.payments.push(paymentGroup);
    this.recalculateBalances();
  }

  removePayment(index: number): void {
    this.payments.removeAt(index);
    this.recalculateBalances();
  }

  recalculateBalances(): void {
    const totalValue = Number(this.contractForm.get('event.totalValue')?.value) || 0;
    let accumulatedPaid = 0;

    this.payments.controls.forEach((control) => {
      const amountPaid = Number(control.get('amount')?.value) || 0;
      accumulatedPaid += amountPaid;
      const currentPending = Math.max(0, totalValue - accumulatedPaid);
      
      control.patchValue({ pendingAmount: currentPending }, { emitEvent: false });
    });
  }

  printContract(): void {
    window.print();
  }

  saveContract(): void {
    if (this.contractForm.invalid) {
      this.message = 'Por favor, preencha todos os campos obrigatórios corretamente.';
      return;
    }

    const payload: ContractDetailDto = this.contractForm.getRawValue();
    const fileIdToUse = this.currentFileId || this.contractForm.get('fileId')?.value;

    if (fileIdToUse) {
      this.contractService.update(fileIdToUse, payload).subscribe({
        next: () => {
          this.currentFileId = fileIdToUse;
          this.message = 'Contrato atualizado com sucesso no Google Sheets!';
        },
        error: (err) => this.message = 'Erro ao atualizar contrato: ' + err.message
      });
    } else {
      this.contractService.create(payload).subscribe({
        next: (res) => {
          this.currentFileId = res.id;
          this.contractForm.patchValue({ id: res.id });
          this.message = `Contrato criado com sucesso! ID: ${res.id}`;
        },
        error: (err) => this.message = 'Erro ao criar contrato: ' + err.message
      });
    }
  }
}