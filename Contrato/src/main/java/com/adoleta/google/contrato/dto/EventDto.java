package com.adoleta.google.contrato.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record EventDto(
        String clientName,
        String eventDate,
        @NotNull(message = "A quantidade de convidados é obrigatória")
        @Min(value = 1, message = "A quantidade de convidados deve ser maior que zero")
        Integer guestCount, // Quantidade de convidados (positivo)
        @NotNull(message = "O horário de início é obrigatório")
        String startTime, // Ex: "13:30" ou "19:30"
        @NotNull(message = "O horário de término é obrigatório")
        String endTime,   // Ex: "17:30" ou "23:30"
        Double installmentValue,
        Double totalValue,
        String bolo,
        String opcionais,
        String descricao
) {
    public EventDto {
        if (clientName != null) {
            clientName = clientName.trim().toUpperCase();
        }
        if (bolo != null) {
            bolo = bolo.trim().toUpperCase();
        }
        if (opcionais != null) {
            opcionais = opcionais.trim().toUpperCase();
        }
        if (descricao != null) {
            descricao = descricao.trim().toUpperCase();
        }
    }
}
