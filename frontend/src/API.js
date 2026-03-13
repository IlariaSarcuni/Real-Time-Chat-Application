const getBaseUrl = () => {
    const { hostname, protocol } = window.location;
    return `${protocol}//${hostname}:3000`;
};

const SERVER_URL = getBaseUrl();

async function handleResponse(response) {
    if (!response.ok) {
        try {
            const errPayload = await response.text();
            try {
                const errJson = JSON.parse(errPayload);

                if (errJson.message) throw new Error(errJson.message);

                if (errJson.error && typeof errJson.error === 'string') throw new Error(errJson.error);

            } catch (jsonError) {
                if (jsonError.message && jsonError.message !== "Unexpected token" && !jsonError.message.includes("JSON")) {
                    throw jsonError;
                }
                if (errPayload) throw new Error(errPayload);
            }
        } catch (e) {
            if (e.message) throw e;
        }
        throw new Error(response.statusText || "Errore di connessione al server");
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
        console.error('Errore login:', error); 
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

const getUnreadCounts = async () => {
    const response = await fetch(`${SERVER_URL}/unread-notifications`, { 
        method: 'GET', 
        credentials: 'include' 
    });
    if (response.ok) return await response.json();
    return {};
};

const markAsRead = async (teamId) => {
    const response = await fetch(`${SERVER_URL}/mark-read/${teamId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });
    return await handleResponse(response);
};

// LISTA MEMBRI
const getTeamMembers = async (teamId) => {
    const response = await fetch(`${SERVER_URL}/team/${teamId}/members`, { method: 'GET', credentials: 'include' });
    return await handleResponse(response);
};

const getOnlineMembers = async (teamId) => {
    const response = await fetch(`${SERVER_URL}/team/${teamId}/online`, { method: 'GET', credentials: 'include'})
    return await handleResponse(response);
}

const getTeamMessages = async (teamId) => {
    const response = await fetch(`${SERVER_URL}/messages?team_id=${teamId}`, { method: 'GET', credentials: 'include' });
    return await handleResponse(response);
};

const sendTeamMessage = async (teamId, message) => {
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

// CHAT
const createPrivateChat = async (username) => {
    const response = await fetch(`${SERVER_URL}/create/private`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username })
    });
    return await handleResponse(response);
};

const getChats = async () => {
    const response = await fetch(`${SERVER_URL}/list/private`, { method: 'GET', credentials: 'include' });
    return await handleResponse(response);
};

const getChatMessages = async (chatId) => {
    const response = await fetch(`${SERVER_URL}/chat/messages/${chatId}`, { method: 'GET', credentials: 'include' });
    return await handleResponse(response);
};

const getPrivateOnline = async (chatId) => {
    const response = await fetch(`${SERVER_URL}/private/${chatId}/online`, { method: 'GET', credentials: 'include' });
    return await handleResponse(response);
}

const getPrivateUnreadCounts = async () => {
    const response = await fetch(`${SERVER_URL}/private-unread-notifications`, { 
        method: 'GET', 
        credentials: 'include' 
    });
    if (response.ok) return await response.json();
    return {};
};

const markPrivateAsRead = async (chatId) => {
    const response = await fetch(`${SERVER_URL}/mark-read-private/${chatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });
    return await handleResponse(response);
};

const sendPrivateMessage = async (id, msg, from, to) => {
    const response = await fetch(`${SERVER_URL}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chat_id: id , message: msg, from: from, to: to })
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

// PRESENCE
const heartbeatPresence = async () => {
    const response = await fetch(`${SERVER_URL}/presence/heartbeat`, { method: 'POST', credentials: 'include' });
    return await handleResponse(response);
};

const isUserOnline = async (userId) => {
    const response = await fetch(`${SERVER_URL}/presence/user/${userId}`, { method: 'GET', credentials: 'include' });
    return await handleResponse(response);
};

const API = { 
    register, logIn, logOut, getUserInfo,
    getTeams, getOnlineMembers, getTeamMessages, sendTeamMessage, createTeam, renameTeam, leaveTeam,
    inviteUser, getInvites, acceptInvite, declineInvite,
    getUnreadCounts, getTeamMembers, markAsRead,
    getChats, getChatMessages, sendPrivateMessage, createPrivateChat, getPrivateUnreadCounts, markPrivateAsRead,
    getPrivateOnline,
    heartbeatPresence, isUserOnline
};

export default API;