package com.adoleta.google.contrato.service;

import com.adoleta.google.contrato.dto.*;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.FileList;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.model.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.google.api.services.sheets.v4.model.*;

import java.util.ArrayList;
import java.util.List;

@Service
public class ContractService {

    private final Drive drive;
    private final Sheets sheets;

    @Value("${google.drive.folder-id}")
    private String folderId;

    public ContractService(Drive drive, Sheets sheets) {
        this.drive = drive;
        this.sheets = sheets;
    }

    /**
     * 1. Listar planilhas presentes na pasta configurada do Google Drive
     */
    public List<ContractSummaryDto> listContracts() throws Exception {
        String query = String.format("'%s' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false", folderId);

        FileList result = drive.files().list()
                .setQ(query)
                .setFields("files(id, name)")
                .execute();

        List<File> files = result.getFiles();
        if (files == null) {
            return List.of();
        }

        return files.stream()
                .map(f -> new ContractSummaryDto(f.getId(), f.getName()))
                .toList();
    }

    /**
     * 2. Obter os dados do evento (Linha 1) e o histórico de pagamentos (Linhas 3+)
     */
    public ContractDetailDto getContractDetail(String fileId) throws Exception {
        File file = drive.files().get(fileId).setFields("name").execute();

        ValueRange response = sheets.spreadsheets().values()
                .get(fileId, "A1:D100")
                .execute();

        List<List<Object>> values = response.getValues();

        if (values == null || values.isEmpty()) {
            return new ContractDetailDto(fileId, file.getName(), new EventDto("", "", 0.0, 0.0), List.of());
        }

        EventDto eventData = new EventDto("", "", 0.0, 0.0);
        List<PaymentRecordDto> payments = new ArrayList<>();

        boolean lendoPagamentos = false;

        // 1. Identifica se a primeira linha é o Cabeçalho "Cliente" ou se já são os dados
        List<Object> firstRow = values.get(0);
        String firstCell = (firstRow != null && !firstRow.isEmpty()) ? firstRow.get(0).toString().trim() : "";

        if (firstCell.equalsIgnoreCase("Cliente")) {
            // Formato Novo: Linha 1 é o cabeçalho "Cliente", então os dados estão na Linha 2 (índice 1)
            if (values.size() > 1) {
                List<Object> eventRow = values.get(1);
                eventData = extrairEventDto(eventRow);
            }
        } else {
            // Formato Antigo: Linha 1 (índice 0) já contém os dados do cliente diretamente
            eventData = extrairEventDto(firstRow);
        }

        // 2. Percorre as linhas para encontrar a tabela de Pagamentos
        for (int i = 0; i < values.size(); i++) {
            List<Object> row = values.get(i);
            if (row == null || row.isEmpty()) continue;

            String primeiraColuna = row.get(0).toString().trim();

            // Encontra o cabeçalho de pagamentos ("Data Pagamento")
            if (primeiraColuna.equalsIgnoreCase("Data Pagamento")) {
                lendoPagamentos = true;
                continue; // Pula o cabeçalho e lê a partir da próxima linha
            }

            // Lê todos os registros de pagamentos abaixo do cabeçalho
            if (lendoPagamentos) {
                String date = row.size() > 0 ? row.get(0).toString().trim() : "";
                if (date.isBlank()) continue;

                Double amount = row.size() > 1 ? parseDoubleSafe(row.get(1).toString()) : 0.0;
                Double pending = row.size() > 2 ? parseDoubleSafe(row.get(2).toString()) : 0.0;

                payments.add(new PaymentRecordDto(date, amount, pending));
            }
        }

        return new ContractDetailDto(fileId, file.getName(), eventData, payments);
    }

    /**
     * Método auxiliar para mapear a linha da planilha no EventDto
     */
    private EventDto extrairEventDto(List<Object> eventRow) {
        if (eventRow == null || eventRow.isEmpty()) {
            return new EventDto("", "", 0.0, 0.0);
        }
        return new EventDto(
                eventRow.size() > 0 ? eventRow.get(0).toString() : "",
                eventRow.size() > 1 ? eventRow.get(1).toString() : "",
                eventRow.size() > 2 ? parseDoubleSafe(eventRow.get(2).toString()) : 0.0,
                eventRow.size() > 3 ? parseDoubleSafe(eventRow.get(3).toString()) : 0.0
        );
    }

    /**
     * 3. Criar uma nova planilha formatada no Drive (YYYY-MM-DD - NOME CLIENTE)
     */
    public ContractSummaryDto createContract(ContractDetailDto dto) throws Exception {
        if (dto == null || dto.event() == null) {
            throw new IllegalArgumentException("Os dados do evento são obrigatórios.");
        }

        EventDto event = dto.event();
        String formattedClientName = event.clientName() != null ? event.clientName().trim().toUpperCase() : "";
        String eventDate = event.eventDate() != null ? event.eventDate().trim() : "";

        String fileName = dto.fileName() != null && !dto.fileName().isBlank()
                ? dto.fileName()
                : String.format("%s - %s", eventDate, formattedClientName);

        // 1. Cria a planilha
        Spreadsheet spreadsheetMetadata = new Spreadsheet()
                .setProperties(new SpreadsheetProperties().setTitle(fileName));

        Spreadsheet createdSpreadsheet = sheets.spreadsheets().create(spreadsheetMetadata).execute();
        String newFileId = createdSpreadsheet.getSpreadsheetId();

        // Obtém o ID da primeira aba (sheetId) para aplicar as bordas
        Integer sheetId = createdSpreadsheet.getSheets().get(0).getProperties().getSheetId();

        // 2. Move para a pasta no Drive (se configurada)
        if (folderId != null && !folderId.isBlank()) {
            drive.files().update(newFileId, null)
                    .setAddParents(folderId)
                    .setSupportsAllDrives(true)
                    .execute();
        }

        // 3. Monta o conteúdo dos dados
        List<List<Object>> initialData = new ArrayList<>();

        // --- BLOCO 1: EVENTO ---
        initialData.add(List.of("Cliente", "Data do Evento", "Valor Parcela", "Valor Total"));
        initialData.add(List.of(
                formattedClientName,
                eventDate,
                event.installmentValue() != null ? event.installmentValue() : 0.0,
                event.totalValue() != null ? event.totalValue() : 0.0
        ));

        initialData.add(List.of("", "", "", "")); // Linha em branco

        // --- BLOCO 2: PAGAMENTOS ---
        initialData.add(List.of("Data Pagamento", "Valor", "Valor Pendente", ""));

        if (dto.payments() != null && !dto.payments().isEmpty()) {
            for (PaymentRecordDto payment : dto.payments()) {
                initialData.add(List.of(
                        payment.paymentDate() != null ? payment.paymentDate() : "",
                        payment.amount() != null ? payment.amount() : 0.0,
                        payment.pendingAmount() != null ? payment.pendingAmount() : 0.0,
                        ""
                ));
            }
        }

        // 4. Escreve os valores na planilha
        ValueRange body = new ValueRange().setValues(initialData);
        sheets.spreadsheets().values()
                .update(newFileId, "A1:D" + initialData.size(), body)
                .setValueInputOption("USER_ENTERED")
                .execute();

        // 5. APLICA AS BORDAS E FORMATOS VISUAIS
        aplicarEstilosEBordas(newFileId, sheetId, initialData.size());

        return new ContractSummaryDto(newFileId, fileName);
    }

    /**
     * Método auxiliar para aplicar bordas pretas sólidas e cabeçalhos em negrito.
     */
    private void aplicarEstilosEBordas(String fileId, Integer sheetId, int totalLinhas) throws Exception {
        List<Request> requests = new ArrayList<>();

        // Configuração da linha da borda (Sólida, preta e fina)
        Border borderStyle = new Border()
                .setStyle("SOLID")
                .setColor(new Color().setRed(0.0f).setGreen(0.0f).setBlue(0.0f));

        // 1. Aplica bordas completas na tabela do Evento (Linhas 1 e 2)
        requests.add(new Request().setUpdateBorders(new UpdateBordersRequest()
                .setRange(new GridRange()
                        .setSheetId(sheetId)
                        .setStartRowIndex(0)
                        .setEndRowIndex(2)
                        .setStartColumnIndex(0)
                        .setEndColumnIndex(4)
                )
                .setTop(borderStyle)
                .setBottom(borderStyle)
                .setLeft(borderStyle)
                .setRight(borderStyle)
                .setInnerHorizontal(borderStyle)
                .setInnerVertical(borderStyle)
        ));

        // 2. Aplica bordas completas na tabela de Pagamentos (Da linha 4 em diante)
        if (totalLinhas >= 4) {
            requests.add(new Request().setUpdateBorders(new UpdateBordersRequest()
                    .setRange(new GridRange()
                            .setSheetId(sheetId)
                            .setStartRowIndex(3)
                            .setEndRowIndex(totalLinhas)
                            .setStartColumnIndex(0)
                            .setEndColumnIndex(3)
                    )
                    .setTop(borderStyle)
                    .setBottom(borderStyle)
                    .setLeft(borderStyle)
                    .setRight(borderStyle)
                    .setInnerHorizontal(borderStyle)
                    .setInnerVertical(borderStyle)
            ));
        }

        // 3. Deixa os cabeçalhos (Linha 1 e Linha 4) em NEGRITO
        CellFormat headerFormat = new CellFormat().setTextFormat(new TextFormat().setBold(true));

        requests.add(new Request().setRepeatCell(new RepeatCellRequest()
                .setRange(new GridRange().setSheetId(sheetId).setStartRowIndex(0).setEndRowIndex(1).setStartColumnIndex(0).setEndColumnIndex(4))
                .setCell(new CellData().setUserEnteredFormat(headerFormat))
                .setFields("userEnteredFormat.textFormat.bold")));

        requests.add(new Request().setRepeatCell(new RepeatCellRequest()
                .setRange(new GridRange().setSheetId(sheetId).setStartRowIndex(3).setEndRowIndex(4).setStartColumnIndex(0).setEndColumnIndex(3))
                .setCell(new CellData().setUserEnteredFormat(headerFormat))
                .setFields("userEnteredFormat.textFormat.bold")));

        // Envia o lote de requisições
        BatchUpdateSpreadsheetRequest batchBody = new BatchUpdateSpreadsheetRequest().setRequests(requests);
        sheets.spreadsheets().batchUpdate(fileId, batchBody).execute();
    }

    /**
     * 4. Atualizar o conteúdo de uma planilha existente
     */
     public void updateContract(String fileId, ContractDetailDto dto) throws Exception {
        if (fileId == null || fileId.isBlank()) {
            throw new IllegalArgumentException("O fileId da planilha é obrigatório.");
        }
        if (dto == null || dto.event() == null) {
            throw new IllegalArgumentException("Os dados do evento são obrigatórios.");
        }

        EventDto event = dto.event();
        String formattedClientName = event.clientName() != null ? event.clientName().trim().toUpperCase() : "";
        String eventDate = event.eventDate() != null ? event.eventDate().trim() : "";

        // 1. Limpa os valores antigos do intervalo da planilha
        sheets.spreadsheets().values()
                .clear(fileId, "A1:D100", new ClearValuesRequest())
                .execute();

        // 2. Monta a nova estrutura com os dois blocos (Evento e Pagamentos)
        List<List<Object>> updatedData = new ArrayList<>();

        // --- BLOCO 1: EVENTO ---
        updatedData.add(List.of("Cliente", "Data do Evento", "Valor Parcela", "Valor Total"));
        updatedData.add(List.of(
                formattedClientName,
                eventDate,
                event.installmentValue() != null ? event.installmentValue() : 0.0,
                event.totalValue() != null ? event.totalValue() : 0.0
        ));

        updatedData.add(List.of("", "", "", "")); // Linha em branco para separação visual

        // --- BLOCO 2: PAGAMENTOS ---
        updatedData.add(List.of("Data Pagamento", "Valor", "Valor Pendente", ""));

        if (dto.payments() != null && !dto.payments().isEmpty()) {
            for (PaymentRecordDto payment : dto.payments()) {
                updatedData.add(List.of(
                        payment.paymentDate() != null ? payment.paymentDate() : "",
                        payment.amount() != null ? payment.amount() : 0.0,
                        payment.pendingAmount() != null ? payment.pendingAmount() : 0.0,
                        ""
                ));
            }
        }

        // 3. Escreve a nova matriz de dados na planilha
        ValueRange body = new ValueRange().setValues(updatedData);
        sheets.spreadsheets().values()
                .update(fileId, "A1:D" + updatedData.size(), body)
                .setValueInputOption("USER_ENTERED")
                .execute();

        // 4. Obtém o sheetId da primeira aba para reaplicar a formatação visual
        Spreadsheet spreadsheet = sheets.spreadsheets().get(fileId).execute();
        Integer sheetId = spreadsheet.getSheets().get(0).getProperties().getSheetId();

        // 5. Re-aplica as bordas sólidas e cabeçalhos em negrito
        aplicarEstilosEBordas(fileId, sheetId, updatedData.size());
    }

    private Double parseDoubleSafe(String value) {
        try {
            return Double.parseDouble(value.replace(",", "."));
        } catch (Exception e) {
            return 0.0;
        }
    }

    public List<ContractSummaryDto> searchByTitle(String title) throws Exception {
        // Monta a query filtrando por parte do nome, dentro da pasta correta, apenas planilhas e que não estejam na lixeira
        String sanitizedTitle = title != null ? title.replace("'", "\\'") : "";

        String query = String.format(
                "'%s' in parents and name contains '%s' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
                folderId, sanitizedTitle
        );

        FileList result = drive.files().list()
                .setQ(query)
                .setSpaces("drive")
                .setFields("files(id, name)")
                .execute();

        List<ContractSummaryDto> summaries = new ArrayList<>();
        if (result.getFiles() != null) {
            for (File file : result.getFiles()) {
                summaries.add(new ContractSummaryDto(file.getId(), file.getName()));
            }
        }
        return summaries;
    }
}