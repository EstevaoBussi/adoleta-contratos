package com.adoleta.google.contrato.dto;

public record PaymentRecordDto(
        String paymentDate,
        Double amount,
        Double pendingAmount
) {}
