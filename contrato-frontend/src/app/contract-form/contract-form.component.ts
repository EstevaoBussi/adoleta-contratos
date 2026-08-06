import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
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
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private cdr = inject(ChangeDetectorRef);

  contractForm!: FormGroup;
  currentFileId: string | null = null;
  message: string = '';
  isSubmitting: boolean = false;

  ngOnInit(): void {
    this.initForm();

    const idFromRoute = this.route.snapshot.paramMap.get('id');
    if (idFromRoute) {
      this.currentFileId = idFromRoute;
      this.loadContractData(idFromRoute);
    }
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

  loadContractData(fileId: string): void {
    this.contractService.getById(fileId).subscribe({
      next: (data) => {
        this.contractForm.patchValue({
          fileId: data.fileId,
          fileName: data.fileName,
          event: data.event
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.message = 'Erro ao carregar os dados do contrato: ' + err.message;
        this.cdr.detectChanges();
      }
    });
  }

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
      this.cdr.detectChanges();
      return;
    }

    this.isSubmitting = true;
    this.message = 'Salvando contrato...';
    this.cdr.detectChanges();

    const payload: ContractDetailDto = this.contractForm.getRawValue();
    const fileIdToUse = this.currentFileId || this.contractForm.get('fileId')?.value;

    if (fileIdToUse) {
      // Modo Atualização
      this.contractService.update(fileIdToUse, payload).pipe(
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: () => {
          this.currentFileId = fileIdToUse;
          this.message = 'Contrato atualizado com sucesso no Google Sheets!';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.message = 'Erro ao atualizar contrato: ' + err.message;
          this.cdr.detectChanges();
        }
      });
    } else {
      // Modo Criação
      this.contractService.create(payload).pipe(
        finalize(() => {
          this.isSubmitting = false;
          this.cdr.detectChanges();
        })
      ).subscribe({
        next: (res: any) => {
          console.log('Resposta completa do create:', res);
          
          const newId = res?.id;
          const newName = res?.name;
          
          if (newId) {
            this.currentFileId = newId;
            this.contractForm.patchValue({ 
              fileId: newId, 
              fileName: newName || '' 
            });
            this.message = 'Contrato criado com sucesso! Alternado para modo de edição.';
            this.location.go(`/edit/${newId}`);
          } else {
            this.message = 'Contrato criado com sucesso!';
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.message = 'Erro ao criar contrato: ' + (err.error?.message || err.message);
          this.cdr.detectChanges();
        }
      });
    }
  }
}