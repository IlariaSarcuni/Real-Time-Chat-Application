const SERVER_URL = 'http://localhost:3000';

/* Registra un nuovo utente */
const register = async (credentials) => {
    try {
        const response = await fetch(`${SERVER_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });
        
        // Se la registrazione fallisce (es. username già preso), lanciamo errore
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || "Errore registrazione");
        }
        
        return true;
    } catch (error) {
        throw error;
    }
};

/* This function executes the login. It wants username and password in a 'credentials' object */
const logIn = async (credentials) => {
    try {
        const response = await fetch(`${SERVER_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // this parameter specifies that authentication cookie must be forwared.
            body: JSON.stringify(credentials)
        });
        const validResponse = handleInvalidResponse(response);
        var j=await response.json();
        console.log(j);
        return response;
    } catch (error) {
        console.error('Login error: ', error);
        throw error;
    }
};

/* Recupera la lista dei gruppi a cui l'utente appartiene */
const getTeams = async () => {
    const response = await fetch(`${SERVER_URL}/list/teams`, {
        method: 'GET',
        credentials: 'include',
    });
    if (response.ok) {
        return await response.json();
    } else {
        throw new Error("Errore durante il caricamento della lista gruppi");
    }
};

/* Recupera i messaggi di un gruppo specifico */
const getMessages = async (teamName) => {
    const response = await fetch(`${SERVER_URL}/messages?teamname=${teamName}`, {
        method: 'GET',
        credentials: 'include',
    });
    if (response.ok) {
        return await response.json();
    } else {
        throw new Error("Errore durante il recupero dei messaggi");
    }
};

/* Invia un nuovo messaggio */
const sendMessage = async (teamName, message) => {
    const response = await fetch(`${SERVER_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamname: teamName, message: message })
    });
    if (!response.ok) throw new Error("Errore invio messaggio");
    return true;
};

/* Crea un nuovo gruppo */
const createTeam = async (name) => {
    const response = await fetch(`${SERVER_URL}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name })
    });
    if (!response.ok) throw new Error("Errore creazione gruppo");
    return await response.json();
};

/* Invita un utente in un gruppo */
const inviteUser = async (username, teamname) => {
    const response = await fetch(`${SERVER_URL}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, teamname })
    });
    if (!response.ok) throw new Error("Errore nell'invito (Utente non trovato o permesso negato)");
    return true;
};

/* Helper per gestire errori comuni delle fetch */
function handleInvalidResponse(response) {
    if (!response.ok) { throw Error(response.statusText) }
    let type = response.headers.get('Content-Type');
    if (type !== null && type.indexOf('application/json') === -1){
        throw new TypeError(`Expected JSON, got ${type}`)
    }
    return response;
}

/* Recupera gli inviti pendenti */
const getInvites = async () => {
    const response = await fetch(`${SERVER_URL}/list/invites`, {
        method: 'GET',
        credentials: 'include',
    });
    if (response.ok) return await response.json();
    // Se ritorna lista vuota o errore gestito, ritorna array vuoto
    return []; 
};

/* Accetta un invito */
const acceptInvite = async (teamName) => {
    const response = await fetch(`${SERVER_URL}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamname: teamName })
    });
    if (!response.ok) throw new Error("Errore accettazione invito");
    return await response.json();
};


const API = { 
    register,
    logIn, 
    getTeams, 
    getMessages, 
    sendMessage, 
    createTeam, 
    inviteUser,
    getInvites,  
    acceptInvite   
};

export default API;