import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ContractService } from '../services/contract.spec';
import { ContractDetailDto } from '../models/contract.model';

@Component({
  selector: 'app-contract-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
        guestCount: [null, [Validators.required, Validators.min(1)]], // Quantidade de convidados (positivo)
        startTime: ['', Validators.required],                      // Horário de início
        endTime: ['', Validators.required],                        // Horário de término
        installmentValue: [0, [Validators.required, Validators.min(0)]],
        totalValue: [0, [Validators.required, Validators.min(0)]],
        bolo: [''],
        opcionais: [''],
        descricao: ['']
      }),
      payments: this.fb.array([])
    });

    // Recalcula saldos sempre que o valor total ou os pagamentos mudarem
    this.contractForm.get('event.totalValue')?.valueChanges.subscribe(() => this.recalculateBalances());
  }

  /**
   * Atalho para preencher automaticamente os horários com base no turno escolhido
   */
  onTurnoChange(event: any): void {
    const valor = event.target.value;
    if (valor === 'tarde') {
      this.contractForm.get('event')?.patchValue({
        startTime: '13:30',
        endTime: '17:30'
      });
    } else if (valor === 'noite') {
      this.contractForm.get('event')?.patchValue({
        startTime: '19:30',
        endTime: '23:30'
      });
    }
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

    // Recalcula automaticamente se o valor pago mudar
    paymentGroup.get('amount')?.valueChanges.subscribe(() => this.recalculateBalances());

    this.payments.push(paymentGroup);
    this.recalculateBalances();
  }

  removePayment(index: number): void {
    this.payments.removeAt(index);
    this.recalculateBalances();
  }

  /**
   * Recalcula o saldo pendente linha por linha de pagamento
   */
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
      this.message = 'Por favor, preencha todos os campos obrigatórios e verifique se a quantidade de convidados é válida.';
      this.contractForm.markAllAsTouched();
      return;
    }

    const payload: ContractDetailDto = this.contractForm.getRawValue();

    // Se a variável global ou o campo do form tiver o ID, tratamos como atualização
    const fileIdToUse = this.currentFileId || this.contractForm.get('fileId')?.value;

    if (fileIdToUse) {
      // Passa o ID explicitamente para o service atualizar o arquivo correto
      this.contractService.update(fileIdToUse, payload).subscribe({
        next: () => {
          this.currentFileId = fileIdToUse;
          this.message = 'Contrato atualizado com sucesso no Google Sheets!';
        },
        error: (err) => this.message = 'Erro ao atualizar contrato: ' + err.message
      });
    } else {
      // Se é a primeira vez, cria e armazena o fileId retornado
      this.contractService.create(payload).subscribe({
        next: (res) => {
          console.log("--- DEBUG SALVAR CONTRATO ---", res);
          this.currentFileId = res.id;
          
          // ATUALIZA O CAMPO FILEID NO FORMULÁRIO PARA GUARDAR O ESTADO
          this.contractForm.patchValue({ fileId: res.id });
          
          this.message = `Contrato criado com sucesso! Agora as próximas alterações vão atualizar esta mesma planilha. ID: ${res.id}`;
        },
        error: (err) => this.message = 'Erro ao criar contrato: ' + err.message
      });
    }
  }
}