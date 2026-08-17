package com.adoleta.google.contrato.dto;


/**
 * DTO para recebimento das credenciais de login.
 * O uso de record garante imutabilidade e métodos auxiliares automáticos.
 */
public record LoginRequest(String username, String password) {
}
