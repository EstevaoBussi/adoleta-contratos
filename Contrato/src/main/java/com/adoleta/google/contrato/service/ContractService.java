package com.adoleta.google.contrato.service;

import com.adoleta.google.contrato.dto.*;
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
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class ContractService {

    private final Drive drive;
    private final Sheets sheets;
    private final Calendar calendar;

    @Value("${google.drive.folder-id}")
    private String folderId;

    public ContractService(Drive drive, Sheets sheets, Calendar calendar) {
        this.drive = drive;
        this.sheets = sheets;
        this.calendar = calendar;
    }

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

    public ContractDetailDto getContractDetail(String fileId) throws Exception {
        File file = drive.files().get(fileId).setFields("name").execute();

        // Aumentado para K para ler também o Calendar Event ID na coluna K
        ValueRange response = sheets.spreadsheets().values()
                .get(fileId, "A1:K100")
                .execute();

        List<List<Object>> values = response.getValues();

        if (values == null || values.isEmpty()) {
            return new ContractDetailDto(fileId, file.getName(), new EventDto("", "", 0, "", "", 0.0, 0.0, "", "", ""), List.of());
        }

        EventDto eventData = new EventDto("", "", 0, "", "", 0.0, 0.0, "", "", "");
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

        return new ContractDetailDto(fileId, file.getName(), eventData, payments);
    }

    private EventDto extrairEventDto(List<Object> eventRow) {
        if (eventRow == null || eventRow.isEmpty()) {
            return new EventDto("", "", 0, "", "", 0.0, 0.0, "", "", "");
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
                eventRow.size() > 9 ? eventRow.get(9).toString() : ""
        );
    }

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

        Spreadsheet spreadsheetMetadata = new Spreadsheet()
                .setProperties(new SpreadsheetProperties().setTitle(fileName));

        Spreadsheet createdSpreadsheet = sheets.spreadsheets().create(spreadsheetMetadata).execute();
        String newFileId = createdSpreadsheet.getSpreadsheetId();
        Integer sheetId = createdSpreadsheet.getSheets().get(0).getProperties().getSheetId();

        if (folderId != null && !folderId.isBlank()) {
            drive.files().update(newFileId, null)
                    .setAddParents(folderId)
                    .setSupportsAllDrives(true)
                    .execute();
        }

        // Sincroniza primeiro para obter o ID do evento criado na agenda
        String calendarEventId = sincronizarComAgenda(newFileId, event, null);

        List<List<Object>> initialData = new ArrayList<>();

        // Cabeçalho expandido com a coluna K para o ID do Calendar (Total: 11 colunas, A até K)
        initialData.add(List.of("Cliente", "Data do Evento", "Qtd Convidados", "Início", "Término", "Valor Parcela", "Valor Total", "Bolo", "Opcionais", "Descrição", "Calendar Event ID"));
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
                calendarEventId != null ? calendarEventId : ""
        ));

        initialData.add(List.of("", "", "", "", "", "", "", "", "", "", ""));
        initialData.add(List.of("Data Pagamento", "Valor", "Valor Pendente", "", "", "", "", "", "", "", ""));

        if (dto.payments() != null && !dto.payments().isEmpty()) {
            for (PaymentRecordDto payment : dto.payments()) {
                initialData.add(List.of(
                        payment.paymentDate() != null ? payment.paymentDate() : "",
                        payment.amount() != null ? payment.amount() : 0.0,
                        payment.pendingAmount() != null ? payment.pendingAmount() : 0.0,
                        "", "", "", "", "", "", "", ""
                ));
            }
        }

        ValueRange body = new ValueRange().setValues(initialData);
        sheets.spreadsheets().values()
                .update(newFileId, "A1:K" + initialData.size(), body)
                .setValueInputOption("USER_ENTERED")
                .execute();

        aplicarEstilosEBordas(newFileId, sheetId, initialData.size());

        return new ContractSummaryDto(newFileId, fileName);
    }

    public void updateContract(String fileId, ContractDetailDto dto) throws Exception {
        if (fileId == null || fileId.isBlank()) {
            throw new IllegalArgumentException("O fileId da planilha é obrigatório.");
        }
        if (dto == null || dto.event() == null) {
            throw new IllegalArgumentException("Os dados do evento são obrigatórios.");
        }

        // 1. Busca o Calendar Event ID anterior salvo na célula K2 da planilha
        String existingCalendarEventId = null;
        try {
            ValueRange existingData = sheets.spreadsheets().values().get(fileId, "K2").execute();
            if (existingData.getValues() != null && !existingData.getValues().isEmpty()) {
                List<Object> row = existingData.getValues().get(0);
                if (!row.isEmpty() && row.get(0) != null) {
                    existingCalendarEventId = row.get(0).toString().trim();
                }
            }
        } catch (Exception ignored) {
            // Se a coluna K ainda não existir na planilha antiga, segue fluxo normal
        }

        EventDto event = dto.event();
        String formattedClientName = event.clientName() != null ? event.clientName().trim().toUpperCase() : "";
        String eventDate = event.eventDate() != null ? event.eventDate().trim() : "";

        // 2. Sincroniza com a agenda (atualizando o evento existente ou criando se não houver ID)
        String calendarEventId = sincronizarComAgenda(fileId, event, existingCalendarEventId);

        sheets.spreadsheets().values()
                .clear(fileId, "A1:K100", new ClearValuesRequest())
                .execute();

        List<List<Object>> updatedData = new ArrayList<>();

        updatedData.add(List.of("Cliente", "Data do Evento", "Qtd Convidados", "Início", "Término", "Valor Parcela", "Valor Total", "Bolo", "Opcionais", "Descrição", "Calendar Event ID"));
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
                calendarEventId != null ? calendarEventId : (existingCalendarEventId != null ? existingCalendarEventId : "")
        ));

        updatedData.add(List.of("", "", "", "", "", "", "", "", "", "", ""));
        updatedData.add(List.of("Data Pagamento", "Valor", "Valor Pendente", "", "", "", "", "", "", "", ""));

        if (dto.payments() != null && !dto.payments().isEmpty()) {
            for (PaymentRecordDto payment : dto.payments()) {
                updatedData.add(List.of(
                        payment.paymentDate() != null ? payment.paymentDate() : "",
                        payment.amount() != null ? payment.amount() : 0.0,
                        payment.pendingAmount() != null ? payment.pendingAmount() : 0.0,
                        "", "", "", "", "", "", "", ""
                ));
            }
        }

        ValueRange body = new ValueRange().setValues(updatedData);
        sheets.spreadsheets().values()
                .update(fileId, "A1:K" + updatedData.size(), body)
                .setValueInputOption("USER_ENTERED")
                .execute();

        Spreadsheet spreadsheet = sheets.spreadsheets().get(fileId).execute();
        Integer sheetId = spreadsheet.getSheets().get(0).getProperties().getSheetId();

        aplicarEstilosEBordas(fileId, sheetId, updatedData.size());
    }

    private String sincronizarComAgenda(String fileId, EventDto eventDto, String existingEventId) {
        try {
            String summary = String.format("EVENTO - %s (ADOLÊTA KIDS)", eventDto.clientName());
            String driveLink = String.format("https://docs.google.com/spreadsheets/d/%s/edit", fileId);

            String description = String.format("Convidados: %d\nBolo: %s\nOpcionais: %s\nObs: \n%s\n\nPlanilha do Contrato: %s",
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
                savedEvent = calendar.events().update("primary", existingEventId, calendarEvent).execute();
                return savedEvent.getId();
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

        // Ajustado para A até K (11 colunas, índice 0 a 11)
        requests.add(new Request().setUpdateBorders(new UpdateBordersRequest()
                .setRange(new GridRange()
                        .setSheetId(sheetId)
                        .setStartRowIndex(0)
                        .setEndRowIndex(2)
                        .setStartColumnIndex(0)
                        .setEndColumnIndex(11)
                )
                .setTop(borderStyle).setBottom(borderStyle).setLeft(borderStyle).setRight(borderStyle)
                .setInnerHorizontal(borderStyle).setInnerVertical(borderStyle)
        ));

        if (totalLinhas >= 4) {
            requests.add(new Request().setUpdateBorders(new UpdateBordersRequest()
                    .setRange(new GridRange()
                            .setSheetId(sheetId)
                            .setStartRowIndex(3)
                            .setEndRowIndex(totalLinhas)
                            .setStartColumnIndex(0)
                            .setEndColumnIndex(3)
                    )
                    .setTop(borderStyle).setBottom(borderStyle).setLeft(borderStyle).setRight(borderStyle)
                    .setInnerHorizontal(borderStyle).setInnerVertical(borderStyle)
            ));
        }

        CellFormat headerFormat = new CellFormat().setTextFormat(new TextFormat().setBold(true));

        requests.add(new Request().setRepeatCell(new RepeatCellRequest()
                .setRange(new GridRange().setSheetId(sheetId).setStartRowIndex(0).setEndRowIndex(1).setStartColumnIndex(0).setEndColumnIndex(11))
                .setCell(new CellData().setUserEnteredFormat(headerFormat))
                .setFields("userEnteredFormat.textFormat.bold")));

        requests.add(new Request().setRepeatCell(new RepeatCellRequest()
                .setRange(new GridRange().setSheetId(sheetId).setStartRowIndex(3).setEndRowIndex(4).setStartColumnIndex(0).setEndColumnIndex(3))
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