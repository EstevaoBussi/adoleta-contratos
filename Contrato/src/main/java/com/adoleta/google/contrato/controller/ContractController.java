package com.adoleta.google.contrato.controller;

import com.adoleta.google.contrato.dto.ContractDetailDto;
import com.adoleta.google.contrato.dto.ContractSummaryDto;
import com.adoleta.google.contrato.service.ContractService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/contracts")
@CrossOrigin(origins = "*") // Permite chamadas do frontend Angular
public class ContractController {

    private final ContractService contractService;

    public ContractController(ContractService contractService) {
        this.contractService = contractService;
    }

    /**
     * 1. GET /api/contracts
     * Lista todas as planilhas de contrato presentes nas pastas de status do Google Drive.
     */
    @GetMapping
    public ResponseEntity<List<ContractSummaryDto>> listContracts() {
        try {
            List<ContractSummaryDto> contracts = contractService.listContracts();
            return ResponseEntity.ok(contracts);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 2. GET /api/contracts/{fileId}
     * Obtém os dados detalhados (Evento + Histórico de Pagamentos) de uma planilha específica.
     */
    @GetMapping("/{fileId}")
    public ResponseEntity<ContractDetailDto> getContractDetail(@PathVariable String fileId) {
        try {
            ContractDetailDto contractDetail = contractService.getContractDetail(fileId);
            return ResponseEntity.ok(contractDetail);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    /**
     * 3. POST /api/contracts?status=ABERTO
     * Cria um novo arquivo de planilha no Drive e o direciona para a pasta do status correspondente.
     */
    @PostMapping
    public ResponseEntity<ContractSummaryDto> createContract(
            @RequestBody @Valid ContractDetailDto request,
            @RequestParam(value = "status", defaultValue = "ABERTO") String status
    ) {
        try {
            ContractSummaryDto createdContract = contractService.createContract(request, status);
            return ResponseEntity.status(HttpStatus.CREATED).body(createdContract);
        } catch (ResponseStatusException e) {
            // Propaga o status exato lançado pelo serviço (ex: 400 Bad Request)
            return ResponseEntity.status(e.getStatusCode()).build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 4. PUT /api/contracts/{fileId}?status=QUITADO
     * Atualiza as informações, move o contrato de pasta no Drive e gerencia a agenda conforme o status.
     */
    @PutMapping("/{fileId}")
    public ResponseEntity<Void> updateContract(
            @PathVariable String fileId,
            @RequestBody ContractDetailDto contractDetailDto,
            @RequestParam(value = "status", defaultValue = "ABERTO") String status
    ) {
        try {
            contractService.updateContract(fileId, contractDetailDto, status);
            return ResponseEntity.noContent().build();
        } catch (ResponseStatusException e) {
            // AQUI ESTÁ A CHAVE: Se for uma regra de negócio (ResponseStatusException),
            // devolvemos exatamente o status HTTP que ela carrega (400) em vez de fixar 500!
            return ResponseEntity.status(e.getStatusCode()).build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Endpoint para buscar contratos cujo nome contenha o termo informado em todas as pastas de status.
     * Exemplo: GET /api/contracts/search?title=mariana
     */
    @GetMapping("/search")
    public ResponseEntity<List<ContractSummaryDto>> searchContracts(@RequestParam("title") String title) {
        try {
            List<ContractSummaryDto> results = contractService.searchByTitle(title);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}