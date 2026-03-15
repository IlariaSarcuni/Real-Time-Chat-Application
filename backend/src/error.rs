use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;

pub enum AppError {
    Sqlx(sqlx::Error),
    Anyhow(anyhow::Error),
    LoginFail,
    RegistrationFail,
    UserNotFound,
    Forbidden,
    BadRequest(String),
}

impl From<sqlx::Error> for AppError {
    fn from(inner: sqlx::Error) -> Self {
        AppError::Sqlx(inner)
    }
}

impl From<anyhow::Error> for AppError {
    fn from(inner: anyhow::Error) -> Self {
        AppError::Anyhow(inner)
    }
}

// Convert the error in an HTTP JSON response
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::Sqlx(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Errore Database: {}", e)),
            AppError::Anyhow(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Errore Interno: {}", e)),
            AppError::LoginFail => (StatusCode::UNAUTHORIZED, "Credenziali non valide.".to_string()),
            AppError::RegistrationFail => (StatusCode::BAD_REQUEST, "Username già in uso.".to_string()),
            AppError::UserNotFound => (StatusCode::NOT_FOUND, "Utente non trovato.".to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "Non hai i permessi necessari.".to_string()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
        };

        let body = Json(json!({
            "error": true,
            "message": error_message
        }));

        (status, body).into_response()
    }
}