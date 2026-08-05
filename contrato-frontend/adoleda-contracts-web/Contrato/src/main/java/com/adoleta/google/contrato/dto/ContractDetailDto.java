package com.adoleta.google.contrato.dto;

import java.util.List;

public record ContractDetailDto(
        String fileId,
        String fileName,
        EventDto event,
        List<PaymentRecordDto> payments
) {}
