package com.adoleta.google.contrato.controller;


import com.adoleta.google.contrato.dto.ContractDetailDto;
import com.adoleta.google.contrato.dto.ContractSummaryDto;
import com.adoleta.google.contrato.service.ContractService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contracts")
@CrossOrigin(origins = "http://localhost:4200") // Permite chamadas do frontend Angular
public class ContractController {

    private final ContractService contractService;

    public ContractController(ContractService contractService) {
        this.contractService = contractService;
    }

    /**
     * 1. GET /api/contracts
     * Lista todas as planilhas de contrato presentes na pasta do Google Drive.
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
     * 3. POST /api/contracts
     * Cria um novo arquivo de planilha no Drive formatado como "YYYY-MM-DD - NOME CLIENTE".
     */
    @PostMapping
    public ResponseEntity<ContractSummaryDto> createContract(@RequestBody ContractDetailDto request) {
        try {
            ContractSummaryDto createdContract = contractService.createContract(request            );
            return ResponseEntity.status(HttpStatus.CREATED).body(createdContract);
        } catch (Exception e) {
            // ESSA LINHA É A CHAVE: Imprime o erro real no console/terminal
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * 4. PUT /api/contracts/{fileId}
     * Atualiza as informações do evento e a lista de pagamentos na planilha do Google Sheets.
     */
    @PutMapping("/{fileId}")
    public ResponseEntity<Void> updateContract(
            @PathVariable String fileId,
            @RequestBody ContractDetailDto contractDetailDto
    ) {
        try {
            contractService.updateContract(fileId, contractDetailDto);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Endpoint para buscar contratos cujo nome contenha o termo informado.
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
