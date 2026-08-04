package com.adoleta.google.contrato.dto;

public record EventDto(
        String clientName,
        String eventDate,
        Double installmentValue,
        Double totalValue
) {}
