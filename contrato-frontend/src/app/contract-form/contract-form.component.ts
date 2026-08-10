import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ContractService } from '../services/contract.service';
import { ContractDetailDto } from '../models/contract.model';

// Importações do Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

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
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './contract-form.component.html'
})
export class ContractFormComponent implements OnInit {
  public fb = inject(FormBuilder);
  private contractService = inject(ContractService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private cdr = inject(ChangeDetectorRef);

  contractForm!: FormGroup;
  currentFileId: string | null = null;
  message: string = '';
  isSubmitting: boolean = false;
  isLockedFinalStatus: boolean = false;

  readonly statusList = [
    { value: 'ABERTO', label: 'Aberto' },
    { value: 'QUITADO', label: 'Quitado' },
    { value: 'REALIZADO', label: 'Realizado' },
    { value: 'CANCELADO', label: 'Cancelado' }
  ];

  ngOnInit(): void {
    this.initForm();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.currentFileId = idParam;
      this.loadContractData(idParam);
    }
  }

  private initForm(): void {
    this.contractForm = this.fb.group({
      fileId: [''],
      fileName: [''],
      status: ['ABERTO', Validators.required],
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
        descricao: [''],
        telefone: [''] // Campo adicionado aqui
      }),
      payments: this.fb.array([])
    });

    this.contractForm.get('event.totalValue')?.valueChanges.subscribe(() => {
      this.recalculateBalances();
      this.validateQuitadoStatus();
    });

    this.contractForm.get('event.eventDate')?.valueChanges.subscribe(() => {
      this.validateRealizadoStatus();
    });

    this.contractForm.get('status')?.valueChanges.subscribe(() => {
      this.validateQuitadoStatus();
      this.validateRealizadoStatus();
    });
  }

  populateForm(data: ContractDetailDto): void {
    if (!this.contractForm) {
      this.initForm();
    }

    this.currentFileId = data.fileId || null;
    const loadedStatus = (data.status || 'ABERTO').toUpperCase();

    this.contractForm.patchValue({
      fileId: data.fileId,
      fileName: data.fileName,
      status: loadedStatus,
      event: data.event
    });

    this.payments.clear();
    if (data.payments && data.payments.length > 0) {
      data.payments.forEach(p => {
        const paymentGroup = this.fb.group({
          paymentDate: [p.paymentDate, Validators.required],
          amount: [p.amount, [Validators.required, Validators.min(0)]],
          pendingAmount: [{ value: p.pendingAmount, disabled: false }]
        });
        paymentGroup.get('amount')?.valueChanges.subscribe(() => {
          this.recalculateBalances();
          this.validateQuitadoStatus();
        });
        this.payments.push(paymentGroup);
      });
    }

    this.recalculateBalances();
    this.checkFinalStatusLock(loadedStatus);
    this.cdr.detectChanges();
  }

  checkFinalStatusLock(status: string): void {
    const upperStatus = (status || '').toUpperCase();
    if (upperStatus === 'CANCELADO' || upperStatus === 'REALIZADO') {
      this.isLockedFinalStatus = true;
      this.contractForm.get('status')?.disable({ emitEvent: false });
      this.message = `Atenção: Este contrato está com status ${upperStatus} e encontra-se bloqueado para edições.`;
    } else {
      this.isLockedFinalStatus = false;
      this.contractForm.get('status')?.enable({ emitEvent: false });
      if (this.message.includes('encontra-se bloqueado')) {
        this.message = '';
      }
    }
  }

  validateQuitadoStatus(): void {
    const status = this.contractForm.get('status')?.value;
    if (status === 'QUITADO') {
      const hasPayments = this.payments.controls.length > 0;

      if (!hasPayments) {
        this.contractForm.get('status')?.setErrors({ missingPaymentForQuitado: true });
        return;
      }

      const lastPaymentControl = this.payments.at(this.payments.length - 1);
      const pendingBalance = Number(lastPaymentControl?.get('pendingAmount')?.value) || 0;

      if (pendingBalance > 0) {
        this.contractForm.get('status')?.setErrors({ hasPendingBalance: true });
        return;
      }
    }
    
    const currentErrors = this.contractForm.get('status')?.errors;
    if (currentErrors) {
      delete currentErrors['hasPendingBalance'];
      delete currentErrors['missingPaymentForQuitado'];
      if (Object.keys(currentErrors).length === 0) {
        this.contractForm.get('status')?.setErrors(null);
      }
    }
  }

  validateRealizadoStatus(): boolean {
    const status = this.contractForm.get('status')?.value;
    const eventDateStr = this.contractForm.get('event.eventDate')?.value;

    if (status === 'REALIZADO' && eventDateStr) {
      const [year, month, day] = eventDateStr.split('-').map(Number);
      const eventDate = new Date(year, month - 1, day);
      eventDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (eventDate > today) {
        this.contractForm.get('status')?.setErrors({ futureDateForRealizado: true });
        return false;
      }
    }

    const currentErrors = this.contractForm.get('status')?.errors;
    if (currentErrors && currentErrors['futureDateForRealizado']) {
      delete currentErrors['futureDateForRealizado'];
      if (Object.keys(currentErrors).length === 0) {
        this.contractForm.get('status')?.setErrors(null);
      }
    }
    return true;
  }

  loadContractData(fileId: string): void {
    this.contractService.getById(fileId).subscribe({
      next: (data: ContractDetailDto) => {
        this.populateForm(data);
      },
      error: (err) => {
        this.handleBackendError(err, 'Erro ao carregar os dados do contrato.');
      }
    });
  }

  setShift(start: string, end: string): void {
    if (this.isLockedFinalStatus) return;
    this.contractForm.get('event')?.patchValue({
      startTime: start,
      endTime: end
    });
  }

  get payments() {
    return this.contractForm.get('payments') as any;
  }

  addPayment(): void {
    if (this.isLockedFinalStatus) return;

    const paymentGroup = this.fb.group({
      paymentDate: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      pendingAmount: [{ value: 0, disabled: false }]
    });

    paymentGroup.get('amount')?.valueChanges.subscribe(() => {
      this.recalculateBalances();
      this.validateQuitadoStatus();
    });

    this.payments.push(paymentGroup);
    this.recalculateBalances();
  }

  removePayment(index: number): void {
    if (this.isLockedFinalStatus) return;
    this.payments.removeAt(index);
    this.recalculateBalances();
  }

  recalculateBalances(): void {
    const totalValue = Number(this.contractForm.get('event.totalValue')?.value) || 0;
    let accumulatedPaid = 0;

    this.payments.controls.forEach((control: any) => {
      const amountPaid = Number(control.get('amount')?.value) || 0;
      accumulatedPaid += amountPaid;
      const currentPending = Math.max(0, totalValue - accumulatedPaid);
      
      control.patchValue({ pendingAmount: currentPending }, { emitEvent: false });
    });

    this.validateQuitadoStatus();
  }

  printContract(): void {
    window.print();
  }

  private handleBackendError(err: any, defaultMessage: string): void {
    let errorMessage = defaultMessage;

    if (err.status === 400) {
      const serverMsg = err.error?.message || err.error;
      
      if (typeof serverMsg === 'string' && (serverMsg.includes('CANCELADO') || serverMsg.includes('REALIZADO') || serverMsg.includes('final'))) {
        errorMessage = `Operação negada: ${serverMsg}`;
      } else {
        errorMessage = `Erro de validação (400): ${serverMsg || 'Requisição inválida.'}`;
      }
    } else if (err.error?.message) {
      errorMessage = err.error.message;
    } else if (err.message) {
      errorMessage = err.message;
    }

    this.message = errorMessage;
    this.cdr.detectChanges();
  }

  saveContract(): void {
    if (this.isLockedFinalStatus) {
      this.message = 'Contratos finalizados (Cancelados ou Realizados) não podem ser alterados.';
      this.cdr.detectChanges();
      return;
    }

    this.validateQuitadoStatus();
    const isRealizadoValid = this.validateRealizadoStatus();

    const statusErrors = this.contractForm.get('status')?.errors;

    if (!isRealizadoValid || statusErrors?.['futureDateForRealizado']) {
      this.message = 'Não é permitido definir o status como REALIZADO para eventos com data futura (a data deve ser menor ou igual a hoje).';
      this.cdr.detectChanges();
      return;
    }

    if (statusErrors?.['missingPaymentForQuitado']) {
      this.message = 'Para definir o status como QUITADO, é obrigatório adicionar pelo menos um registro de pagamento.';
      this.cdr.detectChanges();
      return;
    }

    if (statusErrors?.['hasPendingBalance']) {
      this.message = 'Para definir o status como QUITADO, o valor pendente precisa ser zero ou menor (totalmente pago).';
      this.cdr.detectChanges();
      return;
    }

    if (this.contractForm.invalid) {
      this.message = 'Por favor, preencha todos os campos obrigatórios corretamente.';
      this.cdr.detectChanges();
      return;
    }

    this.isSubmitting = true;
    this.message = 'Salvando contrato...';
    this.cdr.detectChanges();

    const formValues = this.contractForm.getRawValue();
    const currentStatus = (formValues.status || 'ABERTO').toUpperCase();
    
    const payload: ContractDetailDto = {
      fileId: formValues.fileId,
      fileName: formValues.fileName,
      status: currentStatus,
      event: formValues.event,
      payments: formValues.payments
    };

    const fileIdToUse = this.currentFileId || formValues.fileId;

    if (fileIdToUse) {
      this.contractService.update(fileIdToUse, payload, currentStatus).pipe(
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: () => {
          this.currentFileId = fileIdToUse;
          this.message = 'Contrato atualizado com sucesso no Google Sheets e Drive!';
          this.checkFinalStatusLock(currentStatus);
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.handleBackendError(err, 'Erro ao atualizar contrato.');
        }
      });
    } else {
      this.contractService.create(payload, currentStatus).pipe(
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: (res: any) => {
          const newId = res?.id;
          if (newId) {
            this.currentFileId = newId;
            this.message = 'Contrato criado com sucesso! Carregando dados...';
            this.loadContractData(newId);
          } else {
            this.message = 'Contrato criado com sucesso!';
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          this.handleBackendError(err, 'Erro ao criar contrato.');
        }
      });
    }
  }
}