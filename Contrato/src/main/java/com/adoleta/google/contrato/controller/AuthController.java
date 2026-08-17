package com.adoleta.google.contrato.controller;

import com.adoleta.google.contrato.dto.LoginRequest;
import com.adoleta.google.contrato.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@CrossOrigin(origins = "http://localhost:4200")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest loginRequest) {
        boolean autenticado = authService.verificarCredenciais(loginRequest.username(), loginRequest.password());

        if (autenticado) {
            return ResponseEntity.ok("Login realizado com sucesso");
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Credenciais inválidas");
    }
}
