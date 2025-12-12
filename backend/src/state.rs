use sqlx::SqlitePool;
use std::sync::Arc;
use dashmap::DashMap;
use tokio::sync::broadcast;
use std::collections::HashSet;

pub type ChatRooms = Arc<DashMap<i64, broadcast::Sender<String>>>;
pub type OnlineUsers = Arc<DashMap<i64, Arc<tokio::sync::Mutex<HashSet<i64>>>>>;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub chat_rooms: ChatRooms,
    pub online_users: OnlineUsers
}

impl AppState {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            chat_rooms: Arc::new(DashMap::new()),
            online_users: Arc::new(DashMap::new())
        }
    }
}