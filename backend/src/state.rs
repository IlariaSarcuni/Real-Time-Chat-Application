use sqlx::SqlitePool;
use std::sync::Arc;
use dashmap::DashMap;
use tokio::sync::broadcast;

pub type ChatRooms = Arc<DashMap<i64, broadcast::Sender<String>>>;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub chat_rooms: ChatRooms,
}

impl AppState {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            chat_rooms: Arc::new(DashMap::new()),
        }
    }
}