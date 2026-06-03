//! MCP-facing argument types and the small conversions that bridge them to the
//! `repo-core` domain types. These live here (not in `repo-core`) so the
//! `JsonSchema` derives — which the rmcp tool macros need to publish input
//! schemas — don't leak the `rmcp::schemars` dependency into the data layer.
//!
//! Each type mirrors a `repo-core` shape but adds defaults that make the tools
//! easier for a model to call (schema_version defaults to 1, provenance fields
//! are mostly optional).

use repo_core::models::{DraftPayload, Provenance};
use rmcp::schemars::JsonSchema;
use serde::{Deserialize, Serialize};

fn schema_v1() -> u32 {
    1
}

fn default_source_app() -> String {
    "Claude Code".to_string()
}

/// The typed body of a draft, as supplied by the model. Internally tagged by
/// `target_type` so one field carries both the discriminant and the variant
/// fields — identical wire shape to `repo_core::DraftPayload`.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
#[serde(tag = "target_type", rename_all = "snake_case")]
pub enum PayloadArg {
    /// A reusable prompt fragment (one of the four-quadrant modifiers).
    Modifier {
        #[serde(default = "schema_v1")]
        schema_version: u32,
        name: String,
        content: String,
        phase_id: String,
        #[serde(default)]
        scene_id: Option<String>,
    },
    /// A named bundle of modifier ids.
    Composition {
        #[serde(default = "schema_v1")]
        schema_version: u32,
        name: String,
        modifier_ids: Vec<String>,
        phase_id: String,
        #[serde(default)]
        scene_id: Option<String>,
    },
    /// A full prompt that expands to a larger instruction.
    Macro {
        #[serde(default = "schema_v1")]
        schema_version: u32,
        name: String,
        content: String,
        phase_id: String,
        #[serde(default)]
        scene_id: Option<String>,
    },
    /// A human-AI alignment phrase. `phase_id` is required — an alignment phrase
    /// must bind to a protocol phase (constitution B2).
    AlignmentPhrase {
        #[serde(default = "schema_v1")]
        schema_version: u32,
        name: String,
        content: String,
        phase_id: String,
        #[serde(default)]
        is_default: bool,
    },
}

impl From<PayloadArg> for DraftPayload {
    fn from(arg: PayloadArg) -> Self {
        match arg {
            PayloadArg::Modifier {
                schema_version,
                name,
                content,
                phase_id,
                scene_id,
            } => DraftPayload::Modifier {
                schema_version,
                name,
                content,
                phase_id,
                scene_id,
            },
            PayloadArg::Composition {
                schema_version,
                name,
                modifier_ids,
                phase_id,
                scene_id,
            } => DraftPayload::Composition {
                schema_version,
                name,
                modifier_ids,
                phase_id,
                scene_id,
            },
            PayloadArg::Macro {
                schema_version,
                name,
                content,
                phase_id,
                scene_id,
            } => DraftPayload::Macro {
                schema_version,
                name,
                content,
                phase_id,
                scene_id,
            },
            PayloadArg::AlignmentPhrase {
                schema_version,
                name,
                content,
                phase_id,
                is_default,
            } => DraftPayload::AlignmentPhrase {
                schema_version,
                name,
                content,
                phase_id,
                is_default,
            },
        }
    }
}

/// Where a draft came from, as supplied by the model. `tool_name` is NOT taken
/// from the model — the server stamps it with the actual tool that ran so the
/// audit trail can't be spoofed.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
#[schemars(crate = "rmcp::schemars")]
pub struct ProvenanceArg {
    /// The app the draft originated in. Defaults to "Claude Code".
    #[serde(default = "default_source_app")]
    pub source_app: String,
    /// An opaque conversation id/hash so the user can trace the draft back.
    #[serde(default)]
    pub conversation_ref: Option<String>,
    /// The model that produced the draft, e.g. "claude-opus-4-7".
    #[serde(default)]
    pub model_hint: Option<String>,
    /// Optional 0..1 confidence the model assigns to this draft.
    #[serde(default)]
    pub confidence: Option<f32>,
}

impl ProvenanceArg {
    /// Stamp the server-controlled `tool_name` and fill defaults to produce the
    /// domain `Provenance`.
    pub fn into_provenance(self, tool_name: &str) -> Provenance {
        Provenance {
            source_app: if self.source_app.is_empty() {
                default_source_app()
            } else {
                self.source_app
            },
            conversation_ref: self
                .conversation_ref
                .unwrap_or_else(|| "unknown".to_string()),
            tool_name: tool_name.to_string(),
            model_hint: self.model_hint,
            confidence: self.confidence,
        }
    }
}

/// Split a markdown document into `(heading, body)` sections at each level-1/2
/// heading (`# ` or `## `). Text before the first heading is ignored. Used by
/// `bootstrap_from_markdown` to turn a doc into one draft per section.
pub fn split_markdown_sections(md: &str) -> Vec<(String, String)> {
    let mut sections: Vec<(String, String)> = Vec::new();
    let mut current: Option<(String, Vec<&str>)> = None;

    for line in md.lines() {
        let heading = line.strip_prefix("## ").or_else(|| line.strip_prefix("# "));
        match heading {
            Some(title) => {
                if let Some((name, body)) = current.take() {
                    sections.push((name, body.join("\n").trim().to_string()));
                }
                current = Some((title.trim().to_string(), Vec::new()));
            }
            None => {
                if let Some((_, body)) = current.as_mut() {
                    body.push(line);
                }
            }
        }
    }
    if let Some((name, body)) = current.take() {
        sections.push((name, body.join("\n").trim().to_string()));
    }
    sections
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payload_arg_defaults_schema_version_to_one() {
        let json = r#"{"target_type":"macro","name":"X","content":"do it","phase_id":"p1"}"#;
        let arg: PayloadArg = serde_json::from_str(json).expect("parse");
        let payload: DraftPayload = arg.into();
        assert_eq!(payload.schema_version(), 1);
    }

    #[test]
    fn provenance_arg_stamps_tool_name_over_model_input() {
        let arg = ProvenanceArg {
            conversation_ref: Some("conv-9".to_string()),
            ..Default::default()
        };
        let prov = arg.into_provenance("create_draft");
        assert_eq!(prov.tool_name, "create_draft");
        assert_eq!(prov.source_app, "Claude Code");
        assert_eq!(prov.conversation_ref, "conv-9");
    }

    #[test]
    fn split_markdown_sections_splits_on_headings() {
        let md = "intro ignored\n# First\nbody one\n## Second\nbody two\nmore";
        let secs = split_markdown_sections(md);
        assert_eq!(secs.len(), 2);
        assert_eq!(secs[0], ("First".to_string(), "body one".to_string()));
        assert_eq!(
            secs[1],
            ("Second".to_string(), "body two\nmore".to_string())
        );
    }

    #[test]
    fn split_markdown_no_headings_yields_nothing() {
        assert!(split_markdown_sections("just text\nno heading").is_empty());
    }
}
