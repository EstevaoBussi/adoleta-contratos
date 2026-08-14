package com.adoleta.google.contrato.service;

import com.adoleta.google.contrato.dto.*;
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.util.DateTime;
import com.google.api.services.calendar.Calendar;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.FileList;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.model.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Service
public class ContractService {

    private final Drive drive;
    private final Sheets sheets;
    private final Calendar calendar;

    @Value("${google.drive.folder-id:}")
    private String folderId;

    @Value("${google.drive.contrato-aberto-id}")
    private String folderAbertoId;

    @Value("${google.drive.contrato-quitado-id}")
    private String folderQuitadoId;

    @Value("${google.drive.contrato-cancelado-id}")
    private String folderCanceladoId;

    @Value("${google.drive.contrato-realizado-id}")
    private String folderRealizadoId;

    public ContractService(Drive drive, Sheets sheets, Calendar calendar) {
        this.drive = drive;
        this.sheets = sheets;
        this.calendar = calendar;
    }

    private <T> T executarComResiliencia(GoogleOperation<T> operation) throws Exception {
        int tentativas = 2;
        long tempoEsperaMs = 2000;

        for (int i = 1; i <= tentativas; i++) {
            try {
                return operation.execute();
            } catch (ResponseStatusException e) {
                throw e;
            } catch (GoogleJsonResponseException e) {
                if (i == tentativas || (e.getStatusCode() != 401 && e.getStatusCode() != 403 && e.getStatusCode() < 500)) {
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Erro na API do Google: " + e.getMessage(), e);
                }
            } catch (IOException e) {
                if (i == tentativas) {
                    throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Falha temporária de conexão com os serviços do Google. Tente novamente.", e);
                }
            }

            try {
                Thread.sleep(tempoEsperaMs);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível concluir a operação com os serviços do Google.");
    }

    @FunctionalInterface
    private interface GoogleOperation<T> {
        T execute() throws Exception;
    }

    private String getFolderIdByStatus(String status) {
        if (status == null) return folderAbertoId;
        switch (status.toUpperCase()) {
            case "QUITADO": return folderQuitadoId;
            case "CANCELADO": return folderCanceladoId;
            case "REALIZADO": return folderRealizadoId;
            case "ABERTO":
            default: return folderAbertoId;
        }
    }

    private String descobrirStatusAtualDoArquivo(File file) {
        if (file.getParents() != null) {
            for (String parentId : file.getParents()) {
                if (parentId.equals(folderQuitadoId)) return "QUITADO";
                if (parentId.equals(folderCanceladoId)) return "CANCELADO";
                if (parentId.equals(folderRealizadoId)) return "REALIZADO";
                if (parentId.equals(folderAbertoId)) return "ABERTO";
            }
        }
        return "ABERTO";
    }

    private String descobrirStatusAtualDoArquivo(String fileId) throws Exception {
        File file = drive.files().get(fileId).setFields("parents").execute();
        return descobrirStatusAtualDoArquivo(file);
    }

    private void moverArquivoParaPasta(String fileId, String novoStatus) throws Exception {
        String targetFolderId = getFolderIdByStatus(novoStatus);
        if (targetFolderId == null || targetFolderId.isBlank()) return;

        File file = drive.files().get(fileId).setFields("parents").execute();
        StringBuilder previousParents = new StringBuilder();
        if (file.getParents() != null) {
            for (String parent : file.getParents()) {
                previousParents.append(parent).append(",");
            }
        }

        drive.files().update(fileId, null)
                .setAddParents(targetFolderId)
                .setRemoveParents(previousParents.toString())
                .setSupportsAllDrives(true)
                .setFields("id, parents")
                .execute();
    }

    public List<ContractSummaryDto> listContracts() throws Exception {
        return executarComResiliencia(() -> {
            List<String> folders = List.of(folderAbertoId, folderQuitadoId, folderCanceladoId, folderRealizadoId);
            List<File> allFiles = new ArrayList<>();

            for (String fId : folders) {
                if (fId == null || fId.isBlank()) continue;
                String query = String.format("'%s' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false", fId);
                FileList result = drive.files().list().setQ(query).setFields("files(id, name, parents)").execute();
                if (result.getFiles() != null) {
                    allFiles.addAll(result.getFiles());
                }
            }

            return allFiles.stream()
                    .map(f -> new ContractSummaryDto(f.getId(), f.getName(), descobrirStatusAtualDoArquivo(f)))
                    .toList();
        });
    }

    public ContractDetailDto getContractDetail(String fileId) throws Exception {
        return executarComResiliencia(() -> {
            File file = drive.files().get(fileId).setFields("name, parents").execute();

            String statusAtual = descobrirStatusAtualDoArquivo(file);

            ValueRange response = sheets.spreadsheets().values()
                    .get(fileId, "A1:L100")
                    .execute();

            List<List<Object>> values = response.getValues();

            if (values == null || values.isEmpty()) {
                return new ContractDetailDto(fileId, file.getName(), statusAtual, new EventDto("", "", 0, "", "", 0.0, 0.0, "", "", "", ""), List.of());
            }

            EventDto eventData = new EventDto("", "", 0, "", "", 0.0, 0.0, "", "", "", "");
            List<PaymentRecordDto> payments = new ArrayList<>();
            boolean lendoPagamentos = false;

            List<Object> firstRow = values.get(0);
            String firstCell = (firstRow != null && !firstRow.isEmpty()) ? firstRow.get(0).toString().trim() : "";

            if (firstCell.equalsIgnoreCase("Cliente")) {
                if (values.size() > 1) {
                    List<Object> eventRow = values.get(1);
                    eventData = extrairEventDto(eventRow);
                }
            } else {
                eventData = extrairEventDto(firstRow);
            }

            for (int i = 0; i < values.size(); i++) {
                List<Object> row = values.get(i);
                if (row == null || row.isEmpty()) continue;

                String primeiraColuna = row.get(0).toString().trim();

                if (primeiraColuna.equalsIgnoreCase("Data Pagamento")) {
                    lendoPagamentos = true;
                    continue;
                }

                if (lendoPagamentos) {
                    String date = row.size() > 0 ? row.get(0).toString().trim() : "";
                    if (date.isBlank()) continue;

                    Double amount = row.size() > 1 ? parseDoubleSafe(row.get(1).toString()) : 0.0;
                    Double pending = row.size() > 2 ? parseDoubleSafe(row.get(2).toString()) : 0.0;

                    payments.add(new PaymentRecordDto(date, amount, pending));
                }
            }

            return new ContractDetailDto(fileId, file.getName(), statusAtual, eventData, payments);
        });
    }

    private EventDto extrairEventDto(List<Object> eventRow) {
        if (eventRow == null || eventRow.isEmpty()) {
            return new EventDto("", "", 0, "", "", 0.0, 0.0, "", "", "", "");
        }
        return new EventDto(
                eventRow.size() > 0 ? eventRow.get(0).toString() : "",
                eventRow.size() > 1 ? eventRow.get(1).toString() : "",
                eventRow.size() > 2 ? parseIntSafe(eventRow.get(2).toString()) : 0,
                eventRow.size() > 3 ? eventRow.get(3).toString() : "",
                eventRow.size() > 4 ? eventRow.get(4).toString() : "",
                eventRow.size() > 5 ? parseDoubleSafe(eventRow.get(5).toString()) : 0.0,
                eventRow.size() > 6 ? parseDoubleSafe(eventRow.get(6).toString()) : 0.0,
                eventRow.size() > 7 ? eventRow.get(7).toString() : "",
                eventRow.size() > 8 ? eventRow.get(8).toString() : "",
                eventRow.size() > 9 ? eventRow.get(9).toString() : "",
                eventRow.size() > 10 ? eventRow.get(10).toString() : ""
        );
    }

    public ContractSummaryDto createContract(ContractDetailDto dto, String status) throws Exception {
        if (dto == null || dto.event() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Os dados do evento são obrigatórios.");
        }

        if ("QUITADO".equalsIgnoreCase(status)) {
            double valorTotal = dto.event().totalValue() != null ? dto.event().totalValue() : 0.0;
            double ultimoValorPendente = 0.0;
            if (dto.payments() != null && !dto.payments().isEmpty()) {
                PaymentRecordDto ultimoPagamento = dto.payments().get(dto.payments().size() - 1);
                ultimoValorPendente = ultimoPagamento.pendingAmount() != null ? ultimoPagamento.pendingAmount() : 0.0;
            } else {
                ultimoValorPendente = valorTotal;
            }

            if (ultimoValorPendente > 0.0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "O contrato só pode ser definido como QUITADO se o valor pendente for igual ou menor que zero.");
            }
        }

        return executarComResiliencia(() -> {
            EventDto event = dto.event();
            String formattedClientName = event.clientName() != null ? event.clientName().trim().toUpperCase() : "";
            String eventDate = event.eventDate() != null ? event.eventDate().trim() : "";

            String fileName = dto.fileName() != null && !dto.fileName().isBlank()
                    ? dto.fileName()
                    : String.format("%s - %s", eventDate, formattedClientName);

            Spreadsheet spreadsheetMetadata = new Spreadsheet()
                    .setProperties(new SpreadsheetProperties().setTitle(fileName));

            Spreadsheet createdSpreadsheet = sheets.spreadsheets().create(spreadsheetMetadata).execute();
            String newFileId = createdSpreadsheet.getSpreadsheetId();
            Integer sheetId = createdSpreadsheet.getSheets().get(0).getProperties().getSheetId();

            String targetFolderId = getFolderIdByStatus(status);
            if (targetFolderId != null && !targetFolderId.isBlank()) {
                drive.files().update(newFileId, null)
                        .setAddParents(targetFolderId)
                        .setSupportsAllDrives(true)
                        .execute();
            }

            String calendarEventId = null;
            if (!"CANCELADO".equalsIgnoreCase(status)) {
                calendarEventId = sincronizarComAgenda(newFileId, event, null);
            }

            List<List<Object>> initialData = new ArrayList<>();
            initialData.add(List.of("Cliente", "Data do Evento", "Qtd Convidados", "Início", "Término", "Valor Parcela", "Valor Total", "Bolo", "Opcionais", "Descrição", "Telefone", "Calendar Event ID"));
            initialData.add(List.of(
                    formattedClientName,
                    eventDate,
                    event.guestCount() != null ? event.guestCount() : 0,
                    event.startTime() != null ? event.startTime() : "",
                    event.endTime() != null ? event.endTime() : "",
                    event.installmentValue() != null ? event.installmentValue() : 0.0,
                    event.totalValue() != null ? event.totalValue() : 0.0,
                    event.bolo() != null ? event.bolo() : "",
                    event.opcionais() != null ? event.opcionais() : "",
                    event.descricao() != null ? event.descricao() : "",
                    event.telefone() != null ? event.telefone() : "",
                    calendarEventId != null ? calendarEventId : ""
            ));

            initialData.add(List.of("", "", "", "", "", "", "", "", "", "", "", ""));
            initialData.add(List.of("Data Pagamento", "Valor", "Valor Pendente", "", "", "", "", "", "", "", "", ""));

            if (dto.payments() != null && !dto.payments().isEmpty()) {
                for (PaymentRecordDto payment : dto.payments()) {
                    initialData.add(List.of(
                            payment.paymentDate() != null ? payment.paymentDate() : "",
                            payment.amount() != null ? payment.amount() : 0.0,
                            payment.pendingAmount() != null ? payment.pendingAmount() : 0.0,
                            "", "", "", "", "", "", "", "", ""
                    ));
                }
            }

            ValueRange body = new ValueRange().setValues(initialData);
            sheets.spreadsheets().values()
                    .update(newFileId, "A1:L" + initialData.size(), body)
                    .setValueInputOption("USER_ENTERED")
                    .execute();

            aplicarEstilosEBordas(newFileId, sheetId, initialData.size());

            return new ContractSummaryDto(newFileId, fileName, status != null ? status.toUpperCase() : "ABERTO");
        });
    }

    public void updateContract(String fileId, ContractDetailDto dto, String status) throws Exception {
        if (fileId == null || fileId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O fileId da planilha é obrigatório.");
        }
        if (dto == null || dto.event() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Os dados do evento são obrigatórios.");
        }

        String statusAtualNoDrive = descobrirStatusAtualDoArquivo(fileId);

        if ("REALIZADO".equalsIgnoreCase(statusAtualNoDrive) || "CANCELADO".equalsIgnoreCase(statusAtualNoDrive)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Contratos com status " + statusAtualNoDrive + " são finais e não podem mais ser alterados.");
        }

        if ("QUITADO".equalsIgnoreCase(status)) {
            double valorPendenteAtual = 0.0;

            if (dto.payments() != null && !dto.payments().isEmpty()) {
                PaymentRecordDto ultimoPagamento = dto.payments().get(dto.payments().size() - 1);
                valorPendenteAtual = ultimoPagamento.pendingAmount() != null ? ultimoPagamento.pendingAmount() : 0.0;
            } else {
                valorPendenteAtual = dto.event().totalValue() != null ? dto.event().totalValue() : 0.0;
            }

            if (valorPendenteAtual > 0.0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "O contrato só pode ir para QUITADO se o valor pendente for igual ou menor que zero.");
            }
        }

        executarComResiliencia(() -> {
            moverArquivoParaPasta(fileId, status);

            String existingCalendarEventId = null;
            try {
                ValueRange existingData = sheets.spreadsheets().values().get(fileId, "L2").execute();
                if (existingData.getValues() != null && !existingData.getValues().isEmpty()) {
                    List<Object> row = existingData.getValues().get(0);
                    if (!row.isEmpty() && row.get(0) != null) {
                        String val = row.get(0).toString().trim();
                        if (!val.isBlank() && !val.equalsIgnoreCase("null")) {
                            existingCalendarEventId = val;
                        }
                    }
                }
            } catch (Exception e) {
                existingCalendarEventId = null;
            }

            EventDto event = dto.event();
            String formattedClientName = event.clientName() != null ? event.clientName().trim().toUpperCase() : "";
            String eventDate = event.eventDate() != null ? event.eventDate().trim() : "";

            String calendarEventId = null;

            if ("CANCELADO".equalsIgnoreCase(status)) {
                if (existingCalendarEventId != null && !existingCalendarEventId.isBlank()) {
                    try {
                        calendar.events().delete("primary", existingCalendarEventId).execute();
                    } catch (Exception ignored) {}
                }
                calendarEventId = "";
            } else {
                calendarEventId = sincronizarComAgenda(fileId, event, existingCalendarEventId);
            }

            sheets.spreadsheets().values()
                    .clear(fileId, "A1:L100", new ClearValuesRequest())
                    .execute();

            List<List<Object>> updatedData = new ArrayList<>();
            updatedData.add(List.of("Cliente", "Data do Evento", "Qtd Convidados", "Início", "Término", "Valor Parcela", "Valor Total", "Bolo", "Opcionais", "Descrição", "Telefone", "Calendar Event ID"));
            updatedData.add(List.of(
                    formattedClientName,
                    eventDate,
                    event.guestCount() != null ? event.guestCount() : 0,
                    event.startTime() != null ? event.startTime() : "",
                    event.endTime() != null ? event.endTime() : "",
                    event.installmentValue() != null ? event.installmentValue() : 0.0,
                    event.totalValue() != null ? event.totalValue() : 0.0,
                    event.bolo() != null ? event.bolo() : "",
                    event.opcionais() != null ? event.opcionais() : "",
                    event.descricao() != null ? event.descricao() : "",
                    event.telefone() != null ? event.telefone() : "",
                    calendarEventId != null ? calendarEventId : ""
            ));

            updatedData.add(List.of("", "", "", "", "", "", "", "", "", "", "", ""));
            updatedData.add(List.of("Data Pagamento", "Valor", "Valor Pendente", "", "", "", "", "", "", "", "", ""));

            if (dto.payments() != null && !dto.payments().isEmpty()) {
                for (PaymentRecordDto payment : dto.payments()) {
                    updatedData.add(List.of(
                            payment.paymentDate() != null ? payment.paymentDate() : "",
                            payment.amount() != null ? payment.amount() : 0.0,
                            payment.pendingAmount() != null ? payment.pendingAmount() : 0.0,
                            "", "", "", "", "", "", "", "", ""
                    ));
                }
            }

            ValueRange body = new ValueRange().setValues(updatedData);
            sheets.spreadsheets().values()
                    .update(fileId, "A1:L" + updatedData.size(), body)
                    .setValueInputOption("USER_ENTERED")
                    .execute();

            Spreadsheet spreadsheet = sheets.spreadsheets().get(fileId).execute();
            Integer sheetId = spreadsheet.getSheets().get(0).getProperties().getSheetId();

            aplicarEstilosEBordas(fileId, sheetId, updatedData.size());
            return null;
        });
    }

    private String sincronizarComAgenda(String fileId, EventDto eventDto, String existingEventId) {
        try {
            String summary = String.format("EVENTO - %s (ADOLÊTA KIDS)", eventDto.clientName());
            String driveLink = String.format("https://docs.google.com/spreadsheets/d/%s/edit", fileId);

            String description = String.format("Telefone: %s\nConvidados: %d\nBolo: %s\nOpcionais: %s\nObs: \n%s\n\nPlanilha do Contrato: %s",
                    eventDto.telefone() == null ? "" : eventDto.telefone(),
                    eventDto.guestCount() != null ? eventDto.guestCount() : 0,
                    eventDto.bolo() == null ? "" : eventDto.bolo(),
                    eventDto.opcionais() == null ? "" : eventDto.opcionais(),
                    eventDto.descricao() == null ? "" : eventDto.descricao(), driveLink);

            Event calendarEvent = new Event()
                    .setSummary(summary)
                    .setDescription(description)
                    .setLocation("Adolêta Kids - Guarulhos, SP");

            if (eventDto.eventDate() != null && !eventDto.eventDate().isBlank()) {
                String dateStr = eventDto.eventDate().length() >= 10 ? eventDto.eventDate().substring(0, 10) : eventDto.eventDate();
                String startHour = (eventDto.startTime() != null && !eventDto.startTime().isBlank()) ? eventDto.startTime() : "14:00";
                String endHour = (eventDto.endTime() != null && !eventDto.endTime().isBlank()) ? eventDto.endTime() : "18:00";

                DateTime startDateTime = new DateTime(dateStr + "T" + startHour + ":00-03:00");
                DateTime endDateTime = new DateTime(dateStr + "T" + endHour + ":00-03:00");

                calendarEvent.setStart(new EventDateTime().setDateTime(startDateTime));
                calendarEvent.setEnd(new EventDateTime().setDateTime(endDateTime));
            }

            Event savedEvent;
            if (existingEventId != null && !existingEventId.isBlank()) {
                try {
                    savedEvent = calendar.events().update("primary", existingEventId, calendarEvent).execute();
                    return savedEvent.getId();
                } catch (Exception e) {
                    savedEvent = calendar.events().insert("primary", calendarEvent).execute();
                    return savedEvent.getId();
                }
            } else {
                savedEvent = calendar.events().insert("primary", calendarEvent).execute();
                return savedEvent.getId();
            }

        } catch (Exception e) {
            System.err.println("=== ERRO DETALHADO DO GOOGLE CALENDAR ===");
            e.printStackTrace();
            return null;
        }
    }

    private void aplicarEstilosEBordas(String fileId, Integer sheetId, int totalLinhas) throws Exception {
        List<Request> requests = new ArrayList<>();

        Border borderStyle = new Border()
                .setStyle("SOLID")
                .setColor(new Color().setRed(0.0f).setGreen(0.0f).setBlue(0.0f));

        requests.add(new Request().setUpdateBorders(new UpdateBordersRequest()
                .setRange(new GridRange().setSheetId(sheetId).setStartRowIndex(0).setEndRowIndex(2).setStartColumnIndex(0).setEndColumnIndex(12))
                .setTop(borderStyle).setBottom(borderStyle).setLeft(borderStyle).setRight(borderStyle)
                .setInnerHorizontal(borderStyle).setInnerVertical(borderStyle)
        ));

        if (totalLinhas >= 4) {
            requests.add(new Request().setUpdateBorders(new UpdateBordersRequest()
                    .setRange(new GridRange().setSheetId(sheetId).setStartRowIndex(3).setEndRowIndex(totalLinhas).setStartColumnIndex(0).setEndColumnIndex(3))
                    .setTop(borderStyle).setBottom(borderStyle).setLeft(borderStyle).setRight(borderStyle)
                    .setInnerHorizontal(borderStyle).setInnerVertical(borderStyle)
            ));
        }

        CellFormat headerFormat = new CellFormat().setTextFormat(new TextFormat().setBold(true));

        requests.add(new Request().setRepeatCell(new RepeatCellRequest()
                .setRange(new GridRange().setSheetId(sheetId).setStartRowIndex(0).setEndRowIndex(1).setStartColumnIndex(0).setEndColumnIndex(12))
                .setCell(new CellData().setUserEnteredFormat(headerFormat))
                .setFields("userEnteredFormat.textFormat.bold")));

        BatchUpdateSpreadsheetRequest batchBody = new BatchUpdateSpreadsheetRequest().setRequests(requests);
        sheets.spreadsheets().batchUpdate(fileId, batchBody).execute();
    }

    private Double parseDoubleSafe(String value) {
        try {
            return Double.parseDouble(value.replace(",", "."));
        } catch (Exception e) {
            return 0.0;
        }
    }

    private Integer parseIntSafe(String value) {
        try {
            return Integer.parseInt(value.trim());
        } catch (Exception e) {
            return 0;
        }
    }

    public List<ContractSummaryDto> searchByTitle(String title) throws Exception {
        return searchByTitle(title, null);
    }

    public List<ContractSummaryDto> searchByTitle(String title, String status) throws Exception {
        return executarComResiliencia(() -> {
            String sanitizedTitle = title != null ? title.replace("'", "\\'") : "";

            // Se um status específico foi informado, busca apenas na pasta daquele status para otimizar
            List<String> folders = new ArrayList<>();
            if (status != null && !status.isBlank() && !status.equalsIgnoreCase("TODOS")) {
                String singleFolder = getFolderIdByStatus(status);
                if (singleFolder != null && !singleFolder.isBlank()) {
                    folders.add(singleFolder);
                }
            } else {
                folders = List.of(folderAbertoId, folderQuitadoId, folderCanceladoId, folderRealizadoId);
            }

            List<ContractSummaryDto> summaries = new ArrayList<>();

            for (String fId : folders) {
                if (fId == null || fId.isBlank()) continue;
                String query = String.format(
                        "'%s' in parents and name contains '%s' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
                        fId, sanitizedTitle
                );

                FileList result = drive.files().list()
                        .setQ(query)
                        .setSpaces("drive")
                        .setFields("files(id, name, parents)")
                        .execute();

                if (result.getFiles() != null) {
                    for (File file : result.getFiles()) {
                        summaries.add(new ContractSummaryDto(file.getId(), file.getName(), descobrirStatusAtualDoArquivo(file)));
                    }
                }
            }
            return summaries;
        });
    }
}