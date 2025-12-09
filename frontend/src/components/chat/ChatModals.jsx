import { Modal, Button, Form, ListGroup, Badge } from 'react-bootstrap';
import { getColorFromUsername } from '../../utils/chatUtils';

export function CreateTeamModal({ show, onHide, value, onChange, onSubmit }) {
    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton><Modal.Title>Nuovo Gruppo</Modal.Title></Modal.Header>
            <Modal.Body>
                <Form.Control type="text" placeholder="Nome..." value={value} onChange={(e) => onChange(e.target.value)} autoFocus />
            </Modal.Body>
            <Modal.Footer>
                <Button variant="primary" onClick={onSubmit} disabled={!value.trim()}>Crea</Button>
            </Modal.Footer>
        </Modal>
    );
}

export function InviteModal({ show, onHide, value, onChange, onSubmit }) {
    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton><Modal.Title>Invita</Modal.Title></Modal.Header>
            <Modal.Body>
                <Form.Control type="text" placeholder="Username..." value={value} onChange={(e) => onChange(e.target.value)} autoFocus />
            </Modal.Body>
            <Modal.Footer>
                <Button variant="success" onClick={onSubmit} disabled={!value.trim()}>Invia</Button>
            </Modal.Footer>
        </Modal>
    );
}

export function RenameModal({ show, onHide, value, onChange, onSubmit }) {
    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton><Modal.Title>Rinomina Gruppo</Modal.Title></Modal.Header>
            <Modal.Body>
                <Form.Control type="text" placeholder="Nuovo nome..." value={value} onChange={(e) => onChange(e.target.value)} autoFocus />
            </Modal.Body>
            <Modal.Footer>
                <Button variant="primary" onClick={onSubmit} disabled={!value.trim()}>Salva</Button>
            </Modal.Footer>
        </Modal>
    );
}

export function MembersModal({ show, onHide, members, user }) {
    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton><Modal.Title>Membri del Gruppo</Modal.Title></Modal.Header>
            <Modal.Body>
                <ListGroup variant="flush">
                    {members.map((member, idx) => (
                        <ListGroup.Item key={idx} className="d-flex align-items-center gap-2">
                            <div className="text-white rounded-circle d-flex justify-content-center align-items-center"
                                style={{ width: '30px', height: '30px', backgroundColor: getColorFromUsername(member.username) }}>
                                {member.username.charAt(0).toUpperCase()}
                            </div>
                            {member.username}
                            {user && user.username === member.username && <Badge bg="secondary" className="ms-auto">Tu</Badge>}
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            </Modal.Body>
        </Modal>
    );
}