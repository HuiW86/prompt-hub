use serde::{Serialize, Serializer};

// Tauri-facing error. Wraps the Tauri-free repo-core RepoError and adds the
// variants that only make sense inside the app shell (window/IPC, state lock).
// Serialize-to-string so the React client receives a plain message string.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Repo(#[from] repo_core::RepoError),
    #[error("tauri: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("state lock poisoned")]
    LockPoisoned,
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
