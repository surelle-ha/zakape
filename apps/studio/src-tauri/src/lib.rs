use reqwest::{Client, StatusCode, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, path::PathBuf, time::Duration};
use tauri::{AppHandle, Manager};

const OLLAMA_CONNECT_TIMEOUT: Duration = Duration::from_secs(4);
const OLLAMA_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(12);
const OLLAMA_CHAT_TIMEOUT: Duration = Duration::from_secs(180);
const MAX_PROJECT_BYTES: usize = 32 * 1024 * 1024;

#[derive(Debug, Serialize, Deserialize)]
struct AssistantMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OllamaModel {
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    modified_at: Option<String>,
}

#[derive(Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaTag>,
}

#[derive(Deserialize)]
struct OllamaTag {
    name: String,
    size: Option<u64>,
    modified_at: Option<String>,
}

#[derive(Serialize)]
struct OllamaChatRequest<'a> {
    model: &'a str,
    messages: &'a [AssistantMessage],
    stream: bool,
    format: Value,
    options: OllamaOptions,
}

#[derive(Serialize)]
struct OllamaOptions {
    temperature: f32,
    top_p: f32,
    num_ctx: u32,
}

#[derive(Deserialize)]
struct OllamaChatResponse {
    message: OllamaChatMessage,
}

#[derive(Deserialize)]
struct OllamaChatMessage {
    content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceProject {
    id: String,
    name: String,
    width: u64,
    height: u64,
    frame_count: usize,
    updated_at: String,
}

fn workspace_directory_path(app: &AppHandle) -> Result<PathBuf, String> {
    let documents = app
        .path()
        .document_dir()
        .map_err(|_| "Zakape could not find the Documents directory.".to_string())?;
    let directory = documents.join("zakape");
    fs::create_dir_all(&directory)
        .map_err(|_| "Zakape could not create Documents/zakape.".to_string())?;
    Ok(directory)
}

fn checked_project_id(project_id: &str) -> Result<&str, String> {
    let project_id = project_id.trim();
    if project_id.is_empty()
        || project_id.len() > 128
        || !project_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err("The project ID cannot be used as a Zakape filename.".to_string());
    }
    Ok(project_id)
}

fn project_file_path(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    Ok(workspace_directory_path(app)?.join(format!("{}.zakape", checked_project_id(project_id)?)))
}

#[tauri::command]
fn workspace_directory(app: AppHandle) -> Result<String, String> {
    Ok(workspace_directory_path(&app)?
        .to_string_lossy()
        .into_owned())
}

#[tauri::command]
fn workspace_list_projects(app: AppHandle) -> Result<Vec<WorkspaceProject>, String> {
    let directory = workspace_directory_path(&app)?;
    let entries = fs::read_dir(directory)
        .map_err(|_| "Zakape could not read the project working directory.".to_string())?;
    let mut projects = Vec::new();

    for entry in entries.flatten().take(500) {
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("zakape") {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if !metadata.is_file() || metadata.len() > MAX_PROJECT_BYTES as u64 {
            continue;
        }
        let Ok(contents) = fs::read_to_string(path) else {
            continue;
        };
        if contents.len() > MAX_PROJECT_BYTES {
            continue;
        }
        let Ok(project) = serde_json::from_str::<Value>(&contents) else {
            continue;
        };
        let Some(id) = project.get("id").and_then(Value::as_str) else {
            continue;
        };
        if checked_project_id(id).is_err() {
            continue;
        }
        if entry.path().file_stem().and_then(|stem| stem.to_str()) != Some(id) {
            continue;
        }
        projects.push(WorkspaceProject {
            id: id.to_string(),
            name: project
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("Untitled sprite")
                .to_string(),
            width: project.get("width").and_then(Value::as_u64).unwrap_or(0),
            height: project.get("height").and_then(Value::as_u64).unwrap_or(0),
            frame_count: project
                .get("frames")
                .and_then(Value::as_array)
                .map(Vec::len)
                .unwrap_or(0),
            updated_at: project
                .get("updatedAt")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
        });
    }

    projects.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(projects)
}

#[tauri::command]
fn workspace_read_project(app: AppHandle, project_id: String) -> Result<String, String> {
    let path = project_file_path(&app, &project_id)?;
    let contents = fs::read_to_string(path)
        .map_err(|_| "Zakape could not read that project from Documents/zakape.".to_string())?;
    if contents.len() > MAX_PROJECT_BYTES {
        return Err("That project exceeds Zakape's 32 MB project limit.".to_string());
    }
    Ok(contents)
}

#[tauri::command]
fn workspace_write_project(
    app: AppHandle,
    project_id: String,
    contents: String,
) -> Result<String, String> {
    if contents.len() > MAX_PROJECT_BYTES {
        return Err("That project exceeds Zakape's 32 MB project limit.".to_string());
    }
    let project: Value = serde_json::from_str(&contents)
        .map_err(|_| "Zakape refused to save invalid project JSON.".to_string())?;
    let parsed_id = project
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "The project is missing its ID.".to_string())?;
    if parsed_id != checked_project_id(&project_id)? || project.get("version") != Some(&json!(1)) {
        return Err("The project identity or version is invalid.".to_string());
    }

    let path = project_file_path(&app, &project_id)?;
    fs::write(&path, contents)
        .map_err(|_| "Zakape could not save the project in Documents/zakape.".to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

fn assistant_response_format() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["summary", "frames"],
        "properties": {
            "summary": { "type": "string" },
            "frames": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["frame_id", "operations"],
                    "properties": {
                        "frame_id": { "type": "string" },
                        "operations": {
                            "type": "array",
                            "items": {
                                "oneOf": [
                                    {
                                        "type": "object",
                                        "additionalProperties": false,
                                        "required": ["type", "pixels"],
                                        "properties": {
                                            "type": { "const": "set_pixels" },
                                            "pixels": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "additionalProperties": false,
                                                    "required": ["x", "y", "color"],
                                                    "properties": {
                                                        "x": { "type": "integer", "minimum": 0 },
                                                        "y": { "type": "integer", "minimum": 0 },
                                                        "color": { "type": ["string", "null"] }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    {
                                        "type": "object",
                                        "additionalProperties": false,
                                        "required": ["type", "x", "y", "width", "height", "color"],
                                        "properties": {
                                            "type": { "enum": ["fill_rect", "outline_rect"] },
                                            "x": { "type": "integer", "minimum": 0 },
                                            "y": { "type": "integer", "minimum": 0 },
                                            "width": { "type": "integer", "minimum": 1 },
                                            "height": { "type": "integer", "minimum": 1 },
                                            "color": { "type": ["string", "null"] }
                                        }
                                    },
                                    {
                                        "type": "object",
                                        "additionalProperties": false,
                                        "required": ["type", "from", "to"],
                                        "properties": {
                                            "type": { "const": "replace_palette_color" },
                                            "from": { "type": "string" },
                                            "to": { "type": ["string", "null"] }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        }
    })
}

fn ollama_endpoint(base_url: &str, path: &str) -> Result<Url, String> {
    let mut base = Url::parse(base_url.trim())
        .map_err(|_| "Enter a valid Ollama address, such as http://127.0.0.1:11434.".to_string())?;
    let host = base.host_str().unwrap_or_default().to_ascii_lowercase();
    let is_loopback = matches!(host.as_str(), "127.0.0.1" | "localhost" | "::1" | "[::1]");
    let is_root = matches!(base.path(), "" | "/");
    if !is_loopback
        || !matches!(base.scheme(), "http" | "https")
        || !base.username().is_empty()
        || base.password().is_some()
        || !is_root
        || base.query().is_some()
        || base.fragment().is_some()
    {
        return Err(
            "Ollama must use a loopback address: 127.0.0.1, localhost, or [::1].".to_string(),
        );
    }
    base.set_path("/");
    base.join(path)
        .map_err(|_| "Zakape could not build the local Ollama address.".to_string())
}

fn ollama_client() -> Result<Client, String> {
    Client::builder()
        .connect_timeout(OLLAMA_CONNECT_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .no_proxy()
        .build()
        .map_err(|_| "Zakape could not prepare the Ollama connection.".to_string())
}

fn request_error(error: reqwest::Error, base_url: &str) -> String {
    if error.is_timeout() {
        return "Ollama did not respond in time. Check that it is running, then try again."
            .to_string();
    }
    if error.is_connect() {
        return format!("Ollama is not running at {base_url}. Start Ollama, then try again.");
    }
    format!("Ollama request failed: {error}")
}

fn short_response(value: &str) -> String {
    value.chars().take(180).collect()
}

async fn response_error(response: reqwest::Response, model: Option<&str>) -> String {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if status == StatusCode::NOT_FOUND && body.to_ascii_lowercase().contains("model") {
        return format!(
            "{} is not installed. Pull it in Ollama, then refresh the model list.",
            model.unwrap_or("That model")
        );
    }
    format!("Ollama returned {status}: {}", short_response(&body))
}

#[tauri::command]
async fn ollama_list_models(base_url: String) -> Result<Vec<OllamaModel>, String> {
    let endpoint = ollama_endpoint(&base_url, "api/tags")?;
    let response = ollama_client()?
        .get(endpoint)
        .timeout(OLLAMA_DISCOVERY_TIMEOUT)
        .send()
        .await
        .map_err(|error| request_error(error, &base_url))?;
    if !response.status().is_success() {
        return Err(response_error(response, None).await);
    }
    let payload = response
        .json::<OllamaTagsResponse>()
        .await
        .map_err(|_| "Ollama returned an invalid model list.".to_string())?;
    let mut models: Vec<OllamaModel> = payload
        .models
        .into_iter()
        .map(|model| OllamaModel {
            id: model.name,
            size: model.size,
            modified_at: model.modified_at,
        })
        .collect();
    models.sort_by(|left, right| left.id.cmp(&right.id));
    Ok(models)
}

#[tauri::command]
async fn ollama_chat(
    base_url: String,
    model: String,
    messages: Vec<AssistantMessage>,
) -> Result<String, String> {
    let endpoint = ollama_endpoint(&base_url, "api/chat")?;
    let model = model.trim();
    if model.is_empty() || model.len() > 200 {
        return Err("Choose an installed Ollama model before requesting an edit.".to_string());
    }
    if messages.is_empty()
        || messages.len() > 4
        || messages
            .iter()
            .any(|message| !matches!(message.role.as_str(), "system" | "user"))
        || messages
            .iter()
            .map(|message| message.content.len())
            .sum::<usize>()
            > 2_000_000
    {
        return Err("The assistant request is outside Zakape's safety limits.".to_string());
    }

    let request = OllamaChatRequest {
        model,
        messages: &messages,
        stream: false,
        format: assistant_response_format(),
        options: OllamaOptions {
            temperature: 0.1,
            top_p: 0.9,
            num_ctx: 16_384,
        },
    };
    let response = ollama_client()?
        .post(endpoint)
        .timeout(OLLAMA_CHAT_TIMEOUT)
        .json(&request)
        .send()
        .await
        .map_err(|error| request_error(error, &base_url))?;
    if !response.status().is_success() {
        return Err(response_error(response, Some(model)).await);
    }
    let payload = response
        .json::<OllamaChatResponse>()
        .await
        .map_err(|_| "Ollama returned an invalid chat response.".to_string())?;
    if payload.message.content.trim().is_empty() {
        return Err("Ollama returned an empty response.".to_string());
    }
    Ok(payload.message.content)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            ollama_list_models,
            ollama_chat,
            workspace_directory,
            workspace_list_projects,
            workspace_read_project,
            workspace_write_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running Zakape");
}

#[cfg(test)]
mod tests {
    use super::{checked_project_id, ollama_endpoint};

    #[test]
    fn accepts_only_loopback_ollama_addresses() {
        assert!(ollama_endpoint("http://127.0.0.1:11434", "api/tags").is_ok());
        assert!(ollama_endpoint("http://localhost:11434/", "api/tags").is_ok());
        assert!(ollama_endpoint("http://[::1]:11434", "api/tags").is_ok());
        assert!(ollama_endpoint("http://192.168.1.10:11434", "api/tags").is_err());
        assert!(ollama_endpoint("https://example.com", "api/tags").is_err());
        assert!(ollama_endpoint("http://127.0.0.1:11434/v1", "api/tags").is_err());
    }

    #[test]
    fn accepts_only_safe_project_file_ids() {
        assert!(checked_project_id("project_m7r9_example").is_ok());
        assert!(checked_project_id("sprite-01").is_ok());
        assert!(checked_project_id("../outside").is_err());
        assert!(checked_project_id("folder/project").is_err());
        assert!(checked_project_id("").is_err());
    }
}
