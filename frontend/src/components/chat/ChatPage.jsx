import { useState, useEffect, useCallback, useContext } from 'react';
import { Container, Row, Col, Button, ListGroup, ButtonGroup } from 'react-bootstrap';
import API from '../../API';
import ThemeContext from '../../contexts/ThemeContext';
import "../../stylesheets/ChatPage.css";

import ChatWindow from './ChatWindow';
import { CreateTeamModal, InviteModal, MembersModal, RenameModal } from './ChatModals';

function ChatPage({ user }) {
    const theme = useContext(ThemeContext);

    // --- STATI DATI ---
    const [teams, setTeams] = useState([]);
    const [invites, setInvites] = useState([]);
    const [currentTeam, setCurrentTeam] = useState(null);
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

    // --- EFFETTI & API ---
    const refreshAllData = useCallback(() => {
        API.getTeams().then(ts => setTeams(Array.isArray(ts) ? ts : [])).catch(e => console.error(e));
        API.getInvites().then(inv => setInvites(Array.isArray(inv) ? inv : [])).catch(e => console.error(e));
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
            .then(list => setOnlineMembers(Array.isArray(list) ? list.map(member => member.username) : []))
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

                if(data.type === "chat") {
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
    }, [currentTeam]);

    // --- HANDLERS ---
    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentTeam) return;
        try {
            await API.sendMessage(currentTeam.id, newMessage);
            setNewMessage("");
        } catch (err) { console.error(err); setErrorMsg("Errore invio"); }
    };

    const handleCreateTeam = async () => {
        try {
            await API.createTeam(newTeamName);
            setShowCreateModal(false); setNewTeamName(""); refreshAllData();
        } catch (err) { alert(err.message); }
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
                    </div>

                    <div className="flex-grow-1 overflow-auto">
                        <ListGroup variant="flush">
                            {teams.map(team => (
                                <ListGroup.Item key={team.id} action active={currentTeam?.id === team.id} onClick={() => setCurrentTeam(team)}
                                    className="border-0 py-3"
                                    style={{ backgroundColor: currentTeam?.id === team.id ? '' : 'transparent', color: theme === 'dark' && currentTeam?.id !== team.id ? 'white' : '' }}>
                                    <i className="bi bi-hash opacity-50"></i> {team.name}
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </div>
                </Col>

                {/* 2. CHAT WINDOW */}
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
            </Row>

            {/* 3. MODALI */}
            <CreateTeamModal show={showCreateModal} onHide={() => setShowCreateModal(false)} value={newTeamName} onChange={setNewTeamName} onSubmit={handleCreateTeam} />
            <InviteModal show={showInviteModal} onHide={() => setShowInviteModal(false)} value={inviteUsername} onChange={setInviteUsername} onSubmit={handleInvite} />
            <MembersModal show={showMembersModal} onHide={() => setShowMembersModal(false)} members={members} onlineMembers={onlineMembers} user={user} />
            <RenameModal show={showRenameModal} onHide={() => setShowRenameModal(false)} value={renameValue} onChange={setRenameValue} onSubmit={handleRename} />

        </Container>
    );
}

export default ChatPage;