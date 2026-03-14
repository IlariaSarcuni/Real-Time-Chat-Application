import { useState, useEffect, useCallback, useContext } from 'react';
import { Badge, Button, Container, Row, Col, ListGroup, ButtonGroup } from 'react-bootstrap';
import API from '../../API';
import ThemeContext from '../../contexts/ThemeContext';
import "../../stylesheets/ChatPage.css";

import { ChatWindow } from './ChatWindow';
import { CreateChatModal, CreateTeamModal, InviteModal, MembersModal, RenameModal } from './ChatModals';

function ChatPage({ user }) {
    const theme = useContext(ThemeContext);

    // STATI DATI
    const [teams, setTeams] = useState([]);
    const [chats, setChats] = useState([]);
    const [invites, setInvites] = useState([]);
    const [notifications, setNotifications] = useState({}); 

    // ACTIVE ROOM
    const [activeRoom, setActiveRoom] = useState({ type: null, id: null, data: null });
    const [messages, setMessages] = useState([]);
    const [onlineMembers, setOnlineMembers] = useState([]);

    // STATI INPUT & UI
    const [newMessage, setNewMessage] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    // STATI MODALI
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

    const chatBg = theme === 'dark' ? '#212529' : '#e5ddd5';

    // --- REFRESH DATI (API) ---
    const refreshAllData = useCallback(async () => {
        if (!user) return { teams: [], chats: [], invites: [] };

        try {
            const [ts, c, inv, unreadTeams, unreadChats] = await Promise.all([
                API.getTeams(),
                API.getChats(),
                API.getInvites(),
                API.getUnreadCounts(),
                API.getPrivateUnreadCounts()
            ]);

            const teamsData = Array.isArray(ts) ? ts : [];
            const chatsData = Array.isArray(c) ? c : [];
            const invitesData = Array.isArray(inv) ? inv : [];
            
            //Notifiche di team e chat private 
            const teamNotifs = Object.entries(unreadTeams || {}).reduce((acc, [id, count]) => {
                acc[`team_${id}`] = count;
                return acc;
            }, {});
            const chatNotifs = Object.entries(unreadChats || {}).reduce((acc, [id, count]) => {
                acc[`chat_${id}`] = count;
                return acc;
            }, {});
            const allNotifications = { ...teamNotifs, ...chatNotifs };

            setTeams(teamsData);
            setChats(chatsData);
            setInvites(invitesData);
            setNotifications(allNotifications);

            return { teams: teamsData, chats: chatsData, invites: invitesData };
        } catch (e) {
            console.error("Errore nel refresh dei dati:", e);
            return { teams: [], chats: [], invites: [] };
        }
    }, [user]);

    useEffect(() => {
        refreshAllData();
        const interval = setInterval(refreshAllData, 5000);
        return () => clearInterval(interval);
    }, [refreshAllData]);

    // WEBSOCKET & INITIAL LOAD
    useEffect(() => {
        if (!activeRoom.id) return;

        let isMounted = true;
        let socket = null;

        // Caricamento iniziale messaggi
        const fetchInitialData = async () => {
            try {
                let msgs = [];
                if (activeRoom.type === 'team') {
                    msgs = await API.getTeamMessages(activeRoom.id);
                    const membersList = await API.getOnlineMembers(activeRoom.id);
                    let usernames = Array.isArray(membersList) ? membersList.map(m => m.username) : [];
                    usernames.push(user.username);
                    if (isMounted) setOnlineMembers(Array.from(new Set(usernames)));
                } else {
                    msgs = await API.getChatMessages(activeRoom.id);
                    try {
                        const res = await API.isUserOnline(activeRoom.data?.other_user_id);
                        if (isMounted) setOnlineMembers(res.online ? [activeRoom.data?.other_username] : []);
                    } catch {
                        if (isMounted) setOnlineMembers([]);
                    }
                }
                if (isMounted) setMessages(Array.isArray(msgs) ? msgs : []);
            } catch (err) {
                console.error("Errore caricamento iniziale:", err);
            }
        };

        fetchInitialData();

        // Configurazione WebSocket con riconnessione
        const connectWS = () => {
            const { hostname, protocol } = window.location;
            const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
            const wsPort = '3000';
            const endpoint = activeRoom.type === 'team' ? `team/${activeRoom.id}` : `private/${activeRoom.id}`;
            
            socket = new WebSocket(`${wsProtocol}//${hostname}:${wsPort}/ws/${endpoint}`);
            window.socket = socket;     // for stress test on browser console

            socket.onmessage = (e) => {
                if (!isMounted) return;
                try {
                    const data = JSON.parse(e.data);
                    if (!data.data) data.data = new Date().toISOString().split("T")[0];

                    const incomingId = data.chat_id || data.team_id;

                    if (data.type === "chat") {
                        // Solo messaggi da altri utenti
                        if (data.username === user.username) {
                            if (incomingId === activeRoom.id) {
                                setMessages(prev => [...prev, data]);
                            }
                        } else {
                            if (incomingId === activeRoom.id) {
                                setMessages(prev => [...prev, data]);
                                // Azzera notifica se sei già nella chat attiva
                                const notifKey = activeRoom.type === 'team' ? `team_${activeRoom.id}` : `chat_${activeRoom.id}`;
                                setNotifications(prev => ({ ...prev, [notifKey]: 0 }));
                            } else {
                                // Le notifiche vengono gestite dal backend
                            }
                        }
                    } else if (data.type === "online") {
                        setOnlineMembers(prev => prev.includes(data.username) ? [...prev] : [...prev, data.username]);
                    } else if (data.type === "offline") {
                        setOnlineMembers(prev => prev.filter(u => u !== data.username)); 
                    } else {
                        setMessages(prev => [...prev, data]);
                    }
                } catch (err) {
                    console.error("Errore parsing WS:", err);
                }
            };

            socket.onclose = () => {
                if (isMounted) setTimeout(connectWS, 3000); // Riconnessione
            };
        };

        connectWS();

        return () => {
            isMounted = false;
            if (socket) socket.close();
        };
    }, [activeRoom, user.username]); 

    //HANDLERS
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeRoom.id) return;
        try {
            if (activeRoom.type === 'team') {
                await API.sendTeamMessage(activeRoom.id, newMessage);
            } else {
                const recipientName = activeRoom.data.other_username || activeRoom.data.name;
                await API.sendPrivateMessage(activeRoom.id, newMessage, user.username, recipientName);
            }
            setNewMessage("");
            
            const notifKey = activeRoom.type === 'team' ? `team_${activeRoom.id}` : `chat_${activeRoom.id}`;
            setNotifications(prev => ({ ...prev, [notifKey]: 0 }));
            if (activeRoom.type === 'team') {
                await API.markAsRead(activeRoom.id).catch(err => console.error("Errore markAsRead:", err));
            } else {
                await API.markPrivateAsRead(activeRoom.id).catch(err => console.error("Errore markAsRead:", err));
            }
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
            const response = await API.createPrivateChat(newChatName);
            const chat_id = response.id;
            setShowCreatePrivateModal(false);
            setNewChatName("");

            const updated = await refreshAllData();
            const newChatData = updated.chats.find(c => c.id === chat_id);
            if (newChatData) {
                setActiveRoom({ type: 'private', id: chat_id, data: newChatData });
            }
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSelectActiveRoom = useCallback(async (type, roomData) => {
        setErrorMsg("");
        setNewMessage("");
        setMessages([]);
        setOnlineMembers([]);

        try {
            let fetchedMessages = [];
            setActiveRoom({ type, id: roomData.id, data: roomData });
            if (type === 'team') {
                fetchedMessages = await API.getTeamMessages(roomData.id);
            } else {
                fetchedMessages = await API.getChatMessages(roomData.id);
            }
            setMessages(Array.isArray(fetchedMessages) ? fetchedMessages : []);
        } catch (err) {
            console.error(err);
            setErrorMsg("Impossibile caricare i messaggi.");
        }

        const notifKey = type === 'team' ? `team_${roomData.id}` : `chat_${roomData.id}`;
        if (notifications[notifKey] > 0) {
            setNotifications(prev => ({ ...prev, [notifKey]: 0 }));
            if (type === 'team') {
                await API.markAsRead(roomData.id).catch(err => console.error("Errore markAsRead:", err));
            } else {
                await API.markPrivateAsRead(roomData.id).catch(err => console.error("Errore markAsRead:", err));
            }
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
            setShowInviteModal(false);
            setInviteUsername("");
        }
    };

    const handleOpenInvite = () => {
        setInviteUsername("");
        setShowInviteModal(true);
    };

    const handleCloseInvite = () => {
        setShowInviteModal(false);
        setInviteUsername("");
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

    const handleAccept = (id) => {
        API.acceptInvite(id)
            .then(async () => {
                await refreshAllData();
                setNotifications(prev => ({ ...prev, [`team_${id}`]: 0 })); 
                await API.markAsRead(id).catch(err => console.error("Errore markAsRead:", err)); 
            })
            .catch(e => console.error(e));
    };
    const handleDecline = (id) => { if (window.confirm("Rifiutare l'invito?")) API.declineInvite(id).then(refreshAllData); };
    const handleLeave = () => { if (window.confirm("Abbandonare il gruppo?")) API.leaveTeam(activeRoom.id).then(() => { setActiveRoom({ type: null, id: null, data: null }); setMessages([]); refreshAllData(); }); };

    const sidebarClass = theme === 'dark' ? 'bg-black border-secondary' : 'bg-light';

    return (
        <Container fluid className="d-flex flex-column p-0 h-100">
            <Row className="flex-grow-1 m-0" style={{ overflow: 'hidden' }}>
                {/* SIDEBAR */}
                <Col md={3} lg={2} className={`border-end d-flex flex-column h-100 p-0 ${sidebarClass}`} style={{ overflowX: 'hidden' }}>
                    {invites.length > 0 && (
                        <div className="p-3 bg-warning bg-opacity-10 border-bottom border-warning">
                            <small className="fw-bold text-warning text-uppercase">Inviti ({invites.length})</small>
                            <ListGroup variant="flush" className="mt-2 gap-2">
                                {invites.map(inv => (
                                    <ListGroup.Item key={inv.id} className={`d-flex flex-column rounded border shadow-sm p-2 ${theme === 'dark' ? 'bg-dark text-white' : ''}`}>
                                        <small className={`mb-2 ${theme === 'dark' ? 'text-light' : 'text-muted'}`}>{inv.invited_by} ti ha invitato al gruppo:</small>
                                        <div className="fw-bold mb-2 text-truncate w-100">{inv.name}</div>
                                        <ButtonGroup size="sm">
                                            <Button variant="outline-success" onClick={() => handleAccept(inv.id)}>Accetta</Button>
                                            <Button variant="outline-danger" onClick={() => handleDecline(inv.id)}>Rifiuta</Button>
                                        </ButtonGroup>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        </div>
                    )}

                    <div className="px-2 w-100">
                        <div className="px-2 pt-4 pb-2 d-flex justify-content-between align-items-center">
                            <small className={`fw-bolder ${theme === 'dark' ? 'text-secondary' : 'text-muted'}`}>GRUPPI</small>
                            <Button variant="link" className="p-0 text-primary" onClick={() => setShowCreateModal(true)}><i className="bi bi-plus-circle-fill"></i></Button>
                        </div>
                        <ListGroup variant="flush">
                            {teams.map(team => (
                                <ListGroup.Item key={team.id} action active={activeRoom.type === 'team' && activeRoom.id === team.id} onClick={() => handleSelectActiveRoom('team', team)} className="border-0 rounded-3 mb-1 d-flex align-items-center">
                                    <span className="text-truncate small"><i className="bi bi-hash me-1"></i> {team.name}</span>
                                    {notifications[`team_${team.id}`] > 0 && <Badge bg="danger" pill className="ms-auto">{notifications[`team_${team.id}`]}</Badge>}
                                </ListGroup.Item>
                            ))}
                        </ListGroup>

                        <div className="px-2 pt-4 pb-2 d-flex justify-content-between align-items-center">
                            <small className={`fw-bolder ${theme === 'dark' ? 'text-secondary' : 'text-muted'}`}>CHAT PRIVATE</small>
                            <Button variant="link" className="p-0 text-primary" onClick={() => setShowCreatePrivateModal(true)}><i className="bi bi-plus-circle-fill"></i></Button>
                        </div>
                        <ListGroup variant="flush">
                            {chats.map(chat => (
                                <ListGroup.Item key={chat.id} action active={activeRoom.type === 'private' && activeRoom.id === chat.id} onClick={() => handleSelectActiveRoom('private', chat)} className="border-0 rounded-3 mb-1 d-flex align-items-center">
                                    <span className="text-truncate small"><i className="bi bi-person me-1"></i> {chat.other_username}</span>
                                    {notifications[`chat_${chat.id}`] > 0 && <Badge bg="danger" pill className="ms-auto">{notifications[`chat_${chat.id}`]}</Badge>}
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </div>
                </Col>

                {/* CHAT WINDOW */}
                {activeRoom.id ? (
                    <ChatWindow 
                        activeRoom={activeRoom} messages={messages} user={user}
                        errorMsg={errorMsg} setErrorMsg={setErrorMsg}
                        newMessage={newMessage} setNewMessage={setNewMessage}
                        onlineMembers={onlineMembers} onSend={handleSendMessage}
                        onLeave={handleLeave} onShowMembers={handleShowMembers}
                        onShowInvite={handleOpenInvite}
                        onShowRename={() => { setRenameValue(activeRoom.data.name); setShowRenameModal(true); }}
                    />
                ) : (
                    <Col className="d-flex flex-column align-items-center justify-content-center" style={{ backgroundColor: chatBg, color: theme === 'dark' ? '#f8f9fa' : '#6c757d' }}>
                        <div className="display-1 opacity-25 mb-3">🦀</div>
                        <h5>Ciao, {user.username}</h5>
                        <p>Seleziona una chat per iniziare oppure creane una nuova</p>
                    </Col>
                )}
            </Row>

            {/* MODALS */}
            <CreateChatModal show={showCreatePrivateModal} onHide={() => setShowCreatePrivateModal(false)} value={newChatName} onChange={setNewChatName} onSubmit={handleCreatePrivate} />
            <CreateTeamModal show={showCreateModal} onHide={() => setShowCreateModal(false)} value={newTeamName} onChange={setNewTeamName} onSubmit={handleCreateTeam} />
            <InviteModal show={showInviteModal} onHide={handleCloseInvite} value={inviteUsername} onChange={setInviteUsername} onSubmit={handleInvite} />
            <MembersModal show={showMembersModal} onHide={() => setShowMembersModal(false)} members={members} onlineMembers={onlineMembers} user={user} />
            <RenameModal show={showRenameModal} onHide={() => setShowRenameModal(false)} value={renameValue} onChange={setRenameValue} onSubmit={handleRename} />
        </Container>
    );
}

export default ChatPage;