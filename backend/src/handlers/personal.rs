use axum::{Extension, Json, extract::{State, Path}, response::IntoResponse};
use std::collections::{HashSet, HashMap};
use serde_json::{Value, json};

use crate::{models::*, error::AppError, state::AppState};

// --- LIST PRIVATE CHATS (id, other_username, other_user_id) ---
pub async fn get_chat_list(Extension(user): Extension<User>, 
    State(state): State<AppState>) -> Result<impl IntoResponse, AppError> {

    let rows: Vec<ChatListRow> = sqlx::query_as("SELECT c.id,
        CASE 
            WHEN c.id_user1 = ?1 THEN u2.username ELSE u1.username 
        END as other_username,
        CASE 
            WHEN c.id_user1 = ?1 THEN c.id_user2 ELSE c.id_user1
        END as other_user_id
        FROM private_chats_assoc c
        JOIN user u1 ON c.id_user1 = u1.id
        JOIN user u2 ON c.id_user2 = u2.id
        WHERE c.id_user1 = ?1 OR c.id_user2 = ?1")
        .bind(user.id)
        .fetch_all(&state.pool)
        .await?;
    
    Ok(Json(rows))
}

// --- NEW PRIVATE CHAT ---
pub async fn create_chat(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
    
    let target_username = body.get("username").and_then(|v| v.as_str()).ok_or(AppError::BadRequest("Username non trovato".into()))?;
    
    let target_user: UserSql = sqlx::query_as("SELECT id, username, password FROM user WHERE username = ?1")
        .bind(target_username).fetch_optional(&state.pool)
        .await?.ok_or(AppError::UserNotFound)?;
    
    if target_user.id as i64 == user.id {
        return Err(AppError::BadRequest("Non puoi creare una chat con te stesso".into()));
    }
    
    let existing_chat = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM private_chats_assoc WHERE (id_user1 = ?1 AND id_user2 = ?2) OR (id_user1 = ?2 AND id_user2 = ?1)")
        .bind(user.id)
        .bind(target_user.id)
        .fetch_optional(&state.pool)
        .await?;
    if let Some(id) = existing_chat {
        return Ok(Json(json!({ "id": id, "message": "Chat esistente" })));
    }
    
    let result = sqlx::query("INSERT INTO private_chats_assoc (id_user1, id_user2) VALUES(?1, ?2)")
    .bind(user.id).bind(target_user.id).execute(&state.pool).await?;

     Ok(Json(json!({ "id": result.last_insert_rowid(), "success": true, "message": "Chat creata." })))
}

// --- GET CHAT MESSAGES ---
pub async fn get_chat_messages(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Path(chat_id): Path<i64>)-> Result<impl IntoResponse, AppError> {

    let is_participant = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM private_chats_assoc WHERE id = ?1 AND (id_user1 = ?2 OR id_user2 = ?2)"
    ).bind(chat_id).bind(user.id).fetch_optional(&state.pool).await?;

    if is_participant.is_none() {
        return Err(AppError::Forbidden);
    }

    let rows: Vec<PrivateMessage> = sqlx::query_as("SELECT id_chat, message, data, ora, name1, name2, type FROM private_messages WHERE id_chat = ?1")
    .bind(chat_id).fetch_all(&state.pool).await?;

    Ok(Json(rows))
}

// --- SEND CHAT MESSAGE ---
pub async fn send_chat_message(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {

    let chat_id = body.get("chat_id").and_then(|v| v.as_i64()).ok_or(AppError::BadRequest("ID chat mancante".into()))?;
    let message = body.get("message").and_then(|v| v.as_str()).unwrap_or("");

    if message.trim().is_empty() {
        return Err(AppError::BadRequest("Impossibile inviare un messaggio vuoto".into()));
    }

    // Retrieve chat info
    let (name1, name2): (String, String) = sqlx::query_as(
        r#"
        SELECT u1.username, u2.username 
        FROM private_chats_assoc c
        JOIN user u1 ON c.id_user1 = u1.id
        JOIN user u2 ON c.id_user2 = u2.id
        WHERE c.id = ?1 AND (c.id_user1 = ?2 OR c.id_user2 = ?2)
        "#
    )
    .bind(chat_id)
    .bind(user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Forbidden)?;

    // Understand who is the sender and who is the receiver
    let sender_name = &user.username;   
    let receiver_name = if sender_name == &name1 { &name2 } else { &name1 }; 

    // Insert new chat message
    sqlx::query(
        r#"
        INSERT INTO private_messages (id_chat, message, data, ora, name1, name2, type) 
        VALUES (?1, ?2, CURRENT_DATE, CURRENT_TIME, ?3, ?4, 'chat')
        "#
    )
    .bind(chat_id)
    .bind(message)
    .bind(sender_name)
    .bind(receiver_name)
    .execute(&state.pool)
    .await?;

    // Send via WebSocket
    let message_payload = json!({
        "type": "chat",
        "chat_id": chat_id, 
        "message": message,
        "username": user.username,  
        "name1": user.username,
        "data": chrono::Local::now().format("%Y-%m-%d").to_string(),
        "ora": chrono::Local::now().format("%H:%M:%S").to_string(),
    }).to_string();

    if let Some(tx) = state.chat_rooms.get(&chat_id) {
        let _ = tx.send(message_payload);
    }

    Ok(Json(json!({ "status": "success" })))
}

// --- PRIVATE ONLINE MEMBERS ---
pub async fn get_private_online(
    Extension(user): Extension<User>,
    State(state): State<AppState>,
    Path(chat_id): Path<i64>
) -> Result<impl IntoResponse, AppError> {
    
    let is_participant = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM private_chats_assoc WHERE id = ?1 AND (id_user1 = ?2 OR id_user2 = ?2)"
    )
    .bind(chat_id)
    .bind(user.id)
    .fetch_optional(&state.pool)
    .await?;

    if is_participant.is_none() { return Err(AppError::Forbidden); }

    let online_ids: HashSet<i64> = match state.online_users.get(&chat_id) {
        Some(mutex_set) => {
            let set = mutex_set.lock().await;
            set.clone()
        }
        None => HashSet::new(),
    };

    if online_ids.is_empty() {
        return Ok(Json(Vec::<crate::models::MemberResponse>::new()));
    }

    let placeholders: Vec<String> = (0..online_ids.len()).map(|_| "?".to_string()).collect();
    let sql = format!("SELECT username FROM user WHERE id IN ({})", placeholders.join(","));
    let mut query = sqlx::query_as::<_, crate::models::MemberResponse>(&sql);
    for id in online_ids.iter() { query = query.bind(id); }

    let online_members: Vec<crate::models::MemberResponse> = query.fetch_all(&state.pool).await?;
    Ok(Json(online_members))
}

// --- GET UNREAD NOTIFICATIONS FOR PRIVATE CHATS ---
pub async fn get_unread_notifications(Extension(user): Extension<User>, 
    State(state): State<AppState>) -> Result<Json<HashMap<i64, i64>>, AppError> {

    // Count unread messagges. Compare data and hour of last access of user with data and hour of messages
    // Each data is greater than an empty string. Useful for handling cases of never opened chat.
    let rows: Vec<(i64, i64)> = sqlx::query_as(
        r#"
        SELECT pca.id, COUNT(pm.id_chat) as notification
        FROM private_chats_assoc pca
        JOIN private_messages pm ON pm.id_chat = pca.id
        WHERE (pca.id_user1 = ?1 OR pca.id_user2 = ?1)
        AND pm.name1 != ?2
        AND (
            CASE 
                WHEN pca.id_user1 = ?1 THEN (
                    pm.data > COALESCE(pca.last_data_user1, '') 
                    OR (pm.data = COALESCE(pca.last_data_user1, '') AND pm.ora > COALESCE(pca.last_ora_user1, ''))
                )
                ELSE (
                    pm.data > COALESCE(pca.last_data_user2, '') 
                    OR (pm.data = COALESCE(pca.last_data_user2, '') AND pm.ora > COALESCE(pca.last_ora_user2, ''))
                )
            END
        )
        GROUP BY pca.id
        "#
    )
    .bind(user.id)
    .bind(&user.username)
    .fetch_all(&state.pool)
    .await?;

    let mut counts = HashMap::new();
    for (chat_id, count) in rows {
        counts.insert(chat_id, count);
    }
    Ok(Json(counts))
}

// --- MARK PRIVATE CHAT AS READ ---
pub async fn mark_as_read(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Path(chat_id): Path<i64>) -> Result<impl IntoResponse, AppError> {
    
    let chat_info: (i64, i64) = sqlx::query_as(
        "SELECT id_user1, id_user2 FROM private_chats_assoc WHERE id = ?1 AND (id_user1 = ?2 OR id_user2 = ?2)"
    )
    .bind(chat_id)
    .bind(user.id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Forbidden)?;

    // Update last data and last hour of access
    if chat_info.0 == user.id {
        // User 1
        sqlx::query("UPDATE private_chats_assoc SET last_data_user1 = CURRENT_DATE, last_ora_user1 = CURRENT_TIME WHERE id = ?1")
            .bind(chat_id)
            .execute(&state.pool)
            .await?;
    } else {
        // User 2
        sqlx::query("UPDATE private_chats_assoc SET last_data_user2 = CURRENT_DATE, last_ora_user2 = CURRENT_TIME WHERE id = ?1")
            .bind(chat_id)
            .execute(&state.pool)
            .await?;
    }

    Ok(Json(json!({ "success": true })))
}