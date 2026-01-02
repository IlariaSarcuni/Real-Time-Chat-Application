import { useState, useEffect, useCallback, useContext } from 'react';
import { Badge, Button, Container, Row, Col, ListGroup, ButtonGroup } from 'react-bootstrap';
import API from '../../API';
import ThemeContext from '../../contexts/ThemeContext';
import "../../stylesheets/ChatPage.css";

import {ChatWindow,ChatPrivateWindow} from './ChatWindow';
import { CreateChatModal, CreateTeamModal, InviteModal, MembersModal, RenameModal } from './ChatModals';

function ChatPage({ user }) {
    const theme = useContext(ThemeContext);

    // --- STATI DATI ---
    const [teams, setTeams] = useState([]);
    const [invites, setInvites] = useState([]);
    const [currentTeam, setCurrentTeam] = useState(null);
    const [messages, setMessages] = useState([]);
    const [onlineMembers, setOnlineMembers] = useState([]);
    const [notifications, setNotifications] = useState({}); // {id_team: count}

            //DATI CHAT
    const [chats,setChats] = useState([]);
    const [currentChat,setCurrentChat] = useState([]);
    const [chatMessages,setChatMessages]= useState([]);


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

    const [showCreatePrivateModal,setShowCreatePrivateModal]=useState(false);
    const [addChat,setAddChat]=useState("");
    // --- EFFETTI & API ---
    const refreshAllData = useCallback(() => {
        API.getTeams().then(ts => setTeams(Array.isArray(ts) ? ts : [])).catch(e => console.error(e));
        API.getInvites().then(inv => setInvites(Array.isArray(inv) ? inv : [])).catch(e => console.error(e));
        API.getUnreadCounts().then(data => setNotifications(data)).catch(e => console.error(e));

        //
        API.getChatList().then(c => setChats(Array.isArray(c) ? c : [])).catch(e => console.error(e));

    }, []);

    useEffect(() => {
        refreshAllData();
        const interval = setInterval(refreshAllData, 5000);
        return () => clearInterval(interval);
    }, [refreshAllData]);

    // WebSocket logic
    useEffect(() => {
        if (!currentTeam) return;

        API.getMessages(currentTeam.id).then(setMessages).catch(console.error);
        const fetchOnlineMembers = () => {
            API.getOnlineMembers(currentTeam.id)
            .then(list => {
                let usernames = Array.isArray(list) ? list.map(member => member.username) : []
                usernames.push(user.username);  // retrieve current user, not officially online in server
                setOnlineMembers(Array.from(new Set(usernames)));
            })
            .catch(console.error)
        }
        fetchOnlineMembers();

        const { hostname, protocol } = window.location;
        const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
        const wsPort = '3000';
        const ws = new WebSocket(`${wsProtocol}//${hostname}:${wsPort}/ws/team/${currentTeam.id}`);

        ws.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);

                if(!data.data) {    // can be undefined for 'system' messages
                    data.data = new Date().toISOString().split("T")[0];
                }

                // TODO: fix notifications if your own message
                if(data.type === "chat") {  // standard chat messages
                    if (currentTeam && data.team_id === currentTeam.id) {
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
        return () => { 
            if (ws.readyState === 1) ws.close(); 
        };
    }, [currentTeam, user.username]);

    //Get current chat messages
    useEffect(()=>{
        if(!currentChat) return;
        API.getChatMessage(currentChat).then(c => setChatMessages(Array.isArray(c) ? c : [])).catch(e => console.error(e));
    },[currentChat])

    // --- HANDLERS ---
    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentTeam) return;
        try {
            await API.sendMessage(currentTeam.id, newMessage);
            setNewMessage("");
        } catch (err) { console.error(err); setErrorMsg("Errore invio"); }
    };
    const handleSendPrivate = async(e)=>
    {
        e.preventDefault();
        if (!newMessage.trim() || !currentChat) return;
        try {
            const to = chatMessages?.[0]?.name2 ?? "NULL";
            await API.sendPrivateMessage(currentChat, newMessage,user.username,to);   //TODO: dare un occhiata chatMessages[0].name2
            setNewMessage("");
        } catch (err) { console.error(err); setErrorMsg("Errore invio"); }
    }

    const handleCreateTeam = async () => {
        try {
            await API.createTeam(newTeamName);
            setShowCreateModal(false); setNewTeamName(""); refreshAllData();
        } catch (err) { alert(err.message); }
    };
    const handleCreatePrivate = async () => {
        try {
            await API.createPrivateChat(parseInt(addChat,10));
            setShowCreateModal(false); setAddChat(""); refreshAllData();

            API.getChatMessage().then(c => setChats(Array.isArray(c) ? c : [])).catch(e => console.error(e));

        } catch (err) { alert(err.message); }
    };

    const handleSelectTeam = async (team) => {
        setCurrentChat(null);
        setCurrentTeam(team);
        setErrorMsg("");
        

        
        if (notifications[team.id] > 0) {
            setNotifications(prev => ({
                ...prev,
                [team.id]: 0
            }));
    
            try {
                await API.markAsRead(team.id);
            } catch (err) {
                console.error("Errore nel segnare messaggio come letto:", err);
            }
        }
    };

    const handleSelectChat = async (chat_id) => {
        setCurrentTeam(null);
        setErrorMsg("");
    
        setCurrentChat(chat_id);

        //prendo tutti i messaggi e li visualizzo


        // if (notifications[team.id] > 0) {
        //     setNotifications(prev => ({
        //         ...prev,
        //         [team.id]: 0
        //     }));
    
        //     try {
        //         await API.markAsRead(team.id);
        //     } catch (err) {
        //         console.error("Errore nel segnare messaggio come letto:", err);
        //     }
        // }
    };

    const handleInvite = async () => {
        try {
            await API.inviteUser(inviteUsername, currentTeam.id);
            setShowInviteModal(false); setInviteUsername(""); alert("Invito inviato");
        } catch (err) { alert(err.message); }
    };

    const handleShowMembers = async () => {
        if (!currentTeam) return;
        try {
            const list = await API.getTeamMembers(currentTeam.id);
            setMembers(list);
            setShowMembersModal(true);
        } catch (err) { console.error(err); }
    };

    const handleRename = async () => {
        if (!currentTeam || !renameValue.trim()) return;
        try {
            await API.renameTeam(currentTeam.id, renameValue);
            setCurrentTeam(prev => ({ ...prev, name: renameValue }));
            setShowRenameModal(false); setRenameValue(""); refreshAllData();
        } catch (err) { alert(err.message); }
    };
    
    const handleAccept = (id) => API.acceptInvite(id).then(refreshAllData).catch(e => console.error(e));
    const handleDecline = (id) => { if(window.confirm("Sei sicuro di voler rifiutare l'invito?")) API.declineInvite(id).then(refreshAllData); };
    const handleLeave = () => { if(window.confirm("Vuoi davvero abbandonare il gruppo?")) API.leaveTeam(currentTeam.id).then(() => { setCurrentTeam(null); setMessages([]); refreshAllData(); }); };

    const sidebarClass = theme === 'dark' ? 'bg-black border-secondary' : 'bg-light';

    return (
        <Container fluid className="d-flex flex-column p-0 h-100">
            <Row className="flex-grow-1 m-0" style={{ overflow: 'hidden' }}>
                {/* 1. SIDEBAR */}
                <Col md={3} lg={2} className={`border-end d-flex flex-column h-100 p-0 ${sidebarClass}`}>
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

                    <div className="p-3 d-flex justify-content-between align-items-center">
                        <h6 className={`m-0 fw-bold ${theme === 'dark' ? 'text-light' : 'text-muted'}`}>GRUPPI</h6>
                        <Button variant="outline-primary" size="sm" onClick={() => setShowCreateModal(true)}><i className="bi bi-plus-lg"></i></Button>
                        <Button variant="outline-primary" size="sm" onClick={() => setShowCreatePrivateModal(true)}><i className="bi bi-person-add"></i></Button>
                    </div>
                    
                    <p>--------------------TEAM</p>

                    <div className="flex-grow-1 overflow-auto">
                        <ListGroup variant="flush">
                            {teams.map(team => (
                                <ListGroup.Item key={team.id} action active={currentTeam?.id === team.id} onClick={() => handleSelectTeam(team)}
                                    className="border-0 py-3 d-flex justify-content-between align-items-center"
                                    style={{ backgroundColor: currentTeam?.id === team.id ? '' : 'transparent', color: theme === 'dark' && currentTeam?.id !== team.id ? 'white' : '' }}>
                                    <span>
                                        <i className="bi bi-hash opacity-50"></i> {team.name}
                                    </span>
                                    {notifications[team.id] > 0 && (
                                        <Badge bg="danger" pill>{notifications[team.id]}</Badge>
                                    )}
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </div>
                    <p>--------------------CHAT</p>
                    <div className="flex-grow-1 overflow-auto">
                        <ListGroup variant="flush">
                            {chats.map(chat => (
                                <ListGroup.Item key={chat.id} action active={currentChat?.id === chat.id} onClick={() => handleSelectChat(chat.id)}
                                    className="border-0 py-3 d-flex justify-content-between align-items-center"
                                    style={{ backgroundColor: currentChat?.id === chat.id ? '' : 'transparent', color: theme === 'dark' && currentChat?.id !== chat.id ? 'white' : '' }}>
                                    <span>
                                        <i className="bi bi-person-fill opacity-50"></i> {chat.id}
                                    </span>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </div>
                </Col>

                {/* 2. CHAT WINDOW */}
                {
                currentTeam!=null&&currentChat==null?
                <ChatWindow 
                    currentTeam={currentTeam}
                    messages={messages}
                    user={user}
                    errorMsg={errorMsg}
                    setErrorMsg={setErrorMsg}
                    newMessage={newMessage}
                    setNewMessage={setNewMessage}
                    onlineMembers={onlineMembers}
                    onSend={handleSend}
                    onLeave={handleLeave}
                    onShowMembers={handleShowMembers}
                    onShowInvite={() => setShowInviteModal(true)}
                    onShowRename={() => { setRenameValue(currentTeam.name); setShowRenameModal(true); }}
                />
                :
                <ChatPrivateWindow 
                    currentChat={currentChat}
                    messages={chatMessages}
                    user={user}
                    errorMsg={errorMsg}
                    setErrorMsg={setErrorMsg}
                    newMessage={newMessage} //TODO: da gestire
                    setNewMessage={setNewMessage} //TODO: da gestire
                    onlineMembers={onlineMembers} //TODO: da gestire
                    onSend={handleSendPrivate}
                    onLeave={handleLeave} //TODO: da gestire
                    onShowMembers={handleShowMembers} //TODO: da togliere
                    onShowInvite={() => setShowInviteModal(true)} //TODO: da gestire
                    onShowRename={() => { setRenameValue(currentTeam.name); setShowRenameModal(true); }} //TODO: da eliminare
                />
                }
            </Row>

            {/* 3. MODALI */}
            <CreateChatModal show={showCreatePrivateModal} onHide={() => setShowCreatePrivateModal(false)} value={addChat} onChange={setAddChat} onSubmit={handleCreatePrivate} />
            <CreateTeamModal show={showCreateModal} onHide={() => setShowCreateModal(false)} value={newTeamName} onChange={setNewTeamName} onSubmit={handleCreateTeam} />
            <InviteModal show={showInviteModal} onHide={() => setShowInviteModal(false)} value={inviteUsername} onChange={setInviteUsername} onSubmit={handleInvite} />
            <MembersModal show={showMembersModal} onHide={() => setShowMembersModal(false)} members={members} onlineMembers={onlineMembers} user={user} />
            <RenameModal show={showRenameModal} onHide={() => setShowRenameModal(false)} value={renameValue} onChange={setRenameValue} onSubmit={handleRename} />

        </Container>
    );
}

export default ChatPage;