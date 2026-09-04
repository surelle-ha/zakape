#![recursion_limit = "256"]

use reqwest::{Client, StatusCode, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    fs,
    io::Cursor,
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::{AppHandle, Manager};

#[cfg(all(feature = "google-auth", desktop))]
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
#[cfg(all(feature = "google-auth", desktop))]
use sha2::{Digest, Sha256};
const OLLAMA_CONNECT_TIMEOUT: Duration = Duration::from_secs(4);
const OLLAMA_DISCOVERY_TIMEOUT: Duration = Duration::from_secs(12);
const OLLAMA_CHAT_TIMEOUT: Duration = Duration::from_secs(180);
const MAX_PROJECT_BYTES: usize = 32 * 1024 * 1024;
const MAX_IMPORTED_PIXELS: usize = 1_048_576;
#[cfg(all(feature = "google-auth", desktop))]
const GOOGLE_SCOPES: [&str; 3] = ["openid", "email", "profile"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GoogleAuthConfiguration {
    available: bool,
    feature_enabled: bool,
    platform: &'static str,
    client_configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoogleAccount {
    id: String,
    email: String,
    name: String,
    picture: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GoogleAuthSession {
    access_token: String,
    expires_at: i64,
    account: GoogleAccount,
}

#[cfg(feature = "google-auth")]
#[derive(Debug, Deserialize)]
struct GoogleUserInfo {
    sub: String,
    email: String,
    name: Option<String>,
    picture: Option<String>,
}

#[cfg(all(feature = "google-auth", desktop))]
#[derive(Debug, Deserialize)]
struct GoogleTokenResponse {
    access_token: String,
    expires_in: i64,
    refresh_token: Option<String>,
}

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportedSprite {
    source_hash: String,
    name: String,
    width: usize,
    height: usize,
    color_mode: String,
    palette: Vec<String>,
    frames: Vec<ImportedFrame>,
    layers: Vec<ImportedLayer>,
}

#[derive(Debug, Serialize)]
struct ImportedFrame {
    id: String,
    name: String,
    duration: u32,
}

#[derive(Debug, Serialize)]
struct ImportedLayer {
    id: String,
    name: String,
    visible: bool,
    opacity: f32,
    cels: BTreeMap<String, Vec<Option<String>>>,
}

fn source_hash(bytes: &[u8]) -> String {
    let hash = bytes.iter().fold(0xcbf29ce484222325_u64, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    });
    format!("{hash:016x}")
}

fn imported_name(file_name: &str) -> String {
    let name = Path::new(file_name)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("Imported sprite")
        .trim()
        .chars()
        .take(64)
        .collect::<String>();
    if name.is_empty() {
        "Imported sprite".to_string()
    } else {
        name
    }
}

fn encode_rgba_image(image: &image::RgbaImage) -> Vec<Option<String>> {
    image
        .pixels()
        .map(|pixel| {
            let [red, green, blue, alpha] = pixel.0;
            (alpha > 0).then(|| format!("#{red:02x}{green:02x}{blue:02x}"))
        })
        .collect()
}

fn parse_imported_sprite(bytes: &[u8], file_name: &str) -> Result<ImportedSprite, String> {
    if bytes.len() < 128 || bytes.len() > MAX_PROJECT_BYTES {
        return Err("That sprite file is empty, incomplete, or exceeds 32 MB.".to_string());
    }
    let magic = u16::from_le_bytes([bytes[4], bytes[5]]);
    let header_frames = usize::from(u16::from_le_bytes([bytes[6], bytes[7]]));
    let header_width = usize::from(u16::from_le_bytes([bytes[8], bytes[9]]));
    let header_height = usize::from(u16::from_le_bytes([bytes[10], bytes[11]]));
    if magic != 0xA5E0
        || header_frames == 0
        || header_frames > 512
        || header_width == 0
        || header_height == 0
        || header_width > 1024
        || header_height > 1024
        || header_width.saturating_mul(header_height) > MAX_IMPORTED_PIXELS
    {
        return Err(
            "This sprite file has unsupported dimensions, frames, or header data.".to_string(),
        );
    }

    let parsed = ah_asefile::AsepriteFile::read(Cursor::new(bytes))
        .map_err(|error| format!("Zakape could not decode this sprite file: {error}"))?;
    if parsed.num_frames() == 0 || parsed.num_frames() > 512 || parsed.num_layers() > 256 {
        return Err("This sprite file exceeds Zakape's frame or layer limits.".to_string());
    }

    let frames: Vec<ImportedFrame> = (0..parsed.num_frames())
        .map(|index| ImportedFrame {
            id: format!("frame_import_{}", index + 1),
            name: format!("F{}", index + 1),
            duration: parsed.frame(index).duration().clamp(1, 60_000),
        })
        .collect();

    let mut layers = Vec::new();
    for source_layer in parsed.layers() {
        if matches!(source_layer.layer_type(), ah_asefile::LayerType::Group) {
            continue;
        }
        let mut cels = BTreeMap::new();
        for (frame_index, frame) in frames.iter().enumerate() {
            let image = source_layer.frame(frame_index as u32).image();
            cels.insert(frame.id.clone(), encode_rgba_image(&image));
        }
        let layer_name = source_layer
            .name()
            .trim()
            .chars()
            .take(64)
            .collect::<String>();
        layers.push(ImportedLayer {
            id: format!("layer_import_{}", source_layer.id() + 1),
            name: if layer_name.is_empty() {
                format!("Imported layer {}", layers.len() + 1)
            } else {
                layer_name
            },
            visible: source_layer.is_visible(),
            opacity: f32::from(source_layer.opacity()) / 255.0,
            cels,
        });
    }

    if layers.is_empty() {
        let cels = frames
            .iter()
            .enumerate()
            .map(|(index, frame)| {
                let image = parsed.frame(index as u32).image();
                (frame.id.clone(), encode_rgba_image(&image))
            })
            .collect();
        layers.push(ImportedLayer {
            id: "layer_import_flattened".to_string(),
            name: "Imported artwork".to_string(),
            visible: true,
            opacity: 1.0,
            cels,
        });
    }

    let mut palette = Vec::new();
    if let Some(source_palette) = parsed.palette() {
        for index in 0..256 {
            let Some(entry) = source_palette.color(index) else {
                continue;
            };
            let [red, green, blue, alpha] = entry.raw_rgba8();
            if alpha > 0 {
                let color = format!("#{red:02x}{green:02x}{blue:02x}");
                if !palette.contains(&color) {
                    palette.push(color);
                }
            }
        }
    }
    for color in layers
        .iter()
        .flat_map(|layer| layer.cels.values())
        .flatten()
        .flatten()
    {
        if palette.len() >= 256 {
            break;
        }
        if !palette.contains(color) {
            palette.push(color.clone());
        }
    }
    if palette.is_empty() {
        palette.push("#000000".to_string());
        palette.push("#ffffff".to_string());
    }

    let color_mode = match parsed.pixel_format() {
        ah_asefile::PixelFormat::Rgba => "rgba",
        ah_asefile::PixelFormat::Grayscale => "grayscale",
        ah_asefile::PixelFormat::Indexed { .. } => "indexed",
    };

    Ok(ImportedSprite {
        source_hash: source_hash(bytes),
        name: imported_name(file_name),
        width: parsed.width(),
        height: parsed.height(),
        color_mode: color_mode.to_string(),
        palette,
        frames,
        layers,
    })
}

#[tauri::command]
fn import_aseprite_project(bytes: Vec<u8>, file_name: String) -> Result<ImportedSprite, String> {
    parse_imported_sprite(&bytes, &file_name)
}

fn workspace_directory_path(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(desktop)]
    let directory = app
        .path()
        .document_dir()
        .map_err(|_| "Zakape could not find the Documents directory.".to_string())?
        .join("zakape");
    #[cfg(mobile)]
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|_| "Zakape could not find its private application storage.".to_string())?
        .join("zakape");
    fs::create_dir_all(&directory)
        .map_err(|_| "Zakape could not create its project workspace.".to_string())?;
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
        .map_err(|_| "Zakape could not read that project from its workspace.".to_string())?;
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
        .map_err(|_| "Zakape could not save the project in its workspace.".to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

fn configured_google_value(value: Option<&'static str>) -> Option<&'static str> {
    value.filter(|candidate| !candidate.trim().is_empty())
}

fn google_client_id() -> Option<&'static str> {
    #[cfg(desktop)]
    let value = option_env!("ZAKAPE_GOOGLE_DESKTOP_CLIENT_ID");
    #[cfg(mobile)]
    let value = None;
    configured_google_value(value)
}

#[cfg(desktop)]
fn google_client_secret() -> Option<&'static str> {
    configured_google_value(option_env!("ZAKAPE_GOOGLE_DESKTOP_CLIENT_SECRET"))
}

fn google_platform() -> &'static str {
    #[cfg(target_os = "android")]
    return "android";
    #[cfg(target_os = "ios")]
    return "ios";
    #[cfg(desktop)]
    return "desktop";
}

#[tauri::command]
fn google_auth_configuration() -> GoogleAuthConfiguration {
    let client_configured = google_client_id().is_some();
    #[cfg(desktop)]
    let credentials_configured = client_configured && google_client_secret().is_some();
    #[cfg(mobile)]
    let credentials_configured = client_configured;
    let feature_enabled = cfg!(feature = "google-auth");
    GoogleAuthConfiguration {
        available: feature_enabled && credentials_configured,
        feature_enabled,
        platform: google_platform(),
        client_configured: credentials_configured,
    }
}

#[cfg(all(feature = "google-auth", desktop))]
async fn google_account(access_token: &str) -> Result<GoogleAccount, String> {
    let response = Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Zakape could not initialize Google account access.".to_string())?
        .get("https://openidconnect.googleapis.com/v1/userinfo")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|_| "Zakape could not reach Google account services.".to_string())?;
    if !response.status().is_success() {
        return Err("Google did not accept the account session.".to_string());
    }
    let profile = response
        .json::<GoogleUserInfo>()
        .await
        .map_err(|_| "Google returned an unreadable account profile.".to_string())?;
    Ok(GoogleAccount {
        id: profile.sub,
        name: profile.name.unwrap_or_else(|| profile.email.clone()),
        email: profile.email,
        picture: profile.picture,
    })
}

#[cfg(all(feature = "google-auth", desktop))]
async fn google_session(
    access_token: String,
    expires_at: Option<i64>,
) -> Result<GoogleAuthSession, String> {
    let account = google_account(&access_token).await?;
    let now = unix_timestamp();
    let expires_at = expires_at
        .filter(|candidate| *candidate > now.saturating_add(60))
        .unwrap_or_else(|| now.saturating_add(3_300));
    Ok(GoogleAuthSession {
        access_token,
        expires_at,
        account,
    })
}

#[cfg(all(feature = "google-auth", desktop))]
fn unix_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| {
            i64::try_from(duration.as_secs()).unwrap_or(i64::MAX)
        })
}

#[cfg(all(feature = "google-auth", desktop))]
fn google_credential() -> Result<keyring::Entry, String> {
    keyring::Entry::new("io.github.surelleha.zakape", "google-account-refresh")
        .map_err(|_| "Zakape could not open the system credential vault.".to_string())
}

#[cfg(all(feature = "google-auth", desktop))]
fn random_url_token(byte_count: usize) -> Result<String, String> {
    let mut bytes = vec![0_u8; byte_count];
    getrandom::fill(&mut bytes)
        .map_err(|_| "Zakape could not create a secure sign-in challenge.".to_string())?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}

#[cfg(all(feature = "google-auth", desktop))]
fn receive_google_callback(
    listener: std::net::TcpListener,
    expected_state: String,
) -> Result<String, String> {
    use std::io::{ErrorKind, Read, Write};
    use std::time::Instant;

    listener
        .set_nonblocking(true)
        .map_err(|_| "Zakape could not prepare the local sign-in callback.".to_string())?;
    let deadline = Instant::now() + Duration::from_secs(300);
    let (mut stream, _) = loop {
        match listener.accept() {
            Ok(connection) => break connection,
            Err(error) if error.kind() == ErrorKind::WouldBlock && Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(error) if error.kind() == ErrorKind::WouldBlock => {
                return Err(
                    "Google sign-in timed out. Start it again when you are ready.".to_string(),
                );
            }
            Err(_) => return Err("Zakape could not receive the Google sign-in result.".to_string()),
        }
    };

    let mut buffer = [0_u8; 16_384];
    let bytes_read = stream
        .read(&mut buffer)
        .map_err(|_| "Zakape could not read the Google sign-in result.".to_string())?;
    let request = std::str::from_utf8(&buffer[..bytes_read])
        .map_err(|_| "Google returned an unreadable sign-in result.".to_string())?;
    let request_path = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .ok_or_else(|| "Google returned an incomplete sign-in result.".to_string())?;
    let callback = Url::parse(&format!("http://127.0.0.1{request_path}"))
        .map_err(|_| "Google returned an invalid sign-in callback.".to_string())?;
    let parameter = |name: &str| {
        callback
            .query_pairs()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.into_owned())
    };
    let state = parameter("state")
        .ok_or_else(|| "Google sign-in did not include its security state.".to_string())?;
    if state != expected_state {
        return Err("Zakape rejected a mismatched Google sign-in response.".to_string());
    }
    if let Some(error) = parameter("error") {
        return Err(if error == "access_denied" {
            "Google sign-in was cancelled.".to_string()
        } else {
            "Google could not complete sign-in.".to_string()
        });
    }
    let code = parameter("code")
        .ok_or_else(|| "Google sign-in did not return an authorization code.".to_string())?;
    let body = "<!doctype html><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Zakape connected</title><style>body{margin:0;display:grid;min-height:100vh;place-items:center;color:#f4f2f7;background:#090b0f;font:16px system-ui}main{max-width:28rem;padding:2rem;border:1px solid #8b5cf6;border-radius:.6rem;background:#11151b}strong{display:block;margin-bottom:.5rem;color:#c4b5fd}</style><main><strong>Google account connected.</strong>You can close this tab and return to Zakape.</main>";
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    Ok(code)
}

#[cfg(all(feature = "google-auth", desktop))]
async fn desktop_google_sign_in() -> Result<GoogleAuthSession, String> {
    let client_id = google_client_id()
        .ok_or_else(|| "Google sign-in is not configured in this build.".to_string())?;
    let client_secret = google_client_secret()
        .ok_or_else(|| "Google sign-in is not configured in this build.".to_string())?;
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|_| "Zakape could not start the local sign-in callback.".to_string())?;
    let port = listener
        .local_addr()
        .map_err(|_| "Zakape could not read the local sign-in callback.".to_string())?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}");
    let verifier = random_url_token(64)?;
    let state = random_url_token(32)?;
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let mut authorization_url = Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .map_err(|_| "Zakape could not prepare Google sign-in.".to_string())?;
    {
        let mut query = authorization_url.query_pairs_mut();
        query
            .append_pair("client_id", client_id)
            .append_pair("redirect_uri", &redirect_uri)
            .append_pair("response_type", "code")
            .append_pair("scope", &GOOGLE_SCOPES.join(" "))
            .append_pair("state", &state)
            .append_pair("code_challenge", &challenge)
            .append_pair("code_challenge_method", "S256")
            .append_pair("access_type", "offline")
            .append_pair("include_granted_scopes", "true")
            .append_pair("prompt", "consent");
    }
    open::that_detached(authorization_url.as_str())
        .map_err(|_| "Zakape could not open the system browser for Google sign-in.".to_string())?;
    let callback_state = state.clone();
    let code = tauri::async_runtime::spawn_blocking(move || {
        receive_google_callback(listener, callback_state)
    })
    .await
    .map_err(|_| "Zakape could not complete the local sign-in callback.".to_string())??;

    let response = Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Zakape could not initialize Google sign-in.".to_string())?
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code.as_str()),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
            ("code_verifier", verifier.as_str()),
        ])
        .send()
        .await
        .map_err(|_| "Zakape could not exchange the Google sign-in code.".to_string())?;
    if !response.status().is_success() {
        return Err(
            "Google rejected the sign-in code. Check the desktop OAuth credentials.".to_string(),
        );
    }
    let tokens = response
        .json::<GoogleTokenResponse>()
        .await
        .map_err(|_| "Google returned unreadable sign-in tokens.".to_string())?;
    if let Some(refresh_token) = tokens.refresh_token.as_deref() {
        google_credential()?
            .set_password(refresh_token)
            .map_err(|_| "Zakape could not protect the Google refresh token.".to_string())?;
    }
    google_session(
        tokens.access_token,
        Some(unix_timestamp().saturating_add(tokens.expires_in)),
    )
    .await
}

#[cfg(all(feature = "google-auth", desktop))]
async fn desktop_google_refresh() -> Result<GoogleAuthSession, String> {
    let client_id = google_client_id()
        .ok_or_else(|| "Google sign-in is not configured in this build.".to_string())?;
    let client_secret = google_client_secret()
        .ok_or_else(|| "Google sign-in is not configured in this build.".to_string())?;
    let refresh_token = google_credential()?
        .get_password()
        .map_err(|_| "No protected Google session is available.".to_string())?;
    let response = Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Zakape could not initialize Google session restore.".to_string())?
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("refresh_token", refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|_| "Zakape could not refresh the Google session.".to_string())?;
    if !response.status().is_success() {
        return Err("The saved Google session has expired. Sign in again.".to_string());
    }
    let tokens = response
        .json::<GoogleTokenResponse>()
        .await
        .map_err(|_| "Google returned an unreadable refreshed session.".to_string())?;
    google_session(
        tokens.access_token,
        Some(unix_timestamp().saturating_add(tokens.expires_in)),
    )
    .await
}

#[tauri::command]
async fn google_auth_sign_in(app: AppHandle) -> Result<GoogleAuthSession, String> {
    #[cfg(not(feature = "google-auth"))]
    {
        let _ = app;
        Err(
            "Google sign-in is not included in this build. Guest access remains available."
                .to_string(),
        )
    }
    #[cfg(all(feature = "google-auth", desktop))]
    {
        let _ = app;
        desktop_google_sign_in().await
    }
    #[cfg(all(feature = "google-auth", mobile))]
    {
        let _ = app;
        Err("Google sign-in is currently available on desktop only.".to_string())
    }
}

#[tauri::command]
async fn google_auth_refresh(app: AppHandle) -> Result<GoogleAuthSession, String> {
    #[cfg(not(feature = "google-auth"))]
    {
        let _ = app;
        Err("Google sign-in is not included in this build.".to_string())
    }
    #[cfg(all(feature = "google-auth", desktop))]
    {
        let _ = app;
        desktop_google_refresh().await
    }
    #[cfg(all(feature = "google-auth", mobile))]
    {
        let _ = app;
        Err("Google sign-in is currently available on desktop only.".to_string())
    }
}

#[tauri::command]
async fn google_auth_sign_out(app: AppHandle, access_token: Option<String>) -> Result<(), String> {
    #[cfg(not(feature = "google-auth"))]
    {
        let _ = (app, access_token);
        Ok(())
    }
    #[cfg(all(feature = "google-auth", desktop))]
    {
        let _ = app;
        if let Some(token) = access_token {
            let _ = Client::new()
                .post("https://oauth2.googleapis.com/revoke")
                .form(&[("token", token)])
                .send()
                .await;
        }
        if let Ok(entry) = google_credential() {
            let _ = entry.delete_credential();
        }
        Ok(())
    }
    #[cfg(all(feature = "google-auth", mobile))]
    {
        let _ = (app, access_token);
        Ok(())
    }
}

fn assistant_response_format() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["summary", "actions", "edits", "review_notes", "ready"],
        "properties": {
            "summary": { "type": "string" },
            "actions": {
                "type": "array",
                "items": {
                    "oneOf": [
                        {
                            "type": "object",
                            "additionalProperties": false,
                            "required": ["type", "layer_id", "name"],
                            "properties": {
                                "type": { "const": "create_layer" },
                                "layer_id": { "type": "string" },
                                "name": { "type": "string" }
                            }
                        },
                        {
                            "type": "object",
                            "additionalProperties": false,
                            "required": ["type", "frame_id", "name", "duration_ms", "after_frame_id", "copy_from_frame_id"],
                            "properties": {
                                "type": { "const": "create_frame" },
                                "frame_id": { "type": "string" },
                                "name": { "type": "string" },
                                "duration_ms": { "type": "integer", "minimum": 40, "maximum": 10000 },
                                "after_frame_id": { "type": ["string", "null"] },
                                "copy_from_frame_id": { "type": ["string", "null"] }
                            }
                        }
                    ]
                }
            },
            "edits": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["layer_id", "frame_id", "operations"],
                    "properties": {
                        "layer_id": { "type": "string" },
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
            },
            "review_notes": { "type": "array", "items": { "type": "string" } },
            "ready": { "type": "boolean" }
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
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }));
    let builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build());
    builder
        .invoke_handler(tauri::generate_handler![
            ollama_list_models,
            ollama_chat,
            workspace_directory,
            workspace_list_projects,
            workspace_read_project,
            workspace_write_project,
            google_auth_configuration,
            google_auth_sign_in,
            google_auth_refresh,
            google_auth_sign_out,
            import_aseprite_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running Zakape");
}

#[cfg(test)]
mod tests {
    use super::{checked_project_id, imported_name, ollama_endpoint, parse_imported_sprite};

    fn minimal_sprite_bytes() -> Vec<u8> {
        let mut bytes = vec![0_u8; 144];
        bytes[0..4].copy_from_slice(&144_u32.to_le_bytes());
        bytes[4..6].copy_from_slice(&0xA5E0_u16.to_le_bytes());
        bytes[6..8].copy_from_slice(&1_u16.to_le_bytes());
        bytes[8..10].copy_from_slice(&1_u16.to_le_bytes());
        bytes[10..12].copy_from_slice(&1_u16.to_le_bytes());
        bytes[12..14].copy_from_slice(&32_u16.to_le_bytes());
        bytes[14..18].copy_from_slice(&1_u32.to_le_bytes());
        bytes[18..20].copy_from_slice(&100_u16.to_le_bytes());
        bytes[34] = 1;
        bytes[35] = 1;
        bytes[40..42].copy_from_slice(&1_u16.to_le_bytes());
        bytes[42..44].copy_from_slice(&1_u16.to_le_bytes());
        bytes[128..132].copy_from_slice(&16_u32.to_le_bytes());
        bytes[132..134].copy_from_slice(&0xF1FA_u16.to_le_bytes());
        bytes[136..138].copy_from_slice(&100_u16.to_le_bytes());
        bytes
    }

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

    #[test]
    fn decodes_a_minimal_sprite_file_into_a_safe_project_payload() {
        let imported = parse_imported_sprite(&minimal_sprite_bytes(), "hero.ase").unwrap();

        assert_eq!(imported.name, "hero");
        assert_eq!(imported.width, 1);
        assert_eq!(imported.height, 1);
        assert_eq!(imported.frames.len(), 1);
        assert_eq!(imported.layers.len(), 1);
        assert_eq!(imported.layers[0].cels["frame_import_1"], vec![None]);
    }

    #[test]
    fn gives_blank_import_names_a_useful_fallback() {
        assert_eq!(imported_name("   .ase"), "Imported sprite");
    }
}
