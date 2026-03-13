# Ruggine 🦀 – Manuale del Progettista
**Sistema di Messaggistica Real-Time ad Alte Prestazioni**

**Corso:** Programmazione di Sistema (02GRSYG)  
**Anno Accademico:** 2024/2025  
**Politecnico di Torino**

---

### 👥 Gruppo di Sviluppo (G9)
* [Agnese Re](https://github.com/AgneseRe) – Matricola: S325676
* [Ilaria Sarcuni](https://github.com/IlariaSarcuni) – Matricola: S332008
* [Cosimo Sergi](https://github.com/Cosser99) – Matricola: S347914

**Repository Ufficiale:** [github.com/PdS2425-C2/G9](https://github.com/PdS2425-C2/G9)

---

## Introduzione
Ruggine Chat è una piattaforma di messaggistica istantanea multi-utente progettata per offrire comunicazioni sicure in tempo reale. Basata su un backend asincrono in Rust, dedicato alla gestione delle sessioni, della logica di comunicazione e del monitoraggio delle risorse, e su un frontend in React, per un'interfaccia moderna e reattiva, Ruggine Chat si articola attraverso un'architettura che mira a massimizzare la reattività del sistema, riducendo al minimo l'impiego delle risorse hardware utilizzate.

## Architettura del Sistema
### Modello di Comunicazione
L'applicazione adotta un modello di comunicazione ibrido tra frontend e backend, combinando tradizionali **richieste HTTP** con il protocollo **WebSocket**. In particolare, lo scambio di dati viene ottimizzato a seconda della natura dell'operazione.
- **Interfaccia REST (HTTP)**: Per tutte le operazioni puntuali, dunque quelle che non richiedono connessioni persistenti, il frontend React comunica con il backend Rust tramite richieste HTTP. Questo approccio è riservato a funzionalità quali autenticazione (login e registrazione), creazione di nuovi team o  chat private. 
- **Comunicazione Real-Time (WebSocket)**: Per tutte le funzionalità che richiedono aggiornamenti in tempo reale, il sistema effettua l'*upgrade* della connessione al protocollo WebSocket. Una volta verificata l'identità dell'utente, un canale full-duplex permanente viene creato. Questo consente al server di operare in modalità *push*, inviando i messaggi ricevuti verso i client istantaneamente, abbattendo i tempi di latenza tipici delle tecniche di polling.

### Gestione dello Stato Condiviso

### Monitoraggio

## Backend: Implementazione in Rust
Il server è costruito attorno all'*ecosistema asincrono* di Rust. I crate principali sono:
- **Axum**: Il framework web utilizzato per gestire il routing e le richieste HTTP. Essendo basato su tokio e tower, permette una gestione estremamente efficiente delle connessioni concorrenti.
- **Tokio**: Il runtime asincrono che consente al server di gestire migliaia di task simultanei (come le connessioni WebSocket o le query al database) senza bloccare il thread principale.
- **SQLx**: Una libreria per l'interazione con il database SQLite che garantisce la verifica delle query a tempo di compilazione, riducendo drasticamente gli errori a runtime.

La logica del backend è suddivisa in moduli per facilitare la manutenibilità.
- `auth.rs` (in `src/handlers/auth.rs`): modulo per la gestione delle procedure di registrazione, login e logout. Utilizza la libreria *bcrypt* per il hashing delle password. Gestisce l'integrazione con *axum-session* per creare la sessione utente nella tabella `sessions_table` e inizializza lo stato di presenza dell'utente nella *presence_map* al momento del login.
- `personal.rs` (in `src/handlers/personal.rs`): modulo per la gestione delle chat private tra singoli utenti. Creazione nuove chat private, recupero della lista di chat esistenti, gestione dello stato di lettura.
- `presence.rs` (in `src/handlers/presence.rs`): modulo per il monitoraggio in tempo reale dello stato online degli utenti.
- `team.rs` (in `src/handlers/team.rs`): modulo dedicato alla gestione dei team. Creazione di team, gestione degli inviti (invio e accettazione), e invio dei messaggi di gruppo.
- `error.rs` (in `src/error.rs`): modulo per la centralizzazione e la gestione degli errori applicativi. Definisce l'enum `AppError` e implementa la conversione automatica dai tipi di errore di sistema (e.g. *SQLx*, *Anyhow*) in risposte HTTP coerenti.
- `main.rs` (in `src/main.rs`): modulo per l'inizializzazione del server web. Configura il pool di connessioni al database, il runtime asincrono *Tokio*, le politiche di sessione e il routing principale di tutte le risorse API e WebSocket.
- `models.rs` (in `src/models.rs`): modulo per la definizione delle strutture dati condivise e delle entità del database. Mappa i record delle tabelle SQL in oggetti Rust e implementa i tratti necessari per l'autenticazione e la *serializzazione* JSON.
- `state.rs` (in `src/state.rs`): modulo per la gestione dello stato globale dell'applicazione `AppState`. Organizza le risorse condivise thread-safe come il pool del database, i canali di trasmissione della chat e le mappe di presenza degli utenti.
- `tasks.rs` (in `src/tasks.rs`): modulo per l'esecuzione di operazioni asincrone in background, specificamente dedicato al monitoraggio periodico delle risorse hardware (CPU e tempo di esecuzione) e alla loro archiviazione in file di log locali.
- `ws.rs` (in `src/ws.rs`): modulo per la gestione delle connessioni **WebSocket**, che regolamenta lo scambio di messaggi in tempo reale e la notifica degli eventi di presenza (online/offline) per i team e le comunicazioni private, previa verifica dei permessi.

## Modello dei Dati
L'applicazione utilizza **SQLite** come motore di database relazionale, gestito mediante la libreria asincrona *SQLx*. Una scelta che non solo garantisce la persistenza delle credenziali utente, dei messaggi inviati e  delle configurazioni dei team e delle chat private, ma che assicura al contempo un'infrastruttura leggera e portabile. L'intero database risiede infatti all'interno di un singolo file su disco. Ciò elimina la necessità di complesse installazioni e setup lato server,  facilitando sensibilmente le operazioni di backup, copia o migrazione del sistema.

### Tabelle Database
- Tabella `user` - contiene le informazioni relative a tutti gli utenti registrati (id*, username, password). L'utente effettua il login tramite username e password. Il campo *password* contiene l'hash della password, generato tramite l'utilizzo dell'algoritmo *bcrypt* con un fattore di costo pari a 10. Questa tecnica garantisce che, anche in caso di accesso non autorizzato al database, le password originali rimangano protette.
- Tabella `team` - contiene le informazioni relative ai team creati (id*, name).
- Tabella `user_team` - contiene tutte le informazioni relative all'appartenenza di un dato utente ad uno specifico team (id_user*, id_team*, last_data, last_ora). Uno stesso utente può appartenere a più team. Per ciascun utente in ciascun team è memorizzata la data e l'ora dell'ultima attività, utili per determinare lo stato di lettura delle conversazioni. Confrontando i dati temporali dell'ultima attività dell'utente con il timestamp dei messaggi archiviati, il sistema è in grado di calcolare dinamicamente il numero di messaggi non letti per ogni specifico team.
- Tabella `user_team_join` - contiene le informazioni relative al momento di ingresso di un dato utente in un dato team (id_user*, id_team*, joined_at). Una tabella statica, contenente dati storici, che viene mantenuta separata dalla precedente invece aggiornata dinamicamente.
- Tabella `invite` - mantiene le informazioni relative agli inviti per divenire membro di un team (id_user*, id_team*, id_invited_by). É possibile divenire membro di un team solo in seguito alla ricezione e successiva accettazione di un invito, generato da un altro utente già appartente al team di riferimento.
- Tabella `message` - tiene traccia dei messaggi inviati all'interno dei team (id_message*, id_user, id_team, message, data, ora, type). Sono qui memorizzati sia messaggi di tipo *chat*, dunque comunicazioni testuali generate direttamente dagli utenti, sia messaggi di tipo *system* (e.g. "utente1 è entrato nel gruppo" oppure "utente2 ha abbandonato il gruppo").
- Tabella `private_chats_assoc` - mantiene le informazioni relative alle chat private instaurate (id*, id_user1, id_user2, last_data_user1, last_ora_user1, last_data_user2, last_ora_user2). Per entrambi gli utenti appartenenti ad una chat privata è memorizzata la data e l'ora dell'ultima attività, al fine di determinare lo stato di lettura delle conversazioni e segnalare la presenza di nuovi contenuti non ancora visualizzati.
- Tabella `private_messages` - tiene traccia dei messaggi inviati all'interno di una chat privata (id_chat, message, data, ora, name1, name2, type). Ogni record rappresenta un'interazione. I campi *name1* e *name2* identificano rispettivamente il mittente e il destinatario del messaggio.
- Tabella `session_table` - archivia i dati relativi alle sessioni attive degli utenti (id*, expires, session). A scopo di test, si adotta una politica di autenticazione non persistente (`longterm: false`). I dati di sessione scadono alla chiusura del browser. Qualora il browser rimanga aperto, la validità dell'accesso è limitata dal campo *expires*.

## Frontend: Integrazione React
- `App` (in `src/App.jsx`): componente principale dell'applicazione. Avvolge tutti i componenti in un *ThemeContext.Provider* per gestire il tema (chiaro oppure scuro) e utilizza *Routes* e *Route* di *react-router-dom* per definire la navigazione;
- `LoginForm` (in `src/components/auth/AuthComponents.jsx`): contiene il form per effettuare il login, con i due campi di input necessari (*Username* e *Password*). Controlla le credenziali inserite (dopo aver cliccato sul bottone *Accedi*) e reindirizza l'utente alla pagina in cui partecipare ad una conversazione, in caso di login effettuato con successo. Il form contiene anche un bottone *Registrati* che rimanda l'utente alla pagina di registrazione;
- `RegisterForm` (in `src/components/auth/AuthComponents.jsx`): contiene il form per effettuare la registrazione, con i tre campi di input necessari (*Username*, *Password* e *Conferma Password*). Al click del bottone *Crea Account*, controlla i dati inseriti (*username* disponibile, password con minimo numero di caratteri, password coincidenti) e reindirizza l'utente alla pagina in cui effettuare il login. Il form contiene anche un bottone *Accedi* che rimanda l'utente alla pagina di login;
- `ChatModals.jsx` (in `src/components/chat/ChatModals.jsx`):
- `ChatPage.jsx` (in `src/components/chat/ChatPage.jsx`):
- `ChatWindow.jsx` (in `src/components/chat/ChatWindow.jsx`):
-  `NavHeader` (in `src/components/common/NavHeader.jsx`): barra di navigazione, contenente nome e logo dell'applicazione. In caso di utente loggato contiene il bottone di *Logout* e un messaggio di benvenuto (*e.g.* Ciao, *username*). Un bottone (con icona bootstrap *bi-sun* o *bi-moon*) consente inoltre di impostare la modalità chiara o la modalità scura (*dark mode* oppure *light mode*);
- `NotFoundComponent` (in `src/components/common/NotFoundComponent.jsx`): contiene un messaggio informativo che comunica all'utente che la pagina cercata non è stata trovata. Presenta un bottone *Ritorna all'homepage* che reindirizza l'utente alla pagina principale dell'applicazione;