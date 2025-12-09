import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { Container, Row, Col, Form, Button, ListGroup, Modal, Alert, Badge, ButtonGroup } from 'react-bootstrap';
import API from '../API';
import dayjs from 'dayjs';
import ThemeContext from '../ThemeContext';

function ChatPage({ user }) {
    const theme = useContext(ThemeContext);

    const [teams, setTeams] = useState([]); 
    const [invites, setInvites] = useState([]); 
    const [currentTeam, setCurrentTeam] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteUsername, setInviteUsername] = useState("");
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };

    const refreshAllData = useCallback(() => {
        API.getTeams().then(ts => setTeams(Array.isArray(ts) ? ts : [])).catch(e => console.error(e));
        API.getInvites().then(inv => setInvites(Array.isArray(inv) ? inv : [])).catch(e => console.error(e));
    }, []);

    useEffect(() => {
        refreshAllData();
        const interval = setInterval(refreshAllData, 5000);
        return () => clearInterval(interval);
    }, [refreshAllData]);

    useEffect(() => {
        if (!currentTeam) return;
        API.getMessages(currentTeam.id).then(setMessages).catch(console.error);
        
        const ws = new WebSocket(`ws://localhost:3000/ws/team/${currentTeam.id}`);
        ws.onmessage = (e) => {
            try { setMessages(prev => [...prev, JSON.parse(e.data)]); } catch (err) { console.error(err); }
        };
        return () => { if (ws.readyState === 1) ws.close(); };
    }, [currentTeam]);

    useEffect(() => scrollToBottom(), [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentTeam) return;
        try {
            await API.sendMessage(currentTeam.id, newMessage);
            setNewMessage("");
        } catch (err) { console.error(err); setErrorMsg("Errore invio"); setTimeout(() => setErrorMsg(""), 3000); }
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

    const handleAcceptInvite = async (teamId) => {
        try { await API.acceptInvite(teamId); refreshAllData(); } catch (err) { console.error(err); alert("Impossibile accettare."); }
    };

    const handleDeclineInvite = async (teamId) => {
        if (!window.confirm("Vuoi rifiutare questo invito?")) return;
        try { await API.declineInvite(teamId); refreshAllData(); } catch (err) { console.error(err); alert("Impossibile rifiutare."); }
    };

    const handleLeaveTeam = async () => {
        if (!currentTeam || !window.confirm("Sicuro di voler uscire?")) return;
        try { await API.leaveTeam(currentTeam.id); setCurrentTeam(null); setMessages([]); refreshAllData(); } 
        catch (err) { console.error(err); alert("Impossibile uscire"); }
    };

    const formatDateLabel = (d) => {
        const date = dayjs(d), today = dayjs(), yest = dayjs().subtract(1, 'day');
        if (date.isSame(today, 'day')) return "Oggi";
        if (date.isSame(yest, 'day')) return "Ieri";
        return date.format('DD/MM/YYYY');
    };

    // STILI DINAMICI
    const chatBg = theme === 'dark' ? '#212529' : '#e5ddd5';
    const sidebarClass = theme === 'dark' ? 'bg-black border-secondary' : 'bg-light';
    const headerClass = theme === 'dark' ? 'bg-dark border-secondary text-white' : 'bg-white text-dark';

    return (
        <Container fluid className="d-flex flex-column p-0 h-100">
            <Row className="flex-grow-1 m-0" style={{overflow: 'hidden'}}>
                
                {/* --- SIDEBAR SINISTRA --- */}
                <Col md={3} lg={2} className={`border-end d-flex flex-column h-100 p-0 ${sidebarClass}`}>
                    
                    {invites.length > 0 && (
                        <div className="p-3 bg-warning bg-opacity-10 border-bottom border-warning">
                            <small className="fw-bold text-warning text-uppercase">Inviti ({invites.length})</small>
                            <ListGroup variant="flush" className="mt-2 gap-2">
                                {invites.map(inv => (
                                    <ListGroup.Item key={inv.id} className="d-flex flex-column rounded border shadow-sm p-2" 
                                        style={{backgroundColor: theme === 'dark' ? '#343a40' : '#fff', color: theme === 'dark' ? '#fff' : '#000'}}>
                                        <div className="fw-bold mb-2 text-truncate w-100">{inv.name}</div>
                                        <ButtonGroup size="sm" className="w-100">
                                            <Button variant="outline-success" onClick={() => handleAcceptInvite(inv.id)}><i className="bi bi-check-lg"></i></Button>
                                            <Button variant="outline-danger" onClick={() => handleDeclineInvite(inv.id)}><i className="bi bi-x-lg"></i></Button>
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
                                <ListGroup.Item 
                                    key={team.id} 
                                    action 
                                    active={currentTeam?.id === team.id} 
                                    onClick={() => setCurrentTeam(team)} 
                                    className="border-0 py-3"
                                    style={{
                                        backgroundColor: currentTeam?.id === team.id ? '' : 'transparent',
                                        color: theme === 'dark' && currentTeam?.id !== team.id ? 'white' : ''
                                    }}
                                >
                                    <i className="bi bi-hash opacity-50"></i> {team.name}
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </div>
                </Col>

                {/* --- AREA CHAT CENTRALE --- */}
                <Col md={9} lg={10} className="d-flex flex-column p-0 h-100 position-relative" style={{backgroundColor: chatBg}}>
                    {errorMsg && <Alert variant="danger" className="position-absolute w-100 top-0 m-0 rounded-0" style={{zIndex: 10}} onClose={() => setErrorMsg("")} dismissible>{errorMsg}</Alert>}
                    
                    {currentTeam ? (
                        <>
                            {/* Header */}
                            <div className={`p-3 border-bottom d-flex justify-content-between align-items-center shadow-sm ${headerClass}`} style={{height: '70px'}}>
                                <h4 className="m-0 fw-bold">
                                    <span className="text-primary opacity-50">#</span> {currentTeam.name}
                                </h4>
                                <div className="d-flex gap-2">
                                    <Button variant="primary" className="d-flex align-items-center gap-2 shadow-sm px-3 fw-semibold" onClick={() => setShowInviteModal(true)}>
                                        <i className="bi bi-person-plus-fill fs-5"></i> <span className="d-none d-md-inline">Invita</span>
                                    </Button>
                                    <Button variant="danger" className="d-flex align-items-center gap-2 shadow-sm px-3 fw-semibold" onClick={handleLeaveTeam}>
                                        <i className="bi bi-door-open-fill fs-5"></i> <span className="d-none d-md-inline">Abbandona</span>
                                    </Button>
                                </div>
                            </div>

                            {/* --- CONTENITORE PRINCIPALE (con 2 strati sovrapposti) --- */}
                            <div className="flex-grow-1 position-relative">
                                
                                {/* STRATO 1: SFONDO FISSO (GRANCHIO) */}
                                <div className="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style={{ zIndex: 0, pointerEvents: 'none' }}>
                                    <div style={{ 
                                        fontSize: '15rem', 
                                        opacity: '0.1', 
                                        filter: theme === 'dark' ? 'invert(1)' : 'grayscale(100%)' 
                                    }}>
                                        🦀
                                    </div>
                                </div>

                                {/* STRATO 2: MESSAGGI SCROLLABILI */}
                                <div className="position-absolute top-0 start-0 w-100 h-100 p-4" style={{ overflowY: 'auto', zIndex: 1 }}>
                                    
                                    {messages.map((msg, idx) => {
                                        const prevMsg = messages[idx - 1];
                                        const showDate = !prevMsg || msg.data !== prevMsg.data;
                                        const isMine = user && msg.username === user.username;

                                        let bubbleClass = isMine ? "bg-success text-white" : (theme === 'dark' ? "bg-secondary text-white" : "bg-white text-dark");

                                        return (
                                            <div key={idx} className="d-flex flex-column">
                                                {showDate && (
                                                    <div className="d-flex justify-content-center my-3">
                                                        <Badge bg={theme === 'dark' ? 'dark' : 'secondary'} className="opacity-75 fw-normal px-3 py-1 rounded-pill border">{formatDateLabel(msg.data)}</Badge>
                                                    </div>
                                                )}
                                                <div className={`mb-2 d-flex flex-column ${isMine ? 'align-items-end' : 'align-items-start'}`}>
                                                    <div className={`p-2 px-3 rounded-3 shadow-sm border ${bubbleClass}`} 
                                                         style={{maxWidth: '75%', minWidth: '120px', position: 'relative', border: theme === 'dark' ? '1px solid #444' : ''}}>
                                                        
                                                        {!isMine && <div className={`fw-bold small mb-1 ${theme === 'dark' ? 'text-info' : 'text-primary'}`}>{msg.username}</div>}
                                                        
                                                        <div style={{paddingRight: '45px', wordWrap: 'break-word'}}>{msg.message}</div>
                                                        
                                                        <div className={`small position-absolute bottom-0 end-0 pe-2 pb-1 ${isMine || theme === 'dark' ? 'text-light opacity-75' : 'text-muted'}`} style={{fontSize: '0.65rem'}}>
                                                            {msg.ora?.substring(0, 5)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                            {/* Input */}
                            <div className={`p-3 border-top ${theme === 'dark' ? 'bg-dark border-secondary' : 'bg-light'}`}>
                                <Form onSubmit={handleSend}>
                                    <Row className="g-2">
                                        <Col>
                                            <Form.Control 
                                                type="text" 
                                                placeholder="Scrivi..." 
                                                value={newMessage} 
                                                onChange={(e) => setNewMessage(e.target.value)} 
                                                className="rounded-pill py-2 px-3"
                                                style={{
                                                    backgroundColor: theme === 'dark' ? '#343a40' : '#fff',
                                                    color: theme === 'dark' ? '#fff' : '#000',
                                                    border: theme === 'dark' ? '1px solid #555' : ''
                                                }}
                                            />
                                        </Col>
                                        <Col xs="auto"><Button type="submit" variant="primary" className="rounded-circle p-2 px-3"><i className="bi bi-send-fill"></i></Button></Col>
                                    </Row>
                                </Form>
                            </div>
                        </>
                    ) : (
                        <div className={`h-100 d-flex flex-column align-items-center justify-content-center ${theme === 'dark' ? 'text-light' : 'text-muted'}`}>
                            <div className="display-1 opacity-25 mb-3">🦀</div>
                            <h4>Benvenuto su Ruggine Chat</h4>
                        </div>
                    )}
                </Col>
            </Row>

            {/* Modali */}
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered>
                <Modal.Header closeButton><Modal.Title>Nuovo Gruppo</Modal.Title></Modal.Header>
                <Modal.Body><Form.Control type="text" placeholder="Nome..." value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} autoFocus /></Modal.Body>
                <Modal.Footer><Button variant="primary" onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Crea</Button></Modal.Footer>
            </Modal>

            <Modal show={showInviteModal} onHide={() => setShowInviteModal(false)} centered>
                <Modal.Header closeButton><Modal.Title>Invita</Modal.Title></Modal.Header>
                <Modal.Body><Form.Control type="text" placeholder="Username..." value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} autoFocus /></Modal.Body>
                <Modal.Footer><Button variant="success" onClick={handleInvite} disabled={!inviteUsername.trim()}>Invia</Button></Modal.Footer>
            </Modal>
        </Container>
    );
}

export default ChatPage;