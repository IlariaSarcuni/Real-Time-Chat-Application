# Ruggine 🦀 – Real-Time Chat Application
![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232b.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)
![License: MIT](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

Repository del progetto **Ruggine Chat**, sviluppato per l'insegnamento di Programmazione di Sistema (02GRSYG) A.A. 2024/25 presso il Politecnico di Torino. Il sistema implementa una piattaforma di messaggistica istantanea multi-utente ad alte prestazioni, basata su un backend asincrono in Rust e un frontend moderno in React. L'architettura è stata ottimizzata per minimizzare l'occupazione di memoria e la dimensione dell'eseguibile, integrando un sistema di monitoraggio continuo riguardo l'utilizzo delle risorse di CPU.

## Descrizione
Ruggine Chat è una piattaforma di messaggistica istantanea progettata per lo scambio di messaggi testuali in tempo reale. La piattaforma permette a ciascun utente, preventivamente autenticato, di interagire con altri utenti secondo due differenti modalità: **chat private** per conversazioni dirette uno a uno e **chat di gruppo** per conservazioni in team. L'accesso ai gruppi è consentito previa ricezione e accettazione di un invito, garantendo la partecipazione alle discussioni ai soli membri autorizzati. L'applicazione integra inoltre funzionalità di monitoraggio dello stato online dei partecipanti e un sistema di notifiche integrato per i messaggi non letti. Il tutto racchiuso in un'interfaccia moderna con supporto nativo al tema chiaro e scuro.

## Struttura Progetto
Il progetto è organizzato in due macro cartelle, pensate per separare la logica di sistema dalla parte relativa all'interfaccia utente.

**⚙️ Backend `/backend`**
- `ws.rs` : Gestione Web-Socket ;
- `tasks.rs` : Logger per le prestazioni della CPU;
- `state.rs` : Definizione stati dell'applicazioen;
- `models.rs` : Definizioni struct generali e funzione di autenticazione;
- `main.rs` : Programma principale , Routes e middleware di autenticazione;
- `error.rs` : Definizione errori;
- HANDLERS:
  - `auth.rs` : Funzioni registrazione e login
  - `mod.rs` : Moduli;
  - `personal.rs` : Gestione chat privata;
  - `team.rs` : Gestione chat di gruppo;
  - `presence.rs` : Logica di controllo utente online;

\
**🎨 Frontend `/frontend`**
- `App` (in `src/App.jsx`): componente principale dell'applicazione. Avvolge tutti i componenti in un *ThemeContext.Provider* per gestire il tema (chiaro oppure scuro) e utilizza *Routes* e *Route* di *react-router-dom* per definire la navigazione;
- `LoginForm` (in `src/components/auth/AuthComponents.jsx`): contiene il form per effettuare il login, con i due campi di input necessari (*Username* e *Password*). Controlla le credenziali inserite (dopo aver cliccato sul bottone *Accedi*) e reindirizza l'utente alla pagina in cui partecipare ad una conversazione, in caso di login effettuato con successo. Il form contiene anche un bottone *Registrati* che rimanda l'utente alla pagina di registrazione;
- `RegisterForm` (in `src/components/auth/AuthComponents.jsx`): contiene il form per effettuare la registrazione, con i tre campi di input necessari (*Username*, *Password* e *Conferma Password*). Al click del bottone *Crea Account*, controlla i dati inseriti (*username* disponibile, password con minimo numero di caratteri, password coincidenti) e reindirizza l'utente alla pagina in cui effettuare il login. Il form contiene anche un bottone *Accedi* che rimanda l'utente alla pagina di login;
- `ChatModals.jsx` (in `src/components/chat/ChatModals.jsx`):
- `ChatPage.jsx` (in `src/components/chat/ChatPage.jsx`):
- `ChatWindow.jsx` (in `src/components/chat/ChatWindow.jsx`):
-  `NavHeader` (in `src/components/common/NavHeader.jsx`): barra di navigazione, contenente nome e logo dell'applicazione. In caso di utente loggato contiene il bottone di *Logout* e un messaggio di benvenuto (*e.g.* Ciao, *username*). Un bottone (con icona bootstrap *bi-sun* o *bi-moon*) consente inoltre di impostare la modalità chiara o la modalità scura (*dark mode* oppure *light mode*);
- `NotFoundComponent` (in `src/components/common/NotFoundComponent.jsx`): contiene un messaggio informativo che comunica all'utente che la pagina cercata non è stata trovata. Presenta un bottone *Ritorna all'homepage* che reindirizza l'utente alla pagina principale dell'applicazione;

## Installazione e Distribuzione

**⚙️ Backend (Rust)**
1. Entrare nella directory dedicata.
    ```bash
    cd backend
2. Modalità sviluppo. Per modalità release aggiungere il flag `--release`. Una volta avviato il server, il sistema genererà il file `cpu_log.txt` nella cartella corrente. Questo verrà aggiornato automaticamente ogni 2 minuti.
    ```bash
    cargo run [--release]
    ```

**🎨 Frontend (React)**
1. Entrare nella directory dedicata.
    ```bash
    cd frontend
2. Installare le dipendenze e avviare l'ambiente di sviluppo. Per generare gli asset ottimizzati e verificare il footprint indicato nella sezione successiva, utilizzare i comandi dedicati:
   ```bash
    npm install
    npm run dev      # Avvia ambiente di sviluppo
    npm run build    # Genera cartella /dist ottimizzata
    ```

## Monitoraggio Risorse e Performance
Backend (Eseguibile Rust): 2.21 MB (2.321.408 byte) (ottimizzato con LTO e stripping dei simboli).

Frontend (Asset statici): 2.00 MB (2.102.776 byte) (codice JavaScript minificato e pronto per la distribuzione).

## Screenshots

## Licenza
This project is licensed under the MIT License.
