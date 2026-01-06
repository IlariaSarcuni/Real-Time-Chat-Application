use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Path, State},
    response::IntoResponse,
    Extension, http::StatusCode,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use tokio::sync::broadcast;
use std::collections::HashSet;
use std::sync::Arc;
use colored::*;

use crate::{models::User, state::AppState};

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    Extension(user): Extension<User>,
    State(state): State<AppState>,
    uri: axum::http::Uri,       // understand if team or private
    Path(id): Path<i64>    // generic id
) -> impl IntoResponse {
    let path = uri.path();

    if path.contains("/ws/team") {
        let is_member = sqlx::query_scalar::<_, i64>("SELECT id_user FROM user_team WHERE id_user = ?1 AND id_team = ?2")
        .bind(user.id).bind(id)
        .fetch_one(&state.pool)
        .await;

        if is_member.is_err() {
            return (StatusCode::FORBIDDEN, "Accesso negato: Non sei membro del gruppo").into_response();
        }
        println!("{} {} connesso al team {}", "[INFO]".cyan(), user.username, id);
    } else {    // private
        let is_participant = sqlx::query_scalar::<_, i64>("SELECT id FROM private_chats_assoc WHERE id = ?1 AND (id_user1 = ?2 OR id_user2 = ?2)")
            .bind(id).bind(user.id).fetch_one(&state.pool).await;
        if is_participant.is_err() { 
            return (StatusCode::FORBIDDEN, "Accesso negato: Non sei partecipante di questa chat").into_response();
        }
        println!("{} {} partecipa alla chat {}", "[INFO]".cyan(), user.username, id);
    }

    ws.on_upgrade(move |socket| handle_socket(socket, user, state, id))
}

async fn handle_socket(socket: WebSocket, user: User, state: AppState, team_id: i64) {
    // user joined team. Now online
    let team_users = state.online_users.entry(team_id).or_insert_with(|| Arc::new(tokio::sync::Mutex::new(HashSet::new()))).clone();
    {
        let mut users = team_users.lock().await;
        users.insert(user.id);
        println!("{} {} is online", "[INFO]".cyan(), user.username);

        let message = format!(r#"{{"type": "online", "user_id": {}, "username": "{}"}}"#, user.id, user.username);
        if let Some(tx_chat) = state.chat_rooms.get(&team_id) {
            let _ = tx_chat.send(message);
        }
    }

    let tx = state.chat_rooms.entry(team_id).or_insert_with(|| broadcast::channel(100).0).clone();
    let mut rx = tx.subscribe();
    let (mut sender, mut receiver) = socket.split();

    let mut send_task = tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(msg) => if sender.send(Message::Text(msg.into())).await.is_err() { break; },
                Err(broadcast::error::RecvError::Lagged(_)) => {},
                Err(_) => break,
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Close(_))) = receiver.next().await { break; }
    });

    tokio::select! { _ = &mut send_task => recv_task.abort(), _ = &mut recv_task => send_task.abort() }

    {
        let mut users = team_users.lock().await;
        users.remove(&user.id);
        println!("{} {} is offline", "[INFO]".cyan(), user.username);

        let message = format!(r#"{{"type": "offline", "user_id": {}, "username": "{}"}}"#, user.id, user.username);
        if let Some(tx_chat) = state.chat_rooms.get(&team_id) {
            let _ = tx_chat.send(message);
        }
    }

    println!("{} User {} disconnected from team {}", "[INFO]".cyan(), user.username, team_id);
}