package com.adoleta.google.contrato.controller;

import com.adoleta.google.contrato.dto.ContractDetailDto;
import com.adoleta.google.contrato.dto.ContractSummaryDto;
import com.adoleta.google.contrato.service.ContractService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/contracts")
@CrossOrigin(origins = "*")
public class ContractController implements Serializable {
    private static final Logger logger = LoggerFactory.getLogger(ContractController.class);

    private final ContractService contractService;

    public ContractController(ContractService contractService) {
        this.contractService = contractService;
    }

    @GetMapping
    public ResponseEntity<?> listContracts() {
        try {
            List<ContractSummaryDto> contracts = contractService.listContracts();
            return ResponseEntity.ok(contracts);
        } catch (Exception e) {
            logger.error("Erro ao listar contratos: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro ao listar contratos", "details", e.getMessage()));
        }
    }

    @GetMapping("/{fileId}")
    public ResponseEntity<?> getContractDetail(@PathVariable String fileId) {
        try {
            ContractDetailDto contractDetail = contractService.getContractDetail(fileId);
            return ResponseEntity.ok(contractDetail);
        } catch (Exception e) {
            logger.error("Erro ao buscar detalhe do contrato {}: ", fileId, e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Contrato não encontrado ou erro na API", "details", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createContract(
            @RequestBody @Valid ContractDetailDto request,
            @RequestParam(value = "status", defaultValue = "ABERTO") String status
    ) {
        try {
            ContractSummaryDto createdContract = contractService.createContract(request, status);
            return ResponseEntity.status(HttpStatus.CREATED).body(createdContract);
        } catch (ResponseStatusException e) {
            logger.warn("Regra de negócio violada na criação: {}", e.getReason());
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Erro de validação"));
        } catch (Exception e) {
            logger.error("Erro ao criar contrato: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro interno ao criar contrato", "details", e.getMessage()));
        }
    }

    @PutMapping("/{fileId}")
    public ResponseEntity<?> updateContract(
            @PathVariable String fileId,
            @RequestBody ContractDetailDto contractDetailDto,
            @RequestParam(value = "status", defaultValue = "ABERTO") String status
    ) {
        try {
            contractService.updateContract(fileId, contractDetailDto, status);
            return ResponseEntity.noContent().build();
        } catch (ResponseStatusException e) {
            logger.warn("Regra de negócio violada na atualização do contrato {}: {}", fileId, e.getReason());
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", e.getReason() != null ? e.getReason() : "Erro na atualização"));
        } catch (Exception e) {
            logger.error("Erro ao atualizar contrato {}: ", fileId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro interno ao atualizar contrato", "details", e.getMessage()));
        }
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchContracts(
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "details", defaultValue = "false") boolean details
    ) {
        try {
            if (details) {
                // Retorna detalhes completos para o front end (ex: Dashboard)
                List<ContractDetailDto> detailedResults = contractService.searchDetailedByTitle(title, status);
                return ResponseEntity.ok(detailedResults);
            } else {
                // Retorna apenas resumos
                List<ContractSummaryDto> results = contractService.searchByTitle(title, status);
                return ResponseEntity.ok(results);
            }
        } catch (Exception e) {
            logger.error("Erro ao buscar contratos [título: {}, status: {}, details: {}]: ", title, status, details, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erro na busca de contratos", "details", e.getMessage()));
        }
    }
}