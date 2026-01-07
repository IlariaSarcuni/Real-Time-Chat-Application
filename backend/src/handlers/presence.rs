use axum::{Extension, Json, extract::{Path, State}, http::StatusCode};
use serde_json::json;
use std::time::{Duration, Instant};

use crate::{models::User, state::AppState};

const ONLINE_THRESHOLD: Duration = Duration::from_secs(60);

// Update current user's heartbeat
pub async fn heartbeat(Extension(user): Extension<User>, State(state): State<AppState>) -> Json<serde_json::Value> {
    state.presence_map.insert(user.id, Instant::now());
    Json(json!({ "success": true }))
}

// Check if a user is online globally (recent heartbeat)
pub async fn is_online(State(state): State<AppState>, Path(user_id): Path<i64>) -> (StatusCode, Json<serde_json::Value>) {
    let now = Instant::now();
    let online = match state.presence_map.get(&user_id) {
        Some(ts) => now.duration_since(*ts.value()) <= ONLINE_THRESHOLD,
        None => false,
    };
    (StatusCode::OK, Json(json!({ "online": online })))
}
