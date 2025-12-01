const SERVER_URL = 'http://localhost:3000';

/**
 * Gestisce le risposte HTTP.
 * Se OK -> restituisce JSON.
 * Se Errore -> cerca il messaggio d'errore nel body.
 */
async function handleResponse(response) {
    if (!response.ok) {
        try {
            const errPayload = await response.text();
            try {
                // Proviamo a parsare se è un JSON
                const errJson = JSON.parse(errPayload);
                if (errJson.error) throw new Error(errJson.error);
                if (errJson.message) throw new Error(errJson.message);
            } catch { 
                // Se non è JSON, usiamo il testo grezzo (senza dichiarare variabili inutilizzate)
                if (errPayload) throw new Error(errPayload);
            }
        } catch (e) {
            // Se abbiamo estratto un errore specifico sopra, lo rilanciamo
            if (e.message) throw e;
        }
        // Fallback generico
        throw new Error(response.statusText || "Errore di connessione");
    }
    
    const type = response.headers.get('Content-Type');
    if (type && type.includes('application/json')) {
        return await response.json();
    }
    return true; 
}

/* AUTH & USER */
const register = async (credentials) => {
    const response = await fetch(`${SERVER_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
    });
    return await handleResponse(response);
};

const logIn = async (credentials) => {
    try {
        const response = await fetch(`${SERVER_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', 
            body: JSON.stringify(credentials)
        });
        return await handleResponse(response);
    } catch (error) {
        console.error('Login error: ', error); // Qui usiamo 'error', quindi niente warning
        throw error;
    }
};

const logOut = async () => {
    await fetch(`${SERVER_URL}/logout`, { 
        method: 'GET', 
        credentials: 'include' 
    });
};

const getUserInfo = async () => {
    const response = await fetch(`${SERVER_URL}/me`, { method: 'GET', credentials: 'include' });
    return await handleResponse(response);
}

/* TEAMS & MESSAGES */
const getTeams = async () => {
    const response = await fetch(`${SERVER_URL}/list/teams`, { method: 'GET', credentials: 'include' });
    return await handleResponse(response);
};

const getMessages = async (teamId) => {
    const response = await fetch(`${SERVER_URL}/messages?team_id=${teamId}`, { method: 'GET', credentials: 'include' });
    return await handleResponse(response);
};

const sendMessage = async (teamId, message) => {
    const response = await fetch(`${SERVER_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ team_id: teamId, message: message })
    });
    return await handleResponse(response);
};

const createTeam = async (name) => {
    const response = await fetch(`${SERVER_URL}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name })
    });
    return await handleResponse(response);
};

const leaveTeam = async (teamId) => {
    const response = await fetch(`${SERVER_URL}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ team_id: teamId })
    });
    return await handleResponse(response);
};

/* INVITES */
const inviteUser = async (username, teamId) => {
    const response = await fetch(`${SERVER_URL}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, team_id: teamId })
    });
    return await handleResponse(response);
};

const getInvites = async () => {
    const response = await fetch(`${SERVER_URL}/list/invites`, { method: 'GET', credentials: 'include' });
    if (response.ok) return await response.json();
    return []; 
};

const acceptInvite = async (teamId) => {
    const response = await fetch(`${SERVER_URL}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ team_id: teamId })
    });
    return await handleResponse(response);
};

const API = { 
    register, logIn, logOut, getUserInfo,
    getTeams, getMessages, sendMessage, createTeam, leaveTeam,
    inviteUser, getInvites, acceptInvite
};

export default API;