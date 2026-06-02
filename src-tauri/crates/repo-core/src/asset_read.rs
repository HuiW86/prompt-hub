use rusqlite::Connection;

use crate::error::RepoResult;
use crate::models::{AlignmentPhrase, Composition, Macro, Modifier, Phase, SceneWithChildren};
use crate::repo;

/// The read-only view of the real asset tables. This is the *only* asset-layer
/// surface the MCP server gets (it lists existing assets so Claude avoids
/// proposing duplicates, plan §5.3); it can never insert, because that lives in
/// `repo-write::AssetRepo`, which the MCP binary doesn't depend on (plan §3.3).
pub trait ReadOnlyAssetRepo {
    fn list_phases(&self) -> RepoResult<Vec<Phase>>;
    fn list_alignment_phrases(&self) -> RepoResult<Vec<AlignmentPhrase>>;
    fn list_modifiers(&self) -> RepoResult<Vec<Modifier>>;
    fn list_compositions(&self) -> RepoResult<Vec<Composition>>;
    fn list_macros(&self) -> RepoResult<Vec<Macro>>;
    fn list_scenes_with_children(&self) -> RepoResult<Vec<SceneWithChildren>>;
}

impl ReadOnlyAssetRepo for Connection {
    fn list_phases(&self) -> RepoResult<Vec<Phase>> {
        repo::list_phases(self)
    }
    fn list_alignment_phrases(&self) -> RepoResult<Vec<AlignmentPhrase>> {
        repo::list_alignment_phrases(self)
    }
    fn list_modifiers(&self) -> RepoResult<Vec<Modifier>> {
        repo::list_modifiers(self)
    }
    fn list_compositions(&self) -> RepoResult<Vec<Composition>> {
        repo::list_compositions(self)
    }
    fn list_macros(&self) -> RepoResult<Vec<Macro>> {
        repo::list_macros(self)
    }
    fn list_scenes_with_children(&self) -> RepoResult<Vec<SceneWithChildren>> {
        repo::list_scenes_with_children(self)
    }
}
