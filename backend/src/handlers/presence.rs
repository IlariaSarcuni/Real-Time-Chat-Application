use axum::{Json, extract::{Path, State}, http::StatusCode};
use crate::state::AppState;
use serde_json::json;

// Check if a user is online reading the presence_map
pub async fn is_online(State(state): State<AppState>, 
    Path(user_id): Path<i64>) -> (StatusCode, Json<serde_json::Value>) {

    let online = state.presence_map.contains_key(&user_id);
    (StatusCode::OK, Json(json!({ "online": online })))

}