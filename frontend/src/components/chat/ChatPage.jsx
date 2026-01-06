import { useState, useEffect, useCallback, useContext } from 'react';
import { Badge, Button, Container, Row, Col, ListGroup, ButtonGroup } from 'react-bootstrap';
import API from '../../API';
import ThemeContext from '../../contexts/ThemeContext';
import "../../stylesheets/ChatPage.css";

import {ChatWindow} from './ChatWindow';
import { CreateChatModal, CreateTeamModal, InviteModal, MembersModal, RenameModal } from './ChatModals';

function ChatPage({ user }) {
    const theme = useContext(ThemeContext);

    // --- STATI DATI (teams and chats) ---
    const [teams, setTeams] = useState([]);
    const [chats, setChats] = useState([]);
    const [invites, setInvites] = useState([]);
    const [notifications, setNotifications] = useState({}); // {room_id: count}

    // --- ACTIVE ROOM (team or private chat) ---
    const [activeRoom, setActiveRoom] = useState({type: null, id: null, data: null});
    const [messages, setMessages] = useState([]);
    const [onlineMembers, setOnlineMembers] = useState([]);

    // --- STATI INPUT & UI ---
    const [newMessage, setNewMessage] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    // --- STATI MODALI ---
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");

    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteUsername, setInviteUsername] = useState("");

    const [showMembersModal, setShowMembersModal] = useState(false);
    const [members, setMembers] = useState([]);

    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameValue, setRenameValue] = useState("");

    const [showCreatePrivateModal, setShowCreatePrivateModal] = useState(false);
    const [newChatName, setNewChatName] = useState("");

    const chatBg = theme === 'dark' ? '#212529' : '#e5ddd5';    // move
    // --- EFFETTI & API ---
    const refreshAllData = useCallback(() => {
        if (!user) return;

        API.getTeams().then(ts => setTeams(Array.isArray(ts) ? ts : [])).catch(e => console.error(e));
        API.getChats().then(c => setChats(Array.isArray(c) ? c : [])).catch(e => console.error(e));
        API.getInvites().then(inv => setInvites(Array.isArray(inv) ? inv : [])).catch(e => console.error(e));
        API.getUnreadCounts().then(data => setNotifications(data)).catch(e => console.error(e));
    }, [user]);

    useEffect(() => {
        refreshAllData();
        const interval = setInterval(refreshAllData, 5000);
        return () => clearInterval(interval);
    }, [refreshAllData]);

    // --- WEBSOCKET ---
    useEffect(() => {
        if (!activeRoom.id) return;

        // 1. Initial loading messagges
        const fetchInitialData = async () => {
            try {
                let messages = [];
                if (activeRoom.type === 'team') {
                    messages = await API.getTeamMessages(activeRoom.id);
                    const membersList = await API.getOnlineMembers(activeRoom.id);
                    let usernames = Array.isArray(membersList) ? membersList.map(member => member.username) : []
                    usernames.push(user.username);  // retrieve current user, not officially online in server
                    setOnlineMembers(Array.from(new Set(usernames)));
                } else {
                    messages = await API.getChatMessages(activeRoom.id);
                    setOnlineMembers([]);   // TODO: other member online
                }
                setMessages(Array.isArray(messages) ? messages : []);
            } catch (err) {
                console.error("Errore nel caricamento iniziale: ", err);
            }
        };
        fetchInitialData();

        // 2. WebSocket Configuration
        const { hostname, protocol } = window.location;
        const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
        const wsPort = '3000';

        // 3. Prepare endpoint based on room type
        const endpoint = activeRoom.type === 'team' ? `team/${activeRoom.id}` : `private/${activeRoom.id}`;
        const ws = new WebSocket(`${wsProtocol}//${hostname}:${wsPort}/ws/${endpoint}`);

        ws.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);

                if(!data.data) {    // can be undefined for 'system' messages
                    data.data = new Date().toISOString().split("T")[0];
                }

                // TODO: fix notifications if your own message
                if(data.type === "chat") {  // standard chat messages
                    if (activeRoom && data.team_id === activeRoom.id) {
                        setMessages(prev => [...prev, data]);
                    } else {  
                        if (data.username !== user.username) {
                            setNotifications(prev => ({
                                ...prev, 
                                [data.team_id]: (prev[data.team_id] || 0) + 1
                            }));
                        }
                    }
                } else if(data.type === "system") { // someone joins or leaves team
                    setMessages(prev => [...prev, data]);
                } else if (data.type === "online") {
                    setOnlineMembers(prev => Array.from(new Set([...prev, data.username])));
                } else if (data.type === "offline") {
                    setOnlineMembers(prev => prev.filter(user => user !== data.username));
                } else {    // fallback
                    setMessages(prev => [...prev, data]);
                }
            } catch(err) {
                console.error(err);
            }
        };

        // 4. Cleanup websocket
        return () => { 
            if (ws.readyState === 1) ws.close(); 
        };
    }, [activeRoom.id, activeRoom.type, user.username]);

    // --- HANDLERS ---
    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!newMessage.trim() || !activeRoom.id) return;
        try {
            if (activeRoom.type === 'team') {
                await API.sendTeamMessage(activeRoom.id, newMessage);
            } else {    // private chat
                const recipientName = activeRoom.data.name;
                await API.sendPrivateMessage(activeRoom.id, newMessage, user.username, recipientName);
            }
            setNewMessage("");
        } catch (err) { 
            console.error(err); 
            setErrorMsg("Errore nell'invio del messaggio"); 
        }
    };

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) return;
        try {
            await API.createTeam(newTeamName);
            setShowCreateModal(false); 
            setNewTeamName(""); 
            refreshAllData();
        } catch (err) { 
            alert(err.message); 
        }
    };

    const handleCreatePrivate = async () => {
        try {
            await API.createPrivateChat(parseInt(newChatName, 10));
            setShowCreatePrivateModal(false); 
            setNewChatName(""); 
            refreshAllData();
        } catch (err) { 
            alert(err.message); 
        }
    };

    const handleSelectActiveRoom = useCallback(async (type, roomData) => {
        setErrorMsg("");
        setNewMessage("");
        setMessages([]);

        try {
            let fetchedMessages = [];
            if (type === 'team') {
                setActiveRoom({type: 'team', id: roomData.id, data: roomData });
                fetchedMessages = await API.getTeamMessages(roomData.id);
            } else {
                setActiveRoom({ type: 'private', id: roomData.id, data: roomData });
                fetchedMessages = await API.getChatMessages(roomData.id);
            }
            setMessages(Array.isArray(fetchedMessages) ? fetchedMessages : []);
        } catch (err) {
            setErrorMsg("Impossibile caricare i messaggi della chat attiva.");
        }

        if (notifications[roomData.id] > 0) {
            setNotifications(prev => ({ ...prev, [roomData.id]: 0 }));
            await API.markAsRead(roomData.id).catch(err => console.error("Errore markAsRead: ", err));
        }
    
    }, [notifications]);

    const handleInvite = async () => {
        try {
            await API.inviteUser(inviteUsername, activeRoom.id);
            setShowInviteModal(false); 
            setInviteUsername(""); 
            alert("Invito inviato");
        } catch (err) { 
            alert(err.message); 
        }
    };

    const handleShowMembers = async () => {
        if (!activeRoom.id || activeRoom.type !== 'team') return;
        try {
            const list = await API.getTeamMembers(activeRoom.id);
            setMembers(list);
            setShowMembersModal(true);
        } catch (err) { 
            console.error(err); 
            setErrorMsg("Impossibile caricare la lista membri.");
        }
    };

    const handleRename = async () => {
        if (!activeRoom.id || activeRoom.type !== 'team' || !renameValue.trim()) return;
        try {
            await API.renameTeam(activeRoom.id, renameValue);
            setActiveRoom(prev => ({ ...prev, data: { ...prev.data, name: renameValue } }));    
            setShowRenameModal(false); 
            setRenameValue(""); 
            refreshAllData();
        } catch (err) { 
            alert(err.message); 
        }
    };
    
    const handleAccept = (id) => API.acceptInvite(id).then(refreshAllData).catch(e => console.error(e));
    const handleDecline = (id) => { if(window.confirm("Sei sicuro di voler rifiutare l'invito?")) API.declineInvite(id).then(refreshAllData); };
    const handleLeave = () => { if(window.confirm("Vuoi davvero abbandonare il gruppo?")) API.leaveTeam(activeRoom.id).then(() => { setActiveRoom(null); setMessages([]); refreshAllData(); }); };

    const sidebarClass = theme === 'dark' ? 'bg-black border-secondary' : 'bg-light';

    return (
        <Container fluid className="d-flex flex-column p-0 h-100">
            <Row className="flex-grow-1 m-0" style={{ overflow: 'hidden' }}>
                {/* 1. SIDEBAR */}
                <Col md={3} lg={2} className={`border-end d-flex flex-column h-100 p-0 ${sidebarClass}`} style={{ overflowX: 'hidden' }}>
                    {invites.length > 0 && (
                        <div className="p-3 bg-warning bg-opacity-10 border-bottom border-warning">
                            <small className="fw-bold text-warning text-uppercase">Inviti ({invites.length})</small>
                            <ListGroup variant="flush" className="mt-2 gap-2">
                                {invites.map(inv => (
                                    <ListGroup.Item key={inv.id} className={`d-flex flex-column rounded border shadow-sm p-2 ${theme === 'dark' ? 'bg-dark text-white' : ''}`}>
                                        <div className="fw-bold mb-2 text-truncate w-100">{inv.name}</div>
                                        <ButtonGroup size="sm" className="w-100">
                                            <Button variant="outline-success" onClick={() => handleAccept(inv.id)}><i className="bi bi-check-lg"></i></Button>
                                            <Button variant="outline-danger" onClick={() => handleDecline(inv.id)}><i className="bi bi-x-lg"></i></Button>
                                        </ButtonGroup>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        </div>
                    )}
                    
                    <div className="px-2 w-100">
                        {/* 1.1. TEAMS */}
                        <div className="px-2 pt-4 pb-2 d-flex justify-content-between align-items-center w-100">
                            <small className={`fw-bolder ls-wide ${theme === 'dark' ? 'text-secondary' : 'text-muted'}`} style={{ fontSize: '0.9rem', letterSpacing: '0.05rem' }}>GRUPPI</small>
                            <Button variant="link" className="p-0 text-primary border-0 shadow-none" onClick={() => setShowCreateModal(true)}>
                                <i className="bi bi-plus-circle-fill fs-6"></i>
                            </Button>
                        </div>
                        <ListGroup variant="flush" className="mb-2">
                            {teams.map(team => (
                                <ListGroup.Item key={team.id} action active={activeRoom.type === 'team' && activeRoom.id === team.id} 
                                    onClick={() => handleSelectActiveRoom('team', team)}
                                    className="border-0 py-2 rounded-3 d-flex justify-content-between align-items-center mb-1"
                                    style={{ backgroundColor: activeRoom.id === team.id ? '' : 'transparent', 
                                        color: theme === 'dark' && activeRoom.id !== team.id ? 'white' : '' }}
                                    >
                                        <span className="text-truncate small">
                                            <i className="bi bi-hash me-1"></i> {team.name}
                                        </span>
                                        {notifications[team.id] > 0 && (<Badge bg="danger" pill style={{fontSize: '0.6rem'}}>
                                            {notifications[team.id]}</Badge>
                                        )}
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                        
                        {/* 1.2. PRIVATE CHAT */}
                        <div className="px-2 pt-4 pb-2 d-flex justify-content-between align-items-center w-100">
                            <small className={`fw-bolder ls-wide ${theme === 'dark' ? 'text-secondary' : 'text-muted'}`} style={{ fontSize: '0.9rem', letterSpacing: '0.05rem' }}>CHAT PRIVATE</small>
                            <Button variant="link" className="p-0 text-primary" onClick={() => setShowCreatePrivateModal(true)}>
                                <i className="bi bi-plus-circle-fill fs-6"></i>
                            </Button>
                        </div>
                        <ListGroup variant="flush" className="mb-2">
                            {chats.map(chat => (
                                <ListGroup.Item key={chat.id} action active={activeRoom.type === 'private' && activeRoom.id === chat.id} 
                                    onClick={() => handleSelectActiveRoom('private', chat)}
                                    className="border-0 py-2 rounded-3 d-flex justify-content-between align-items-center"
                                    style={{ backgroundColor: activeRoom.id === chat.id ? '' : 'transparent', color: theme === 'dark' && activeRoom.id !== chat.id ? 'white' : '' }}
                                    >
                                        <span className="text-truncate small">
                                            <i className="bi bi-hash me-1"></i> {chat.other_username}
                                        </span>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </div>
                </Col>

                {/* 2. CHAT WINDOW */}
                {activeRoom.id ? (
                    <ChatWindow 
                        activeRoom={activeRoom}
                        messages={messages}
                        user={user}
                        errorMsg={errorMsg}
                        setErrorMsg={setErrorMsg}
                        newMessage={newMessage}
                        setNewMessage={setNewMessage}
                        onlineMembers={onlineMembers}
                        onSend={handleSendMessage}
                        onLeave={handleLeave}
                        onShowMembers={handleShowMembers}
                        onShowInvite={() => setShowInviteModal(true)}
                        onShowRename={() => { 
                            setRenameValue(activeRoom.data.name); 
                            setShowRenameModal(true); 
                        }}
                    />
                ) : (
                    <Col className="d-flex flex-column align-items-center justify-content-center"
                        style={{ backgroundColor: chatBg, color: theme === 'dark' ? '#f8f9fa' : '#6c757d' }}>
                        <div className="display-1 opacity-25 mb-3">🦀</div>
                        <h5>Benvenuto, {user.username}</h5>
                        <p>Seleziona un gruppo o una chat per iniziare</p>
                    </Col>
                )}
            </Row>

            {/* 3. MODALI */}
            <CreateChatModal show={showCreatePrivateModal} onHide={() => setShowCreatePrivateModal(false)} value={newChatName} onChange={setNewChatName} onSubmit={handleCreatePrivate} />
            <CreateTeamModal show={showCreateModal} onHide={() => setShowCreateModal(false)} value={newTeamName} onChange={setNewTeamName} onSubmit={handleCreateTeam} />
            <InviteModal show={showInviteModal} onHide={() => setShowInviteModal(false)} value={inviteUsername} onChange={setInviteUsername} onSubmit={handleInvite} />
            <MembersModal show={showMembersModal} onHide={() => setShowMembersModal(false)} members={members} onlineMembers={onlineMembers} user={user} />
            <RenameModal show={showRenameModal} onHide={() => setShowRenameModal(false)} value={renameValue} onChange={setRenameValue} onSubmit={handleRename} />

        </Container>
    );
}

export default ChatPage;