use reqwest::{Client, StatusCode, Url};
use serde::{Deserialize, Serialize};
use std::time::Duration;

const OLLAMA_CONNECT_TIMEOUT: Duration = Duration::from_secs(4);
const OLLAMA_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(12);
const OLLAMA_CHAT_TIMEOUT: Duration = Duration::from_secs(180);

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
    format: &'static str,
    options: OllamaOptions,
}

#[derive(Serialize)]
struct OllamaOptions {
    temperature: f32,
}

#[derive(Deserialize)]
struct OllamaChatResponse {
    message: OllamaChatMessage,
}

#[derive(Deserialize)]
struct OllamaChatMessage {
    content: String,
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
        format: "json",
        options: OllamaOptions { temperature: 0.2 },
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
        .invoke_handler(tauri::generate_handler![ollama_list_models, ollama_chat])
        .run(tauri::generate_context!())
        .expect("error while running Zakape");
}

#[cfg(test)]
mod tests {
    use super::ollama_endpoint;

    #[test]
    fn accepts_only_loopback_ollama_addresses() {
        assert!(ollama_endpoint("http://127.0.0.1:11434", "api/tags").is_ok());
        assert!(ollama_endpoint("http://localhost:11434/", "api/tags").is_ok());
        assert!(ollama_endpoint("http://[::1]:11434", "api/tags").is_ok());
        assert!(ollama_endpoint("http://192.168.1.10:11434", "api/tags").is_err());
        assert!(ollama_endpoint("https://example.com", "api/tags").is_err());
        assert!(ollama_endpoint("http://127.0.0.1:11434/v1", "api/tags").is_err());
    }
}
