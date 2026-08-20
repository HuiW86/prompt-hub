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
    // ADR-027. Three distinct variants rather than one string, because the
    // settings UI must tell them apart: the first two are the user's input to
    // fix, the third is another app holding the chord — nothing the user can
    // fix from inside this window.
    #[error("无法识别的快捷键：{0}")]
    InvalidAccelerator(String),
    #[error("快捷键必须包含至少一个修饰键（⌘ / ⌥ / ⌃ / ⇧）")]
    ModifierRequired,
    #[error("快捷键 {0} 已被其他应用占用，请换一组")]
    HotkeyUnavailable(String),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
