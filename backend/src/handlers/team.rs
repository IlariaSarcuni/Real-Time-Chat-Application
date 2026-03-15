use axum::{Extension, Json, extract::{State, Query, Path}, http::StatusCode, response::IntoResponse};
use serde_json::{Value, json};
use std::collections::HashMap;
use chrono::Local;

use crate::{models::*, error::AppError, state::AppState};

// --- CHECK IF A USER BELONGS TO THE TEAM ---
async fn check_membership(user_id: i64, team_id: i64, pool: &sqlx::SqlitePool) -> Result<bool, AppError> {

    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM user_team WHERE id_user = ?1 AND id_team = ?2)")
        .bind(user_id).bind(team_id).fetch_one(pool).await?;

    Ok(exists)
}

// --- LIST TEAMS (id, name) ---
pub async fn get_teams(Extension(user): Extension<User>, 
    State(state): State<AppState>) -> Result<Json<Vec<Team>>, AppError> {

    let rows = sqlx::query_as(r#"SELECT t.id, t.name FROM team t JOIN user_team ut ON ut.id_team = t.id WHERE ut.id_user = ?1"#)
        .bind(user.id).fetch_all(&state.pool).await?;

    Ok(Json(rows))
}

// --- LIST INVITES (user invited in a team by another user) ---
pub async fn get_list_invites(Extension(user): Extension<User>, 
    State(state): State<AppState>) -> Result<Json<Vec<InviteWithSender>>, AppError> {

    let rows = sqlx::query_as(r#"
        SELECT t.id, t.name, COALESCE(u.username, 'Unknown') as invited_by
        FROM invite i
        JOIN team t ON i.id_team = t.id
        LEFT JOIN user u ON u.id = i.id_invited_by
        WHERE i.id_user = ?1
    "#)
        .bind(user.id).fetch_all(&state.pool).await?;

    Ok(Json(rows))
}

// --- LIST TEAM MEMBERS ---
pub async fn get_team_members(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Path(team_id): Path<i64>) -> Result<impl IntoResponse, AppError> {

    if !check_membership(user.id, team_id, &state.pool).await? { return Err(AppError::Forbidden); }
    let members: Vec<MemberResponse> = sqlx::query_as("SELECT u.username FROM user u INNER JOIN user_team ut ON ut.id_user = u.id WHERE ut.id_team = ?1 ORDER BY u.username")
        .bind(team_id).fetch_all(&state.pool).await?;

    Ok(Json(members))
}

// --- LIST ONLINE MEMBERS ---
pub async fn get_online_members(
    Extension(user): Extension<User>,
    State(state): State<AppState>,
    Path(team_id): Path<i64>
) -> impl IntoResponse {
    
    let caller_query = "SELECT EXISTS(SELECT 1 FROM user_team WHERE id_user = ?1 AND id_team = ?2)";
    let is_caller_in_team: bool = sqlx::query_scalar(caller_query)
        .bind(user.id).bind(team_id).fetch_one(&state.pool).await.unwrap_or(false);

    if !is_caller_in_team {
        return (StatusCode::FORBIDDEN, "Non appartieni a questo gruppo").into_response();
    }

    let members: Vec<(i64, String)> = match sqlx::query_as::<_, (i64, String)>(
        r#"SELECT u.id, u.username FROM user_team ut JOIN user u ON ut.id_user = u.id WHERE ut.id_team = ?1"#
    )
    .bind(team_id)
    .fetch_all(&state.pool)
    .await {
        Ok(rows) => rows,
        Err(e) => {
            eprintln!("Errore DB nel recupero membri del gruppo: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Errore Database").into_response();
        }
    };

    let online_members: Vec<MemberResponse> = members
        .into_iter()
        .filter(|(id, _)| state.presence_map.contains_key(id))
        .map(|(_, username)| MemberResponse { username })
        .collect();

    (StatusCode::OK, Json(online_members)).into_response()
}

// --- GET UNREAD NOTIFICATIONS FOR TEAMS ---
pub async fn get_unread_notifications(Extension(user): Extension<User>, 
    State(state): State<AppState>) -> Result<Json<HashMap<i64, i64>>, AppError> {

    let rows: Vec<UnreadCount> = sqlx::query_as(r#"
        SELECT ut.id_team, COUNT(m.id_message) as notification
        FROM user_team ut
        JOIN message m ON m.id_team = ut.id_team
        WHERE ut.id_user = ?1 
        AND m.id_user != ?1
        AND m.type = 'chat'
        AND (
            m.data > ut.last_data 
            OR (m.data = ut.last_data AND m.ora > ut.last_ora)
        )
        GROUP BY ut.id_team
    "#).bind(user.id).fetch_all(&state.pool).await?;

    let mut counts = HashMap::new();
    for row in rows {
        counts.insert(row.id_team, row.notification as i64);
    }

    Ok(Json(counts))
}

// --- MARK TEAM MESSAGES AS READ ---
pub async fn mark_as_read(Extension(user): Extension<User>, 
    State(state): State<AppState>,
    Path(team_id): Path<i64>) -> Result<impl IntoResponse, AppError> {

    sqlx::query("UPDATE user_team SET last_data = CURRENT_DATE, last_ora = CURRENT_TIME WHERE id_user = ?1 AND id_team = ?2")
        .bind(user.id).bind(team_id).execute(&state.pool).await?;

    Ok(StatusCode::OK)
}

// --- NEW TEAM ---
pub async fn create_team(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
        
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("");
    if name.trim().is_empty() { return Err(AppError::BadRequest("Nome gruppo richiesto.".into())); }

    let insert_res = sqlx::query("INSERT INTO team (name) VALUES (?1)").bind(name).execute(&state.pool).await?;
    let team_id = insert_res.last_insert_rowid();
    sqlx::query("INSERT INTO user_team (id_user, id_team) VALUES (?1, ?2)").bind(user.id).bind(team_id).execute(&state.pool).await?;

    // Track join time to hide previous messages (before the join)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS user_team_join (id_user INTEGER NOT NULL, id_team INTEGER NOT NULL, joined_at TEXT NOT NULL, PRIMARY KEY (id_user, id_team))"
    ).execute(&state.pool).await?;
    sqlx::query("INSERT OR REPLACE INTO user_team_join (id_user, id_team, joined_at) VALUES (?1, ?2, datetime('now'))")
        .bind(user.id).bind(team_id).execute(&state.pool).await?;

    Ok((StatusCode::CREATED, Json(json!({ "success": true, "message": "Gruppo creato!", "team": { "id": team_id, "name": name } }))))
}

// --- RENAME TEAM ---
pub async fn rename_team(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {

    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    let new_name = body.get("new_name").and_then(|v| v.as_str()).unwrap_or("");

    if team_id == 0 || new_name.trim().is_empty() { return Err(AppError::BadRequest("Dati invalidi.".into())); }
    if !check_membership(user.id, team_id, &state.pool).await? { return Err(AppError::Forbidden); }

    sqlx::query("UPDATE team SET name = ?1 WHERE id = ?2").bind(new_name).bind(team_id).execute(&state.pool).await?;

    Ok(Json(json!({ "success": true, "message": "Gruppo rinominato." })))
}

// --- LEAVE TEAM ---
pub async fn leave_team(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {

    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    if team_id == 0 { return Err(AppError::BadRequest("ID Gruppo invalido.".into())); }

    let mut tx = state.pool.begin().await?;
    
    let (members_count,): (i64,) =sqlx::query_as("SELECT COUNT(*) FROM user_team WHERE id_team = ?1").bind(team_id).fetch_one(&mut *tx).await?;

    sqlx::query("DELETE FROM user_team WHERE id_user = ?1 AND id_team = ?2").bind(user.id).bind(team_id).execute(&mut *tx).await?;
    sqlx::query("DELETE FROM user_team_join WHERE id_user = ?1 AND id_team = ?2").bind(user.id).bind(team_id).execute(&mut *tx).await?;

    // If last member leaves the team, delete the team and its messages
    if members_count==1 {
        sqlx::query("DELETE FROM team WHERE id= ?1").bind(team_id).execute(&mut *tx).await?;
        sqlx::query("DELETE FROM message WHERE id_team= ?1").bind(team_id).execute(&mut *tx).await?;
        sqlx::query("DELETE FROM user_team_join WHERE id_team = ?1").bind(team_id).execute(&mut *tx).await?;
        
        tx.commit().await?;
        
        // Send notification message user left team
        let system_message = format!(r#"{{"type": "system", "message": "{} ha abbandonato il gruppo", "username": "{}", "event": "left"}}"#, user.username, user.username);
        if let Some(tx) = state.chat_rooms.get(&team_id) {
            let _ = tx.send(system_message.clone());
        }
        return Ok(Json(json!({
            "success": true,
            "message": "Hai abbandonato il gruppo."
        })));
    }

    let system_message_db = format!("{} ha abbandonato il gruppo", user.username);
    sqlx::query("INSERT INTO message (id_user, id_team, message, data, ora, type) VALUES (?1, ?2, ?3, CURRENT_DATE, CURRENT_TIME, 'system')")
        .bind(user.id).bind(team_id).bind(&system_message_db).execute(&mut *tx).await?;

    tx.commit().await?;

    let system_message = format!(r#"{{"type": "system", "message": "{} ha abbandonato il gruppo", "username": "{}", "event": "left"}}"#, user.username, user.username);
    if let Some(tx) = state.chat_rooms.get(&team_id) {
        let _ = tx.send(system_message.clone());
    }

    Ok(Json(json!({ "success": true, "message": "Hai abbandonato il gruppo." })))
}

// --- SEND TEAM INVITE ---
pub async fn invite(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {

    let username = body.get("username").and_then(|v| v.as_str()).unwrap_or("");
    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);

    if username.is_empty() || team_id == 0 { return Err(AppError::BadRequest("Dati invito invalidi.".into())); }
    if !check_membership(user.id, team_id, &state.pool).await? { return Err(AppError::Forbidden); }

    let target_user_id: i64 = match sqlx::query_scalar("SELECT id FROM user WHERE username = ?1").bind(username).fetch_one(&state.pool).await {
        Ok(id) => id, Err(_) => return Err(AppError::UserNotFound),
    };

    if target_user_id == user.id { return Err(AppError::BadRequest("Non puoi autoinvitarti.".into())); }

    let already_in: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM user_team WHERE id_user = ?1 AND id_team = ?2)")
        .bind(target_user_id).bind(team_id).fetch_one(&state.pool).await?;
    if already_in { return Err(AppError::BadRequest("Utente già nel gruppo.".into())); }

    // Block duplicated invites. Already sent
    let pending: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM invite WHERE id_user = ?1 AND id_team = ?2)")
        .bind(target_user_id).bind(team_id).fetch_one(&state.pool).await?;

    if pending {
        return Err(AppError::BadRequest("Invito già inviato e in attesa di risposta.".into()));
    }

    sqlx::query("INSERT INTO invite (id_user, id_team, id_invited_by) VALUES (?1, ?2, ?3)")
        .bind(target_user_id)
        .bind(team_id)
        .bind(user.id)
        .execute(&state.pool)
        .await?;

    Ok(Json(json!({ "success": true, "message": "Invito inviato!" })))
}

// --- ACCEPT TEAM INVITE ---
pub async fn accept(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {

    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    if team_id == 0 { return Err(AppError::BadRequest("ID Gruppo mancante.".into())); }

    let mut tx = state.pool.begin().await?;
    sqlx::query("INSERT INTO user_team (id_user, id_team) VALUES (?1, ?2)").bind(user.id).bind(team_id).execute(&mut *tx).await?;

    // Track join time to hide previous messages (before the join)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS user_team_join (id_user INTEGER NOT NULL, id_team INTEGER NOT NULL, joined_at TEXT NOT NULL, PRIMARY KEY (id_user, id_team))"
    ).execute(&mut *tx).await?;
    sqlx::query("INSERT OR REPLACE INTO user_team_join (id_user, id_team, joined_at) VALUES (?1, ?2, datetime('now'))")
        .bind(user.id).bind(team_id).execute(&mut *tx).await?;

    sqlx::query("DELETE FROM invite WHERE id_user = ?1 AND id_team = ?2").bind(user.id).bind(team_id).execute(&mut *tx).await?;
    
    let system_message_db = format!("{} è entrato nel gruppo", user.username);
    sqlx::query("INSERT INTO message (id_user, id_team, message, data, ora, type) VALUES (?1, ?2, ?3, CURRENT_DATE, CURRENT_TIME, 'system')")
        .bind(user.id).bind(team_id).bind(&system_message_db).execute(&mut *tx).await?;
    
    tx.commit().await?;

    let system_message = format!(r#"{{"type": "system", "message": "{} è entrato nel gruppo", "username": "{}", "event": "joined"}}"#, user.username, user.username);
    if let Some(tx) = state.chat_rooms.get(&team_id) {
        let _ = tx.send(system_message.clone());
    }

    Ok(Json(json!({ "success": true, "message": "Invito accettato!" })))
}

// --- DECLINE TEAM INVITE ---
pub async fn decline(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {

    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    if team_id == 0 { return Err(AppError::BadRequest("ID Gruppo mancante.".into())); }

    sqlx::query("DELETE FROM invite WHERE id_user = ?1 AND id_team = ?2").bind(user.id).bind(team_id).execute(&state.pool).await?;

    Ok(Json(json!({ "success": true, "message": "Invito rifiutato." })))
}

// --- GET TEAM MESSAGES ---
pub async fn get_messages(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Query(params): Query<HashMap<String, String>>
    ) -> Result<impl IntoResponse, AppError> {

    let team_id = params.get("team_id").and_then(|v| v.parse::<i64>().ok()).unwrap_or(0);
    if team_id == 0 { return Err(AppError::BadRequest("ID Gruppo mancante.".into())); }

    if !check_membership(user.id, team_id, &state.pool).await? { return Err(AppError::Forbidden); }

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS user_team_join (id_user INTEGER NOT NULL, id_team INTEGER NOT NULL, joined_at TEXT NOT NULL, PRIMARY KEY (id_user, id_team))"
    ).execute(&state.pool).await?;

    let joined_at: Option<String> = sqlx::query_scalar(
        "SELECT joined_at FROM user_team_join WHERE id_user = ?1 AND id_team = ?2"
    )
    .bind(user.id)
    .bind(team_id)
    .fetch_optional(&state.pool)
    .await?;

    let cutoff = joined_at.unwrap_or_else(|| "1970-01-01 00:00:00".to_string());

    let rows: Vec<MessageResponse> = sqlx::query_as(r#"
        SELECT u.username, m.message, m.ora, m.data, m.type
        FROM message m
        JOIN user u ON m.id_user = u.id
        WHERE m.id_team = ?1
          AND datetime(m.data || ' ' || m.ora) >= datetime(?2)
        ORDER BY m.data ASC, m.ora ASC
    "#)
        .bind(team_id)
        .bind(cutoff)
        .fetch_all(&state.pool)
        .await?;

    Ok(Json(rows))
}

// --- SEND TEAM MESSAGE ---
pub async fn send_message(Extension(user): Extension<User>, 
    State(state): State<AppState>, 
    Json(body): Json<Value>) -> Result<impl IntoResponse, AppError> {
        
    let team_id = body.get("team_id").and_then(|v| v.as_i64()).unwrap_or(0);
    let msg = body.get("message").and_then(|v| v.as_str()).unwrap_or("");

    if team_id == 0 || msg.trim().is_empty() { return Err(AppError::BadRequest("Messaggio non valido.".into())); }
    if !check_membership(user.id, team_id, &state.pool).await? { return Err(AppError::Forbidden); }

    sqlx::query("INSERT INTO message (id_user,id_team,message,data,ora,type) VALUES (?1,?2,?3, CURRENT_DATE, CURRENT_TIME, 'chat')")
        .bind(user.id).bind(team_id).bind(msg).execute(&state.pool).await?;

    let msg_payload = json!({
        "username": user.username,
        "team_id": team_id,
        "message": msg,
        "ora": Local::now().format("%H:%M:%S").to_string(),
        "data": Local::now().format("%Y-%m-%d").to_string(),
        "type": "chat"
    });

    if let Some(tx) = state.chat_rooms.get(&team_id) {
        let _ = tx.send(serde_json::to_string(&msg_payload).unwrap_or_default());
    }

    Ok(Json(json!({ "success": true, "message": "Inviato." })))
}