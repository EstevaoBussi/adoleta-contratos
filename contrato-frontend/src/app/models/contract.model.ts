export interface EventDto {
  clientName: string;
  eventDate: string;
  guestCount: number;   
  startTime: string;    
  endTime: string;      
  installmentValue: number;
  totalValue: number;
  bolo: string;
  opcionais: string;
  descricao: string;
  telefone?: string; 
}

export interface PaymentRecordDto {
  paymentDate: string;
  amount: number;
  pendingAmount: number;
}

export interface ContractDetailDto {
  fileId?: string;
  fileName?: string;
  status: string; 
  event: EventDto;
  payments: PaymentRecordDto[];
}

export interface ContractSummaryDto {
  id: string;
  name: string;
}