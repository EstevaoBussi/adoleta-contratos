package com.adoleta.google.contrato.config;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.extensions.java6.auth.oauth2.AuthorizationCodeInstalledApp;
import com.google.api.client.extensions.jetty.auth.oauth2.LocalServerReceiver;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.store.FileDataStoreFactory;
import com.google.api.services.calendar.CalendarScopes;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.DriveScopes;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.SheetsScopes;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.List;

@Configuration
public class GoogleConfig {

    private static final String TOKENS_DIRECTORY_PATH = "tokens";
    private static final String USER_ID = "user"; // Identificador padrão para o armazenamento do token

    @Bean
    public com.google.api.services.calendar.Calendar calendar(Credential credential) throws Exception {
        NetHttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();
        JsonFactory jsonFactory = GsonFactory.getDefaultInstance();

        return new com.google.api.services.calendar.Calendar.Builder(httpTransport, jsonFactory, credential)
                .setApplicationName("Adolêta Contratos")
                .build();
    }

    @Bean
    public Credential googleCredential() throws Exception {
        InputStream in = getClass().getResourceAsStream("/credentials.json");
        if (in == null) {
            throw new IllegalArgumentException("Arquivo credentials.json não encontrado em resources.");
        }

        GoogleClientSecrets clientSecrets = GoogleClientSecrets.load(
                GsonFactory.getDefaultInstance(), new InputStreamReader(in)
        );

        List<String> scopes = List.of(
                DriveScopes.DRIVE,
                SheetsScopes.SPREADSHEETS,
                CalendarScopes.CALENDAR
        );

        NetHttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();
        JsonFactory jsonFactory = GsonFactory.getDefaultInstance();

        // Garante que o diretório de tokens exista de forma absoluta
        java.io.File tokenDir = new java.io.File(TOKENS_DIRECTORY_PATH);
        if (!tokenDir.exists()) {
            tokenDir.mkdirs();
        }

        // Configura o DataStoreFactory para salvar os tokens gerados em disco
        FileDataStoreFactory dataStoreFactory = new FileDataStoreFactory(tokenDir);

        GoogleAuthorizationCodeFlow flow = new GoogleAuthorizationCodeFlow.Builder(
                httpTransport,
                jsonFactory,
                clientSecrets,
                scopes
        )
                .setDataStoreFactory(dataStoreFactory)
                .setAccessType("offline")
                .setApprovalPrompt("force") // Evita forçar nova aprovação se o refresh token já existir
                .build();

        // 1. Tenta carregar uma credencial que já foi salva anteriormente no disco
        Credential credential = flow.loadCredential(USER_ID);

        // 2. Se não existir credencial salva, aí sim abre o navegador para o primeiro login
        if (credential == null || (credential.getRefreshToken() == null && credential.getAccessToken() == null)) {
            System.out.println("Nenhum token encontrado ou token inválido. Iniciando autorização via browser...");
            LocalServerReceiver receiver = new LocalServerReceiver.Builder().setPort(8888).build();
            credential = new AuthorizationCodeInstalledApp(flow, receiver).authorize(USER_ID);
        } else {
            // Se o token existe mas expirou, a biblioteca do Google vai tentar usar o refresh_token automaticamente
            // quando uma chamada de API for feita, ou podemos garantir a atualização preventiva se necessário.
            System.out.println("Credenciais carregadas com sucesso a partir do armazenamento local.");
        }

        return credential;
    }

    @Bean
    public Drive drive(Credential credential) throws Exception {
        return new Drive.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                credential
        ).setApplicationName("Adolêta Contratos").build();
    }

    @Bean
    public Sheets sheets(Credential credential) throws Exception {
        return new Sheets.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                credential
        ).setApplicationName("Adolêta Contratos").build();
    }
}