// URL Dinamico per supportare Android/Cross-Platform
const getBaseUrl = () => {
    // Ottiene protocollo e hostname (es. "http://192.168.1.10")
    const { hostname, protocol } = window.location;
    // Se la porta è 5173 (Vite), assumiamo che il server sia su 3000
    // Se la porta è già 3000 (Produzione statica), usiamo lo stesso host
    return `${protocol}//${hostname}:3000`;
};

const SERVER_URL = getBaseUrl();

async function handleResponse(response) {
    if (!response.ok) {
        try {
            const errPayload = await response.text();
            try {
                const errJson = JSON.parse(errPayload);
                if (errJson.error) throw new Error(errJson.error);
                if (errJson.message) throw new Error(errJson.message);
            } catch { 
                if (errPayload) throw new Error(errPayload);
            }
        } catch (e) {
            if (e.message) throw e;
        }
        throw new Error(response.statusText || "Errore di connessione");
    }
    
    const type = response.headers.get('Content-Type');
    if (type && type.includes('application/json')) {
        return await response.json();
    }
    return true; 
}

// AUTH & USER
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
        console.error('Login error: ', error); 
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

// GRUPPI E MESSAGGI
const getTeams = async () => {
    const response = await fetch(`${SERVER_URL}/list/teams`, { method: 'GET', credentials: 'include' });
    return await handleResponse(response);
};

// LISTA MEMBRI
const getTeamMembers = async (teamId) => {
    const response = await fetch(`${SERVER_URL}/team/${teamId}/members`, { method: 'GET', credentials: 'include' });
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

const renameTeam = async (teamId, newName) => {
    const response = await fetch(`${SERVER_URL}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ team_id: teamId, new_name: newName })
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

// INVITI
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

const declineInvite = async (teamId) => {
    const response = await fetch(`${SERVER_URL}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ team_id: teamId })
    });
    return await handleResponse(response);
};

const API = { 
    register, logIn, logOut, getUserInfo,
    getTeams, getMessages, sendMessage, createTeam, renameTeam, leaveTeam,
    inviteUser, getInvites, acceptInvite, declineInvite,
    getTeamMembers
};

export default API;