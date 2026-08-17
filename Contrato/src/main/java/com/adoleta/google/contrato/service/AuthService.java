package com.adoleta.google.contrato.service;

import org.springframework.stereotype.Service;
import java.util.Map;

@Service
public class AuthService {

    // Simulação dos usuários (pode vir do application.yml futuramente)
    private final Map<String, String> credenciais = Map.of(
            "estevao.bussi", "Tevo300484",
            "rogererio", "Adoleta2025sucesso",
            "cristino", "Adoleta2025sucesso"
    );

    public boolean verificarCredenciais(String username, String password) {
        // Verifica se o usuário existe e se a senha confere
        return credenciais.containsKey(username) &&
                credenciais.get(username).equals(password);
    }
}
