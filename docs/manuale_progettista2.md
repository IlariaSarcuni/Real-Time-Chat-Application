# Ruggine 🦀 – Manuale del Progettista
**Sistema di messaggistica Real-Time ad alte prestazioni**

**Corso:** Programmazione di Sistema (02GRSYG)  
**Anno Accademico:** 2024/2025  
**Politecnico di Torino**

---

### Gruppo di Sviluppo (G9)
* [Agnese Re](https://github.com/AgneseRe) – Matricola: s325676
* [Ilaria Sarcuni](https://github.com/IlariaSarcuni) – Matricola: s332008
* [Cosimo Sergi](https://github.com/Cosser99) – Matricola: s347914

**Repository Ufficiale:** [github.com/PdS2425-C2/G9](https://github.com/PdS2425-C2/G9)

---

## Indice

1. [Panoramica del sistema](#1-panoramica-del-sistema)
2. [Stack tecnologico](#2-stack-tecnologico)
3. [Struttura del progetto](#3-struttura-del-progetto)
4. [Backend — Architettura](#4-backend--architettura)
5. [Schema del database](#5-schema-del-database)
6. [API REST](#6-api-rest)
7. [WebSocket](#7-websocket)
8. [Sistema di presenza](#8-sistema-di-presenza)
9. [Frontend — Architettura](#9-frontend--architettura)
10. [Componenti React](#10-componenti-react)
11. [Gestione dello stato e routing](#11-gestione-dello-stato-e-routing)
12. [Dipendenze principali](#12-dipendenze-principali)
13. [Avvio del progetto in sviluppo](#13-avvio-del-progetto-in-sviluppo)
14. [Monitoraggio delle prestazioni (CPU Logger)](#14-monitoraggio-delle-prestazioni-cpu-logger)
15. [Note di sicurezza](#15-note-di-sicurezza)

---

## 1. Panoramica del sistema

Ruggine Chat è una piattaforma di messaggistica istantanea multi-utente progettata per offrire comunicazioni in tempo reale attraverso un'architettura client-server. Il sistema è composto da:

- Un **backend** sviluppato in Rust con il framework Axum, dedicato alla gestione delle sessioni, della logica di comunicazione, della persistenza dei dati su SQLite e del monitoraggio delle risorse hardware.
- Un **frontend** sviluppato in React con Vite, che offre un'interfaccia utente reattiva e comunica con il backend tramite chiamate HTTP REST per le operazioni puntuali e tramite connessioni WebSocket per la messaggistica in tempo reale.

L'architettura mira a massimizzare la reattività del sistema riducendo al minimo il consumo di risorse, sfruttando il modello asincrono di Rust e il runtime Tokio per gestire connessioni concorrenti senza bloccare il thread principale.

### Modello di comunicazione

L'applicazione adotta un modello ibrido, ottimizzando lo scambio di dati in base alla natura dell'operazione:

- **HTTP REST**: per tutte le operazioni puntuali che non richiedono connessioni persistenti — autenticazione, creazione di team e chat private, gestione inviti, recupero storico messaggi.
- **WebSocket**: per tutte le funzionalità che richiedono aggiornamenti in tempo reale. Una volta verificata l'identità dell'utente, il server effettua l'upgrade della connessione HTTP a un canale full-duplex persistente. Questo consente al server di operare in modalità *push*, recapitando istantaneamente i messaggi ai client connessi ed eliminando la latenza tipica delle tecniche di polling.

---

## 2. Stack tecnologico

### Backend

| Componente | Tecnologia |
|---|---|
| Linguaggio | Rust |
| Framework HTTP | Axum 0.8 |
| Runtime asincrono | Tokio 1.42 |
| Database | SQLite (via SQLx 0.8) |
| Sessioni / Autenticazione | axum_session + axum_session_auth |
| Hashing password | bcrypt 0.16 |
| WebSocket | Axum ws (feature) + futures-util |
| CORS | tower-http 0.6 |
| Stato condiviso real-time | DashMap 5.5 |
| Timestamp | chrono 0.4 |
| Monitoraggio CPU | sysinfo 0.30 |

### Frontend

| Componente | Tecnologia |
|---|---|
| Linguaggio | JavaScript (ES Modules) |
| Framework UI | React 19 |
| Build tool | Vite 7 |
| Routing | React Router DOM 7 |
| Componenti UI | React-Bootstrap 2 + Bootstrap 5 |
| Icone | Bootstrap Icons 1.13 |
| Date | dayjs 1.11 |
| Emoji | emoji-picker-react 4.16 |

---

## 3. Struttura del progetto

```
G9/
├── backend/
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── auth.rs        # Registrazione, login, logout
│   │   │   ├── team.rs        # Gestione team, messaggi, inviti
│   │   │   ├── personal.rs    # Chat private
│   │   │   ├── presence.rs    # Stato online utenti
│   │   │   └── mod.rs
│   │   ├── main.rs            # Entry point, routing, CORS, sessioni
│   │   ├── state.rs           # AppState condiviso (pool, WebSocket, presenza)
│   │   ├── models.rs          # Struct dati (User, Team, Message…)
│   │   ├── error.rs           # Gestione errori → risposte HTTP uniformi
│   │   ├── ws.rs              # Handler WebSocket
│   │   └── tasks.rs           # CPU logger in background
│   ├── Cargo.toml
│   ├── db.sqlite
│   └── cpu_log.txt
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── auth/
    │   │   │   ├── AuthComponents.jsx  # LoginForm, LogoutButton
    │   │   │   └── RegisterForm.jsx
    │   │   ├── chat/
    │   │   │   ├── ChatModals.jsx      # Finestre di dialogo (crea gruppo, invita, ecc.)
    │   │   │   ├── ChatPage.jsx        # Pagina principale della chat
    │   │   │   └── ChatWindow.jsx      # Finestra messaggi attiva
    │   │   └── common/
    │   │       ├── LineSeparator.jsx
    │   │       ├── NavHeader.jsx
    │   │       └── NotFoundComponent.jsx
    │   ├── contexts/
    │   │   └── ThemeContext.js
    │   ├── API.js                      # Tutte le chiamate HTTP centralizzate
    │   ├── App.jsx                     # Root: auth state, tema, WS globale
    │   └── main.jsx                    # Entry point React
    ├── vite.config.js
    └── package.json
```

---

## 4. Backend — Architettura

Il server è costruito attorno all'ecosistema asincrono di Rust. La logica applicativa è suddivisa in moduli distinti per facilitarne la manutenibilità e la leggibilità.

### 4.1 Entry point (`main.rs`)

Il file `main.rs` è il punto di avvio dell'applicazione. Esegue nell'ordine:

1. Connessione al database SQLite (`sqlite://db.sqlite`).
2. Inizializzazione dell'`AppState` condiviso tra tutti gli handler.
3. Configurazione del sistema di sessioni con `axum_session` (tabella `session_table`, cookie `SameSite=Lax`).
4. Avvio del task asincrono di monitoraggio CPU in background tramite `tokio::spawn`.
5. Configurazione del layer CORS (metodi GET, POST, OPTIONS; credenziali abilitate; origine speculare).
6. Definizione del sistema di routing con protezione tramite middleware di autenticazione.
7. Avvio del server in ascolto su `0.0.0.0:3000`.

### 4.2 Stato condiviso (`state.rs`)

`AppState` è un struct clonabile tramite `Arc` che viene iniettato in tutti gli handler come estensione di Axum. Organizza le risorse condivise thread-safe necessarie per la gestione in tempo reale:

```
AppState {
    pool: SqlitePool,               // Pool di connessioni al database
    chat_rooms: ChatRooms,          // DashMap<i64, broadcast::Sender<String>>
    online_users: OnlineUsers,      // DashMap<i64, Arc<Mutex<HashSet<i64>>>>
    presence_map: PresenceMap,      // DashMap<i64, Instant>
}
```

- `chat_rooms`: mappa le stanze attive (team o chat private, identificate per id) al loro canale broadcast Tokio. Ogni messaggio pubblicato sul canale viene recapitato a tutti i client WebSocket connessi a quella stanza.
- `online_users`: traccia gli utenti connessi via WebSocket per ciascuna stanza specifica.
- `presence_map`: registra l'istante dell'ultimo aggiornamento di presenza globale per ciascun utente, usata per determinarne lo stato online/offline.

### 4.3 Modello degli errori (`error.rs`)

Tutti gli errori applicativi sono centralizzati nell'enum `AppError`, che implementa il trait `IntoResponse` di Axum per convertirsi automaticamente in risposte HTTP con corpo JSON strutturato. Questo garantisce risposte di errore coerenti in tutta l'applicazione:

```
AppError::LoginFail        → 401 Unauthorized         — "Credenziali non valide."
AppError::RegistrationFail → 400 Bad Request           — "Username già in uso."
AppError::UserNotFound     → 404 Not Found             — "Utente non trovato."
AppError::Forbidden        → 403 Forbidden             — "Non hai i permessi necessari."
AppError::BadRequest(msg)  → 400 Bad Request           — messaggio personalizzato
AppError::Sqlx(e)          → 500 Internal Server Error
AppError::Anyhow(e)        → 500 Internal Server Error
```

Il corpo della risposta è sempre un JSON con i campi `error: true` e `message: "..."`, che il frontend intercetta e mostra all'utente tramite un alert Bootstrap.

### 4.4 Middleware di autenticazione

Tutte le route protette usano il middleware `auth_middleware`, che verifica la sessione tramite `axum_session_auth`. Se l'utente è autenticato, il suo oggetto `User` viene inserito nelle estensioni della request (accessibile dagli handler via `Extension<User>`). In caso contrario, la richiesta viene bloccata con `401 Unauthorized` senza procedere oltre nella catena dei middleware.

### 4.5 Moduli handler

- `auth.rs`: gestisce registrazione, login e logout. Utilizza `bcrypt` per l'hashing delle password e `axum_session` per la creazione della sessione utente. Al login, inizializza anche lo stato di presenza dell'utente nella `presence_map`.
- `team.rs`: gestisce la creazione dei team, la rinomina, l'abbandono, l'invio e il recupero dei messaggi di gruppo, la gestione degli inviti (invio, accettazione, rifiuto) e il calcolo delle notifiche non lette.
- `personal.rs`: gestisce le chat private tra due utenti — creazione, recupero messaggi, invio messaggi, stato di lettura e notifiche non lette.
- `presence.rs`: espone l'endpoint REST per verificare se un dato utente è online, leggendo la `presence_map` dell'`AppState`.

---

## 5. Schema del database

L'applicazione utilizza **SQLite** come motore di database relazionale, gestito tramite la libreria asincrona SQLx. La scelta di SQLite garantisce leggerezza e portabilità: l'intero database risiede in un singolo file su disco (`db.sqlite`), eliminando la necessità di installazioni server-side complesse e semplificando le operazioni di backup e migrazione.

### `user`
Contiene gli utenti registrati. Il campo `password` non contiene mai la password in chiaro, bensì il suo hash generato con l'algoritmo bcrypt (fattore di costo 10).

| Colonna | Tipo | Note |
|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT |
| `username` | TEXT | UNIQUE, NOT NULL |
| `password` | TEXT | Hash bcrypt, NOT NULL |

### `team`
Contiene i gruppi di chat creati dagli utenti.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT |
| `name` | TEXT | NOT NULL |

### `user_team`
Tabella di associazione molti-a-molti tra utenti e team. Memorizza il timestamp dell'ultima attività dell'utente nel team: confrontando `last_data` e `last_ora` con i timestamp dei messaggi archiviati, il sistema determina dinamicamente il numero di messaggi non letti per ciascun team.

| Colonna | Tipo | Note |
|---|---|---|
| `id_user` | INTEGER | FK → user.id, PK |
| `id_team` | INTEGER | FK → team.id, PK |
| `last_data` | TEXT | Default '1970-01-01' |
| `last_ora` | TEXT | Default '00:00:00' |

### `user_team_join`
Tabella statica che registra il momento di ingresso di ciascun utente in un team. Mantenuta separata da `user_team` (aggiornata dinamicamente) perché contiene dati storici immutabili.

| Colonna | Tipo | Note |
|---|---|---|
| `id_user` | INTEGER | FK → user.id, PK |
| `id_team` | INTEGER | FK → team.id, PK |
| `joined_at` | TEXT | Timestamp di ingresso |

### `message`
Messaggi inviati all'interno dei team. Il campo `type` distingue i messaggi testuali degli utenti (`'chat'`) dai messaggi di sistema generati automaticamente (`'system'`), come "utente è entrato nel gruppo" o "utente ha abbandonato il gruppo".

| Colonna | Tipo | Note |
|---|---|---|
| `id_message` | INTEGER | PK, AUTOINCREMENT |
| `id_user` | INTEGER | FK → user.id |
| `id_team` | INTEGER | FK → team.id |
| `message` | TEXT | NOT NULL |
| `data` | DATE | NOT NULL |
| `ora` | TIME | NOT NULL |
| `type` | TEXT | Default `'chat'`; può essere `'system'` |

### `invite`
Mantiene gli inviti pendenti a entrare in un team. È possibile diventare membro di un team solo a seguito della ricezione e accettazione di un invito generato da un utente già appartenente al team.

| Colonna | Tipo | Note |
|---|---|---|
| `id_user` | INTEGER | FK → user.id (invitato), PK |
| `id_team` | INTEGER | FK → team.id, PK |
| `id_invited_by` | INTEGER | FK → user.id (chi ha invitato) |

### `private_chats_assoc`
Associazione tra due utenti per una chat privata. Memorizza i timestamp di ultima lettura per ciascun partecipante separatamente, permettendo al sistema di calcolare i messaggi non letti in modo indipendente per ognuno dei due utenti.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT, UNIQUE |
| `id_user1` | INTEGER | FK → user.id |
| `id_user2` | INTEGER | FK → user.id |
| `last_data_user1` | TEXT | Ultima lettura utente 1 |
| `last_ora_user1` | TEXT | |
| `last_data_user2` | TEXT | Ultima lettura utente 2 |
| `last_ora_user2` | TEXT | |

### `private_messages`
Messaggi inviati all'interno delle chat private. I campi `name1` e `name2` identificano rispettivamente il mittente e il destinatario del messaggio.

| Colonna | Tipo | Note |
|---|---|---|
| `id_chat` | INTEGER | FK → private_chats_assoc.id |
| `message` | TEXT | |
| `data` | DATE | |
| `ora` | TIME | |
| `name1` | TEXT | Username mittente |
| `name2` | TEXT | Username destinatario |
| `type` | TEXT | `'chat'` o `'system'` |

### `session_table`
Gestita automaticamente da `axum_session` per la persistenza delle sessioni utente. Le sessioni hanno una scadenza definita dal campo `expires`; alla chiusura del browser la sessione non viene mantenuta (politica non persistente, adatta all'ambiente di sviluppo e test).

| Colonna | Tipo | Note |
|---|---|---|
| `id` | VARCHAR(128) | PK |
| `expires` | BIGINT | Timestamp di scadenza |
| `session` | TEXT | Dati di sessione serializzati |

---

## 6. API REST

Tutte le route protette richiedono una sessione autenticata trasmessa tramite cookie. Le risposte sono sempre in formato JSON. Gli errori seguono la struttura uniforme definita in `error.rs`.

### Autenticazione

| Metodo | Path | Descrizione | Auth |
|---|---|---|---|
| POST | `/register` | Registrazione nuovo utente | No |
| POST | `/login` | Login, crea sessione | No |
| GET | `/logout` | Logout, distrugge sessione | No |
| GET | `/me` | Restituisce `{ id, username }` dell'utente corrente | Sì |

### Team

| Metodo | Path | Descrizione | Auth |
|---|---|---|---|
| GET | `/list/teams` | Lista dei team dell'utente | Sì |
| POST | `/create` | Crea un nuovo team | Sì |
| POST | `/rename` | Rinomina un team | Sì |
| POST | `/leave` | Abbandona un team | Sì |
| GET | `/team/{team_id}/members` | Lista membri del team | Sì |
| GET | `/team/{team_id}/online` | Lista membri online del team | Sì |
| GET | `/messages?team_id={id}` | Messaggi di un team | Sì |
| POST | `/send` | Invia un messaggio in un team | Sì |

### Inviti

| Metodo | Path | Descrizione | Auth |
|---|---|---|---|
| GET | `/list/invites` | Lista inviti pendenti | Sì |
| POST | `/invite` | Invia un invito a un utente | Sì |
| POST | `/accept` | Accetta un invito | Sì |
| POST | `/decline` | Rifiuta un invito | Sì |

### Notifiche team

| Metodo | Path | Descrizione | Auth |
|---|---|---|---|
| GET | `/unread-notifications` | Conteggio messaggi non letti per team | Sì |
| POST | `/mark-read/{team_id}` | Segna messaggi del team come letti | Sì |

### Chat private

| Metodo | Path | Descrizione | Auth |
|---|---|---|---|
| POST | `/create/private` | Crea o recupera una chat privata | Sì |
| GET | `/list/private` | Lista chat private dell'utente | Sì |
| GET | `/chat/messages/{chat_id}` | Messaggi di una chat privata | Sì |
| POST | `/chat/send` | Invia un messaggio privato | Sì |
| GET | `/private/{chat_id}/online` | Stato online nella chat privata | Sì |
| GET | `/private-unread-notifications` | Conteggio messaggi non letti per chat | Sì |
| POST | `/mark-read-private/{chat_id}` | Segna messaggi della chat come letti | Sì |

### Presenza

| Metodo | Path | Descrizione | Auth |
|---|---|---|---|
| GET | `/presence/user/{id}` | Verifica se un utente è online | Sì |

---

## 7. WebSocket

Il backend espone tre endpoint WebSocket, tutti protetti dal middleware di autenticazione. Prima di ogni upgrade, il server esegue una verifica dei permessi: in caso di accesso non autorizzato la connessione viene rifiutata con `403 Forbidden`.

### `/ws/team/{id}`
Connessione WebSocket per una stanza di team. Prima dell'upgrade, il backend verifica tramite query SQL che l'utente sia membro del team. Una volta connesso, il client riceve in tempo reale tutti i messaggi inviati da qualunque membro del gruppo, nonché gli eventi di presenza (online/offline) degli altri partecipanti.

### `/ws/private/{id}`
Connessione WebSocket per una chat privata. Prima dell'upgrade, il backend verifica che l'utente sia uno dei due partecipanti della chat. Il funzionamento è analogo alla stanza di team, ma limitato ai due utenti coinvolti.

### `/ws/global`
Connessione WebSocket globale per la gestione della presenza. Viene aperta dal frontend non appena l'utente effettua il login e rimane attiva per tutta la sessione. Alla connessione l'utente viene registrato nella `presence_map` e viene notificata la sua presenza online a tutti i canali broadcast attivi (team e chat private) a cui appartiene. Alla disconnessione (chiusura del tab, logout, perdita di rete), viene rimosso dalla mappa e notificata la sua assenza.

### Meccanismo di broadcast interno

Ogni stanza attiva è associata a un canale Tokio `broadcast::channel`. Quando un handler riceve un messaggio da inviare, lo pubblica sul canale della stanza. Due task asincroni per connessione (`send_task` e `recv_task`) gestiscono rispettivamente l'invio dei messaggi al client e il rilevamento della disconnessione. Quando uno dei due task termina, l'altro viene immediatamente interrotto tramite `tokio::select!`, garantendo una pulizia corretta delle risorse.

### Formato messaggi WebSocket

I messaggi scambiati via WebSocket sono stringhe JSON. Esempio di messaggio di chat:

```json
{
  "type": "chat",
  "chat_id": 5,
  "message": "Ciao a tutti!",
  "username": "mario",
  "name1": "mario",
  "data": "2025-03-13",
  "ora": "14:32:01"
}
```

Esempio di messaggio di presenza:

```json
{
  "type": "online",
  "user_id": 3,
  "username": "mario"
}
```

I valori possibili per il campo `type` sono: `"chat"` per i messaggi testuali degli utenti, `"system"` per i messaggi generati automaticamente dal server, `"online"` e `"offline"` per gli eventi di presenza.

---

## 8. Sistema di presenza

La presenza degli utenti è gestita su due livelli complementari.

**Presenza globale**: quando l'utente apre l'applicazione, il frontend stabilisce una connessione WebSocket su `/ws/global`. Il backend inserisce l'utente nella `presence_map` (`DashMap<user_id, Instant>`). Alla disconnessione viene rimosso dalla mappa. In entrambi i casi, tutti i canali broadcast a cui appartiene l'utente ricevono un evento `"online"` o `"offline"`, così che tutti i client connessi aggiornino immediatamente l'indicatore di presenza.

**Presenza per stanza**: nella `online_users` (`DashMap<room_id, Mutex<HashSet<user_id>>>`), per ogni stanza viene mantenuto l'insieme degli utenti con una connessione WebSocket attiva a quella stanza specifica. Questo dato viene interrogato dagli endpoint REST `/team/{team_id}/online` e `/private/{chat_id}/online` per restituire la lista aggiornata dei membri online.

---

## 9. Frontend — Architettura

### 9.1 Entry point (`main.jsx`)

Crea un `BrowserRouter` tramite `createBrowserRouter` di React Router DOM e monta il componente `App` sul nodo `#root` del documento HTML. L'intera applicazione è avvolta in `React.StrictMode`.

### 9.2 Componente root (`App.jsx`)

`App` gestisce lo stato globale dell'autenticazione (`loggedIn`, `user`) e del tema visivo (`theme`). Al cambio di route, esegue una chiamata a `GET /me` per verificare la validità della sessione corrente. Gestisce inoltre la connessione WebSocket globale per la presenza, attivata automaticamente quando `loggedIn === true` e chiusa al logout. Fornisce il `ThemeContext` a tutto l'albero dei componenti tramite `ThemeContext.Provider`.

### 9.3 Modulo API (`API.js`)

Centralizza tutte le chiamate HTTP verso il backend. L'URL base viene costruito dinamicamente leggendo `window.location.hostname` e impostando la porta `3000`, rendendo il frontend funzionante sia in locale sia accedendo tramite indirizzo IP di rete, senza richiedere configurazioni aggiuntive.

La funzione `handleResponse` gestisce in modo uniforme le risposte di errore del backend: estrae il campo `message` dal JSON di errore e rilancia l'eccezione verso il componente chiamante, che la mostra all'utente tramite un alert Bootstrap.

---

## 10. Componenti React

### `NavHeader`
Barra di navigazione superiore fissa. Mostra il logo dell'applicazione (🦀 Ruggine Chat), il nome dell'utente autenticato, il pulsante per alternare tema chiaro/scuro e il pulsante di logout. Usa `ThemeContext` per scegliere l'icona del tema (`bi-sun` o `bi-moon-stars`). 

### `LoginForm` e `RegisterForm`
Componenti di autenticazione con gestione dello stato locale (username, password, loading, errori). `RegisterForm` esegue validazione client-side: lunghezza username minima di 3 caratteri, password minima di 8 caratteri, corrispondenza tra i due campi password. Entrambi i componenti adattano gli stili al tema attivo tramite `ThemeContext` e includono un pulsante per mostrare/nascondere la password inserita.

### `ChatPage`
Componente principale della chat. Gestisce il caricamento della lista team e chat private, la selezione della stanza attiva (`activeRoom`), la connessione e disconnessione WebSocket per la stanza corrente, il polling periodico dei messaggi non letti tramite `setInterval`, la gestione degli inviti pendenti e l'apertura delle finestre di dialogo. La `activeRoom` è un oggetto `{ id, type: 'team' | 'private', data }` dove `data` contiene i dettagli della stanza (nome del gruppo o username dell'altro utente).

### `ChatWindow`
Finestra di chat attiva. Riceve come props i messaggi, l'utente corrente, lo stato online dei partecipanti e i callback per inviare messaggi, abbandonare il gruppo e aprire le finestre di dialogo. Gestisce lo scroll automatico verso il basso, il selettore emoji, la separazione temporale dei messaggi tramite badge data e la distinzione visiva tra messaggi propri e altrui.

### `ChatModals`
Raccoglie tutte le finestre di dialogo dell'interfaccia chat come componenti separati e riutilizzabili:
- `CreateTeamModal`: creazione di un nuovo gruppo.
- `CreateChatModal`: avvio di una nuova chat privata.
- `InviteModal`: invito di un utente a un gruppo.
- `RenameModal`: rinomina di un gruppo esistente.
- `MembersModal`: lista dei membri con indicatori di presenza online/offline.

### `NotFoundComponent`
Pagina 404 con immagine illustrativa, messaggio di errore e link per tornare alla home. Adatta i colori del testo e dei link al tema attivo.

### `LineSeparator`
Componente di utilità che renderizza una linea orizzontale con testo centrato. Usato nelle form di autenticazione per separare visivamente il pulsante principale da quello secondario.

---

## 11. Gestione dello stato e routing

Lo stato dell'autenticazione è gestito localmente in `App.jsx` tramite `useState`. Non viene utilizzato alcun sistema di state management esterno come Redux o Zustand: la semplicità dell'applicazione non lo richiede. Il tema visivo è distribuito a tutti i componenti tramite React Context (`ThemeContext`), evitando il prop drilling.

Il routing usa React Router DOM v7 in modalità `createBrowserRouter`. Le route protette non adottano componenti `PrivateRoute` dedicati: la protezione è implementata direttamente con redirect `<Navigate>` condizionali all'interno di ogni `<Route>`, rendendo il flusso di navigazione esplicito e leggibile.

| Path | Componente | Accesso |
|---|---|---|
| `/` | Redirect | Automatico verso `/chat` o `/login` |
| `/login` | `LoginForm` | Solo utenti non autenticati |
| `/register` | `RegisterForm` | Solo utenti non autenticati |
| `/chat` | `ChatPage` | Solo utenti autenticati |
| `*` | `NotFoundComponent` | Sempre |

---

## 12. Dipendenze principali

### Backend (`Cargo.toml`)

| Crate | Versione | Utilizzo |
|---|---|---|
| axum | 0.8.1 | Framework HTTP e WebSocket |
| tokio | 1.42 | Runtime asincrono |
| sqlx | 0.8.3 | Query builder asincrono per SQLite |
| axum_session | 0.16 | Gestione sessioni |
| axum_session_auth | 0.16 | Autenticazione basata su sessioni |
| axum_session_sqlx | 0.5 | Backend SQLite per le sessioni |
| bcrypt | 0.16 | Hashing delle password |
| dashmap | 5.5.3 | HashMap concorrente per lo stato condiviso |
| futures-util | 0.3.31 | Utility per stream/sink asincroni (WebSocket) |
| tower-http | 0.6.2 | Middleware CORS |
| serde / serde_json | 1.0 | Serializzazione/deserializzazione JSON |
| chrono | 0.4.38 | Timestamp per messaggi e log |
| sysinfo | 0.30.12 | Lettura utilizzo CPU per il logger |
| colored | 2.0 | Output colorato nel terminale |
| anyhow | 1.0.97 | Gestione errori generici |
| async-trait | 0.1.87 | Supporto trait asincroni |

### Frontend (`package.json`)

| Pacchetto | Versione | Utilizzo |
|---|---|---|
| react / react-dom | 19.1 | Framework UI |
| react-router-dom | 7.9 | Routing SPA |
| bootstrap | 5.3.8 | Framework CSS |
| react-bootstrap | 2.10 | Componenti Bootstrap per React |
| bootstrap-icons | 1.13 | Icone SVG |
| dayjs | 1.11 | Parsing e formattazione date |
| emoji-picker-react | 4.16 | Selettore emoji nella chat |
| vite | 7.1 | Build tool e dev server |

---

## 13. Avvio del progetto in sviluppo

### Backend

```bash
# Dalla directory backend/
cargo run
# Il server si avvia su 0.0.0.0:3000
# Il file db.sqlite deve essere presente nella stessa directory
```

Il build di release è configurato in `Cargo.toml` con ottimizzazioni per la dimensione del binario (`opt-level = "z"`, `lto = true`, `codegen-units = 1`, `strip = true`, `panic = "abort"`):

```bash
cargo build --release
./target/release/backend
```
> **Dimensione binario release:** `backend.exe` — **2.29 MB**.

### Frontend

```bash
# Dalla directory frontend/
npm install      # solo al primo avvio o dopo aggiornamenti delle dipendenze
npm run dev
# Il dev server Vite si avvia sulla porta configurata in vite.config.js
```

Il frontend si connette automaticamente al backend sulla porta `3000` dello stesso host, grazie alla funzione `getBaseUrl()` in `API.js` che legge dinamicamente `window.location.hostname`.

---

## 14. Monitoraggio delle prestazioni (CPU Logger)

Il task `tasks.rs` campiona l'utilizzo CPU del processo ogni **120 secondi** tramite `sysinfo` e scrive in append su `backend/cpu_log.txt`:

```
[DD-MM-YYYY HH:MM:SS] CPU Usage: X.XX% | Total Run Time: Xs
```
dove:
- `DD-MM-YYYY HH:MM:SS` è il timestamp locale al momento della rilevazione.
- `CPU Usage` è la percentuale di utilizzo CPU del processo backend in quel preciso istante.
- `Total Run Time` è il tempo totale di esecuzione del processo in secondi dall' avvio.


### Osservazioni sui dati rilevati

Dall'analisi del file `cpu_log.txt` generato durante lo sviluppo e il testing dell'applicazione emergono le seguenti osservazioni:

- **Utilizzo CPU in condizioni idle:** il processo backend consuma tipicamente tra **0.00% e 0.50%** di CPU in assenza di traffico o con pochi utenti connessi. Questo conferma l'efficienza del runtime asincrono Tokio, che non spreca cicli CPU in attesa passiva di eventi.
- **Utilizzo medio sotto carico:** durante le sessioni di test con più utenti connessi e scambio attivo di messaggi, il consumo si attesta stabilmente tra **0.50% e 2.00%**.

Il backend Rust risulta estremamente leggero, confermando la validità della scelta di Rust come linguaggio per il server di questa applicazione.
Ciò è dovuto principalmente di tre scelte architetturali:
- **Rust**: nessun garbage collector, zero overhead runtime, memoria gestita a compile time.
- **Tokio asincrono**: un thread può gestire migliaia di connessioni WebSocket concorrenti senza bloccarsi.
- **DashMap**: struttura dati concorrente senza lock globali per lo stato condiviso.

---

## 15. Note di sicurezza

| Aspetto | Implementazione |
|---|---|
| Password | Hash bcrypt, cost factor 10 |
| Sessioni | Cookie `SameSite=Lax`, scadenza alla chiusura browser |
| Autorizzazione REST | Middleware `auth_middleware` su tutte le route protette |
| Autorizzazione WebSocket | Verifica SQL prima di ogni upgrade; `403` se non autorizzato |
| CORS | `AllowOrigin::mirror_request` con credenziali abilitate |
| Validazione input | Lato client (React) + lato server (handler Rust, `400` per input non validi) |
