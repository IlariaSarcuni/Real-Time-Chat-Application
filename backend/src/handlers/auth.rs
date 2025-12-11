use axum::{Extension, Json, extract::State, http::StatusCode, response::IntoResponse};
use axum_session_auth::AuthSession;       
use axum_session_sqlx::SessionSqlitePool; 
use sqlx::SqlitePool;
use serde_json::json;

use crate::{models::{User, UserRequest, UserSql, UserInfo}, error::AppError, state::AppState};

pub async fn get_me(Extension(user): Extension<User>) -> impl IntoResponse {
    Json(UserInfo { id: user.id, username: user.username })
}

pub async fn register(
    State(state): State<AppState>, 
    Json(user): Json<UserRequest>
) -> Result<impl IntoResponse, AppError> {
    
    if user.username.trim().is_empty() || user.password.trim().is_empty() {
        return Err(AppError::BadRequest("Username e password richiesti.".into()));
    }

    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM user WHERE username = ?1)")
        .bind(&user.username).fetch_one(&state.pool).await?;

    if exists { return Err(AppError::RegistrationFail); }
    
    let hash_password = bcrypt::hash(user.password, 10).map_err(anyhow::Error::new)?;
    
    sqlx::query("INSERT INTO user (username, password) VALUES (?1, ?2)")
        .bind(&user.username).bind(&hash_password).execute(&state.pool).await?;
    
    Ok((StatusCode::OK, Json(json!({ "success": true, "message": "Registrazione completata!" }))))
}

pub async fn login(
    auth: AuthSession<User, i64, SessionSqlitePool, SqlitePool>, 
    State(state): State<AppState>, 
    Json(user): Json<UserRequest>
) -> Result<impl IntoResponse, AppError> {
    let user_sql: Option<UserSql> = sqlx::query_as("SELECT * FROM user WHERE username = ?1")
        .bind(&user.username).fetch_optional(&state.pool).await?;

    if let Some(u) = user_sql {
        if bcrypt::verify(user.password, &u.password).unwrap_or(false) {
            auth.login_user(u.id as i64);
            return Ok(Json(json!({ "success": true, "message": "Login effettuato!" })));
        }
    }
    Err(AppError::LoginFail)
}

pub async fn log_out(auth: AuthSession<User, i64, SessionSqlitePool, SqlitePool>) -> impl IntoResponse {
    auth.logout_user();
    Json(json!({ "success": true, "message": "Logout completato." }))
}