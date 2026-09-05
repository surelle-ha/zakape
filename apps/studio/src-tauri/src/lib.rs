#![recursion_limit = "256"]

use reqwest::{Client, StatusCode, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, HashSet, VecDeque},
    fs::{self, OpenOptions},
    io::{Cursor, Write},
    path::{Component, Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
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
const MAX_GODOT_CONFIG_BYTES: u64 = 1024 * 1024;
const MAX_GODOT_RESOURCES: usize = 5_000;
const MAX_GODOT_SCAN_DIRECTORIES: usize = 10_000;
const MAX_GODOT_IMPORT_BYTES: u64 = 32 * 1024 * 1024;
const MAX_GODOT_WRITE_BYTES: usize = 64 * 1024 * 1024;
const MAX_GODOT_TEXTURE_PIXELS: u64 = 16_777_216;
const MAX_GODOT_TEXTURE_DIMENSION: u32 = 32_768;
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GodotProject {
    root_path: String,
    name: String,
    config_version: Option<u32>,
    godot_version: Option<String>,
    compatibility: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GodotResourceEntry {
    path: String,
    name: String,
    kind: String,
    is_directory: bool,
    size: u64,
    modified_at: Option<u64>,
    importable: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GodotResourceIndex {
    entries: Vec<GodotResourceEntry>,
    truncated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GodotImportResult {
    kind: String,
    file_name: String,
    sprite: Option<ImportedSprite>,
    contents: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GodotAssetFile {
    relative_path: String,
    contents: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GodotWriteResult {
    written: Vec<String>,
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

fn quoted_project_setting(contents: &str, key: &str) -> Option<String> {
    let prefix = format!("{key}=");
    contents.lines().find_map(|line| {
        let value = line.trim().strip_prefix(&prefix)?.trim();
        serde_json::from_str::<String>(value).ok()
    })
}

fn godot_config_version(contents: &str) -> Option<u32> {
    contents.lines().find_map(|line| {
        line.trim()
            .strip_prefix("config_version=")?
            .trim()
            .parse::<u32>()
            .ok()
    })
}

fn godot_feature_version(contents: &str) -> Option<String> {
    let value = contents
        .lines()
        .find_map(|line| line.trim().strip_prefix("config/features=").map(str::trim))?;
    let start = value.find('"')? + 1;
    let end = value[start..].find('"')? + start;
    let version = value[start..end].trim();
    (!version.is_empty()).then(|| version.to_string())
}

fn canonical_godot_root(project_path: &str) -> Result<PathBuf, String> {
    let root = fs::canonicalize(project_path)
        .map_err(|_| "That Godot project folder is no longer available.".to_string())?;
    if !root.is_dir() {
        return Err("Choose a folder that contains project.godot.".to_string());
    }
    let marker = root.join("project.godot");
    let metadata = fs::symlink_metadata(&marker)
        .map_err(|_| "Choose a folder that contains project.godot.".to_string())?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("The project.godot marker must be a regular file.".to_string());
    }
    if metadata.len() > MAX_GODOT_CONFIG_BYTES {
        return Err("That project.godot file is unexpectedly large.".to_string());
    }
    Ok(root)
}

fn inspect_godot_project_path(project_path: &str) -> Result<GodotProject, String> {
    let root = canonical_godot_root(project_path)?;
    let contents = fs::read_to_string(root.join("project.godot"))
        .map_err(|_| "Zakape could not read that project.godot file.".to_string())?;
    let config_version = godot_config_version(&contents);
    let compatibility = match config_version {
        Some(version) if version < 5 => "legacy",
        Some(_) => "godot4",
        None => "unknown",
    }
    .to_string();
    let fallback_name = root
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Godot project")
        .to_string();
    Ok(GodotProject {
        root_path: root.to_string_lossy().into_owned(),
        name: quoted_project_setting(&contents, "config/name")
            .filter(|name| !name.trim().is_empty())
            .unwrap_or(fallback_name),
        config_version,
        godot_version: godot_feature_version(&contents),
        compatibility,
    })
}

fn ignored_godot_directory(name: &str) -> bool {
    name.starts_with('.') || matches!(name, "node_modules" | "target")
}

#[tauri::command]
fn godot_integration_available() -> bool {
    cfg!(desktop)
}

#[tauri::command]
fn godot_inspect_project(project_path: String) -> Result<GodotProject, String> {
    inspect_godot_project_path(&project_path)
}

#[tauri::command]
fn godot_discover_projects(search_path: String) -> Result<Vec<GodotProject>, String> {
    let search_root = fs::canonicalize(search_path)
        .map_err(|_| "Zakape could not open that search folder.".to_string())?;
    if !search_root.is_dir() {
        return Err("Choose a folder to scan for Godot projects.".to_string());
    }

    let mut projects = Vec::new();
    let mut queue = VecDeque::from([(search_root, 0_usize)]);
    let mut visited = 0_usize;
    while let Some((directory, depth)) = queue.pop_front() {
        visited += 1;
        if visited > MAX_GODOT_SCAN_DIRECTORIES {
            return Err("That folder contains too many directories to scan safely.".to_string());
        }
        if directory.join("project.godot").is_file() {
            if let Ok(project) = inspect_godot_project_path(&directory.to_string_lossy()) {
                projects.push(project);
            }
            if projects.len() >= 64 {
                break;
            }
            continue;
        }
        if depth >= 6 {
            continue;
        }
        let entries = fs::read_dir(&directory)
            .map_err(|_| "Zakape could not scan part of that folder.".to_string())?;
        for entry in entries.flatten() {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            let name = entry.file_name().to_string_lossy().into_owned();
            if file_type.is_dir() && !file_type.is_symlink() && !ignored_godot_directory(&name) {
                queue.push_back((entry.path(), depth + 1));
            }
        }
    }
    projects.sort_by_key(|project| project.name.to_lowercase());
    Ok(projects)
}

fn godot_relative_string(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(value) => Some(value.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn godot_resource_kind(path: &Path, is_directory: bool) -> &'static str {
    if is_directory {
        return "folder";
    }
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "png" | "webp" | "jpg" | "jpeg" | "bmp" | "svg" => "texture",
        "tscn" | "scn" => "scene",
        "tres" | "res" => "resource",
        "gd" | "cs" | "gdshader" => "script",
        "wav" | "ogg" | "mp3" => "audio",
        "ttf" | "otf" | "woff" | "woff2" => "font",
        "ase" | "aseprite" | "zakape" => "source",
        "json" | "cfg" | "csv" => "data",
        _ => "other",
    }
}

fn godot_resource_importable(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "png" | "ase" | "aseprite" | "zakape"
    )
}

#[tauri::command]
fn godot_list_resources(project_path: String) -> Result<GodotResourceIndex, String> {
    let root = canonical_godot_root(&project_path)?;
    let mut queue = VecDeque::from([(root.clone(), 0_usize)]);
    let mut entries = Vec::new();
    let mut truncated = false;

    while let Some((directory, depth)) = queue.pop_front() {
        let children = fs::read_dir(&directory)
            .map_err(|_| "Zakape could not read part of that Godot project.".to_string())?;
        for child in children.flatten() {
            if entries.len() >= MAX_GODOT_RESOURCES {
                truncated = true;
                break;
            }
            let Ok(file_type) = child.file_type() else {
                continue;
            };
            if file_type.is_symlink() {
                continue;
            }
            let name = child.file_name().to_string_lossy().into_owned();
            if file_type.is_dir() && ignored_godot_directory(&name) {
                continue;
            }
            let path = child.path();
            let Ok(relative) = path.strip_prefix(&root) else {
                continue;
            };
            let metadata = child.metadata().ok();
            let is_directory = file_type.is_dir();
            entries.push(GodotResourceEntry {
                path: godot_relative_string(relative),
                name,
                kind: godot_resource_kind(&path, is_directory).to_string(),
                is_directory,
                size: metadata.as_ref().map_or(0, fs::Metadata::len),
                modified_at: metadata
                    .and_then(|value| value.modified().ok())
                    .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                    .map(|value| value.as_secs()),
                importable: !is_directory && godot_resource_importable(&path),
            });
            if is_directory && depth < 16 {
                queue.push_back((path, depth + 1));
            }
        }
        if truncated {
            break;
        }
    }
    entries.sort_by(|left, right| {
        right
            .is_directory
            .cmp(&left.is_directory)
            .then_with(|| left.path.to_lowercase().cmp(&right.path.to_lowercase()))
    });
    Ok(GodotResourceIndex { entries, truncated })
}

fn is_safe_godot_component(component: &str) -> bool {
    if component.is_empty()
        || component == "."
        || component == ".."
        || component.starts_with('.')
        || component.ends_with(['.', ' '])
        || component.chars().count() > 128
        || component
            .chars()
            .any(|character| character.is_control() || "<>:\"|?*".contains(character))
    {
        return false;
    }
    let stem = component
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    !matches!(
        stem.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    )
}

fn checked_godot_relative_path(value: &str, allow_empty: bool) -> Result<PathBuf, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return allow_empty
            .then(PathBuf::new)
            .ok_or_else(|| "Choose a location inside the Godot project.".to_string());
    }
    if trimmed.len() > 512
        || trimmed.starts_with(['/', '\\'])
        || trimmed.contains(':')
        || trimmed.contains('\0')
    {
        return Err("That Godot resource path is invalid.".to_string());
    }
    let parts = trimmed.split(['/', '\\']).collect::<Vec<_>>();
    if parts.iter().any(|part| !is_safe_godot_component(part)) {
        return Err(
            "Resource paths cannot contain traversal, hidden, or reserved names.".to_string(),
        );
    }
    let mut path = PathBuf::new();
    parts.into_iter().for_each(|part| path.push(part));
    Ok(path)
}

fn checked_existing_godot_path(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative = checked_godot_relative_path(relative_path, false)?;
    let candidate = root.join(relative);
    let metadata = fs::symlink_metadata(&candidate)
        .map_err(|_| "That Godot resource is no longer available.".to_string())?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Zakape only opens regular project resource files.".to_string());
    }
    let canonical = fs::canonicalize(candidate)
        .map_err(|_| "Zakape could not resolve that Godot resource.".to_string())?;
    if !canonical.starts_with(root) {
        return Err("That resource resolves outside the Godot project.".to_string());
    }
    Ok(canonical)
}

fn parse_imported_png(bytes: &[u8], file_name: &str) -> Result<ImportedSprite, String> {
    let image = image::load_from_memory_with_format(bytes, image::ImageFormat::Png)
        .map_err(|_| "Zakape could not decode that PNG texture.".to_string())?;
    let width = u64::from(image.width());
    let height = u64::from(image.height());
    if width == 0
        || height == 0
        || width > 1024
        || height > 1024
        || width.saturating_mul(height) > MAX_IMPORTED_PIXELS as u64
    {
        return Err("That texture exceeds Zakape's 1,024 px canvas limits.".to_string());
    }
    let rgba = image.to_rgba8();
    let pixels = encode_rgba_image(&rgba);
    let mut palette = Vec::new();
    let mut seen = HashSet::new();
    for color in pixels.iter().flatten() {
        if seen.insert(color.clone()) && palette.len() < 256 {
            palette.push(color.clone());
        }
    }
    if palette.is_empty() {
        palette.extend(["#000000".to_string(), "#ffffff".to_string()]);
    }
    let frame_id = "frame_import_1".to_string();
    Ok(ImportedSprite {
        source_hash: source_hash(bytes),
        name: imported_name(file_name),
        width: width as usize,
        height: height as usize,
        color_mode: "rgba".to_string(),
        palette,
        frames: vec![ImportedFrame {
            id: frame_id.clone(),
            name: "F1".to_string(),
            duration: 120,
        }],
        layers: vec![ImportedLayer {
            id: "layer_import_flattened".to_string(),
            name: "Imported texture".to_string(),
            visible: true,
            opacity: 1.0,
            cels: BTreeMap::from([(frame_id, pixels)]),
        }],
    })
}

#[tauri::command]
fn godot_import_resource(
    project_path: String,
    relative_path: String,
) -> Result<GodotImportResult, String> {
    let root = canonical_godot_root(&project_path)?;
    let path = checked_existing_godot_path(&root, &relative_path)?;
    let metadata = fs::metadata(&path)
        .map_err(|_| "Zakape could not inspect that Godot resource.".to_string())?;
    if metadata.len() > MAX_GODOT_IMPORT_BYTES {
        return Err("That resource exceeds Zakape's 32 MB import limit.".to_string());
    }
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Godot resource")
        .to_string();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let bytes =
        fs::read(&path).map_err(|_| "Zakape could not read that Godot resource.".to_string())?;
    match extension.as_str() {
        "png" => Ok(GodotImportResult {
            kind: "sprite".to_string(),
            file_name: file_name.clone(),
            sprite: Some(parse_imported_png(&bytes, &file_name)?),
            contents: None,
        }),
        "ase" | "aseprite" => Ok(GodotImportResult {
            kind: "sprite".to_string(),
            file_name: file_name.clone(),
            sprite: Some(parse_imported_sprite(&bytes, &file_name)?),
            contents: None,
        }),
        "zakape" => {
            let contents = String::from_utf8(bytes)
                .map_err(|_| "That Zakape source file is not valid UTF-8.".to_string())?;
            let value: Value = serde_json::from_str(&contents)
                .map_err(|_| "That Zakape source file contains invalid JSON.".to_string())?;
            if value.get("version") != Some(&json!(1)) {
                return Err("That Zakape source version is unsupported.".to_string());
            }
            Ok(GodotImportResult {
                kind: "zakape".to_string(),
                file_name,
                sprite: None,
                contents: Some(contents),
            })
        }
        _ => Err("Zakape can open PNG, Aseprite, and .zakape resources here.".to_string()),
    }
}

fn verify_directory_chain(root: &Path, relative: &Path) -> Result<(), String> {
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(name) = component else {
            return Err("That Godot resource path is invalid.".to_string());
        };
        current.push(name);
        if !current.exists() {
            break;
        }
        let metadata = fs::symlink_metadata(&current)
            .map_err(|_| "Zakape could not inspect the target folder.".to_string())?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err("The target path crosses a link or a non-folder resource.".to_string());
        }
        let canonical = fs::canonicalize(&current)
            .map_err(|_| "Zakape could not resolve the target folder.".to_string())?;
        if !canonical.starts_with(root) {
            return Err("The target folder resolves outside the Godot project.".to_string());
        }
    }
    Ok(())
}

fn ensure_relative_directory(root: &Path, relative: &Path) -> Result<PathBuf, String> {
    verify_directory_chain(root, relative)?;
    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(name) = component else {
            return Err("That Godot folder path is invalid.".to_string());
        };
        current.push(name);
        if !current.exists() {
            fs::create_dir(&current)
                .map_err(|_| "Zakape could not create that Godot resource folder.".to_string())?;
        }
        let canonical = fs::canonicalize(&current)
            .map_err(|_| "Zakape could not resolve the new resource folder.".to_string())?;
        if !canonical.starts_with(root) {
            return Err("The new folder resolves outside the Godot project.".to_string());
        }
    }
    Ok(current)
}

#[tauri::command]
fn godot_create_directory(project_path: String, relative_path: String) -> Result<String, String> {
    let root = canonical_godot_root(&project_path)?;
    let relative = checked_godot_relative_path(&relative_path, false)?;
    let directory = ensure_relative_directory(&root, &relative)?;
    Ok(godot_relative_string(
        directory.strip_prefix(root).unwrap_or(Path::new("")),
    ))
}

fn checked_godot_destination(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative = checked_godot_relative_path(relative_path, false)?;
    let parent = relative.parent().unwrap_or(Path::new(""));
    verify_directory_chain(root, parent)?;
    let target = root.join(&relative);
    if target.exists() {
        let metadata = fs::symlink_metadata(&target)
            .map_err(|_| "Zakape could not inspect an existing target resource.".to_string())?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err("Zakape will not replace a link or folder.".to_string());
        }
        let canonical = fs::canonicalize(&target)
            .map_err(|_| "Zakape could not resolve an existing target resource.".to_string())?;
        if !canonical.starts_with(root) {
            return Err("A target resource resolves outside the Godot project.".to_string());
        }
    }
    Ok(target)
}

fn validate_godot_asset_content(path: &Path, contents: &[u8]) -> Result<(), String> {
    if contents.is_empty() {
        return Err("Godot asset files cannot be empty.".to_string());
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match extension.as_str() {
        "png" => {
            let image = image::load_from_memory_with_format(contents, image::ImageFormat::Png)
                .map_err(|_| "Zakape refused to write a malformed PNG asset.".to_string())?;
            let pixels = u64::from(image.width()).saturating_mul(u64::from(image.height()));
            if pixels == 0
                || pixels > MAX_GODOT_TEXTURE_PIXELS
                || image.width() > MAX_GODOT_TEXTURE_DIMENSION
                || image.height() > MAX_GODOT_TEXTURE_DIMENSION
            {
                return Err("The exported texture exceeds Zakape's safe Godot limits.".to_string());
            }
        }
        "tres" => {
            let text = std::str::from_utf8(contents)
                .map_err(|_| "The generated Godot resource is not valid UTF-8.".to_string())?;
            if !text.starts_with("[gd_resource type=\"SpriteFrames\"")
                || !text.lines().next().unwrap_or_default().contains("format=3")
            {
                return Err(
                    "Zakape only writes validated Godot 4 SpriteFrames resources.".to_string(),
                );
            }
        }
        "zakape" => {
            let value: Value = serde_json::from_slice(contents)
                .map_err(|_| "The Zakape source asset contains invalid JSON.".to_string())?;
            if value.get("version") != Some(&json!(1)) {
                return Err("The Zakape source asset has an unsupported version.".to_string());
            }
        }
        "json" => {
            serde_json::from_slice::<Value>(contents)
                .map_err(|_| "The Godot metadata asset contains invalid JSON.".to_string())?;
        }
        _ => {
            return Err(
                "Zakape can write PNG, SpriteFrames .tres, .zakape, or JSON assets.".to_string(),
            );
        }
    }
    Ok(())
}

#[tauri::command]
fn godot_asset_conflicts(
    project_path: String,
    relative_paths: Vec<String>,
) -> Result<Vec<String>, String> {
    let root = canonical_godot_root(&project_path)?;
    if relative_paths.is_empty() || relative_paths.len() > 16 {
        return Err("Choose between one and sixteen Godot asset files.".to_string());
    }
    let mut conflicts = Vec::new();
    let mut unique = HashSet::new();
    for relative_path in relative_paths {
        if !unique.insert(relative_path.to_lowercase()) {
            return Err("The asset bundle contains duplicate paths.".to_string());
        }
        let target = checked_godot_destination(&root, &relative_path)?;
        if target.exists() {
            conflicts.push(relative_path);
        }
    }
    Ok(conflicts)
}

fn transaction_path(target: &Path, token: u128, index: usize, purpose: &str) -> PathBuf {
    target.parent().unwrap_or(Path::new(".")).join(format!(
        ".zakape-{purpose}-{}-{token}-{index}.tmp",
        std::process::id()
    ))
}

fn remove_file_if_present(path: &Path) {
    if path.is_file() {
        let _ = fs::remove_file(path);
    }
}

#[tauri::command]
fn godot_write_assets(
    project_path: String,
    files: Vec<GodotAssetFile>,
    overwrite: bool,
) -> Result<GodotWriteResult, String> {
    if files.is_empty() || files.len() > 16 {
        return Err("Choose between one and sixteen files for the Godot asset bundle.".to_string());
    }
    let total_bytes = files
        .iter()
        .try_fold(0_usize, |total, file| {
            total.checked_add(file.contents.len())
        })
        .ok_or_else(|| "The Godot asset bundle is too large.".to_string())?;
    if total_bytes > MAX_GODOT_WRITE_BYTES {
        return Err("The Godot asset bundle exceeds Zakape's 64 MB write limit.".to_string());
    }

    let root = canonical_godot_root(&project_path)?;
    let mut unique = HashSet::new();
    let mut targets = Vec::with_capacity(files.len());
    for file in &files {
        if file.contents.len() > MAX_PROJECT_BYTES {
            return Err("An individual Godot asset exceeds Zakape's 32 MB limit.".to_string());
        }
        if !unique.insert(file.relative_path.to_lowercase()) {
            return Err("The asset bundle contains duplicate paths.".to_string());
        }
        let target = checked_godot_destination(&root, &file.relative_path)?;
        validate_godot_asset_content(&target, &file.contents)?;
        if target.exists() && !overwrite {
            return Err(format!(
                "{} already exists. Review the conflict before replacing it.",
                file.relative_path
            ));
        }
        targets.push(target);
    }
    for target in &targets {
        ensure_relative_directory(
            &root,
            target
                .strip_prefix(&root)
                .unwrap_or(target)
                .parent()
                .unwrap_or(Path::new("")),
        )?;
    }

    let token = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let mut temporary_paths: Vec<PathBuf> = Vec::with_capacity(files.len());
    for (index, (file, target)) in files.iter().zip(&targets).enumerate() {
        let temporary = transaction_path(target, token, index, "write");
        let result = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .and_then(|mut output| output.write_all(&file.contents));
        if result.is_err() {
            temporary_paths
                .iter()
                .for_each(|path| remove_file_if_present(path));
            remove_file_if_present(&temporary);
            return Err("Zakape could not stage the Godot asset bundle.".to_string());
        }
        temporary_paths.push(temporary);
    }

    let mut backups: Vec<Option<PathBuf>> = vec![None; files.len()];
    for index in 0..files.len() {
        let target = &targets[index];
        if target.exists() {
            if !overwrite {
                for prior in (0..index).rev() {
                    remove_file_if_present(&targets[prior]);
                    if let Some(backup) = &backups[prior] {
                        let _ = fs::rename(backup, &targets[prior]);
                    }
                }
                temporary_paths
                    .iter()
                    .for_each(|path| remove_file_if_present(path));
                return Err(
                    "A Godot resource changed while Zakape was preparing the bundle.".to_string(),
                );
            }
            let backup = transaction_path(target, token, index, "backup");
            if fs::rename(target, &backup).is_err() {
                for prior in (0..index).rev() {
                    remove_file_if_present(&targets[prior]);
                    if let Some(previous_backup) = &backups[prior] {
                        let _ = fs::rename(previous_backup, &targets[prior]);
                    }
                }
                temporary_paths
                    .iter()
                    .for_each(|path| remove_file_if_present(path));
                return Err(
                    "Zakape could not prepare an existing asset for replacement.".to_string(),
                );
            }
            backups[index] = Some(backup);
        }
        if fs::rename(&temporary_paths[index], target).is_err() {
            if let Some(backup) = &backups[index] {
                let _ = fs::rename(backup, target);
            }
            for prior in (0..index).rev() {
                remove_file_if_present(&targets[prior]);
                if let Some(backup) = &backups[prior] {
                    let _ = fs::rename(backup, &targets[prior]);
                }
            }
            temporary_paths
                .iter()
                .for_each(|path| remove_file_if_present(path));
            return Err("Zakape could not commit the complete Godot asset bundle.".to_string());
        }
    }
    backups
        .iter()
        .flatten()
        .for_each(|path| remove_file_if_present(path));
    Ok(GodotWriteResult {
        written: files.into_iter().map(|file| file.relative_path).collect(),
    })
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
            godot_integration_available,
            godot_inspect_project,
            godot_discover_projects,
            godot_list_resources,
            godot_import_resource,
            godot_create_directory,
            godot_asset_conflicts,
            godot_write_assets,
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
    use super::{
        checked_godot_relative_path, checked_project_id, godot_config_version,
        godot_feature_version, godot_write_assets, imported_name, ollama_endpoint,
        parse_imported_png, parse_imported_sprite, quoted_project_setting, GodotAssetFile,
    };
    use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
    use std::{
        fs,
        io::Cursor,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

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

    fn minimal_png_bytes(color: [u8; 4]) -> Vec<u8> {
        let image = RgbaImage::from_pixel(1, 1, Rgba(color));
        let mut output = Cursor::new(Vec::new());
        DynamicImage::ImageRgba8(image)
            .write_to(&mut output, ImageFormat::Png)
            .unwrap();
        output.into_inner()
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

    #[test]
    fn parses_godot_project_identity_and_version() {
        let config = r#"config_version=5
[application]
config/name="Pocket Quest"
config/features=PackedStringArray("4.6", "GL Compatibility")"#;
        assert_eq!(godot_config_version(config), Some(5));
        assert_eq!(
            quoted_project_setting(config, "config/name").as_deref(),
            Some("Pocket Quest")
        );
        assert_eq!(godot_feature_version(config).as_deref(), Some("4.6"));
    }

    #[test]
    fn accepts_only_project_relative_godot_paths() {
        assert_eq!(
            checked_godot_relative_path("art/hero/run.png", false).unwrap(),
            PathBuf::from("art").join("hero").join("run.png")
        );
        assert!(checked_godot_relative_path("../outside.png", false).is_err());
        assert!(checked_godot_relative_path("C:\\outside.png", false).is_err());
        assert!(checked_godot_relative_path(".godot/imported/hero.png", false).is_err());
        assert!(checked_godot_relative_path("art/CON.png", false).is_err());
    }

    #[test]
    fn converts_a_png_texture_to_a_bounded_sprite_payload() {
        let imported =
            parse_imported_png(&minimal_png_bytes([17, 34, 51, 255]), "hero.png").unwrap();
        assert_eq!(imported.name, "hero");
        assert_eq!(imported.width, 1);
        assert_eq!(imported.height, 1);
        assert_eq!(imported.palette, vec!["#112233"]);
        assert_eq!(
            imported.layers[0].cels["frame_import_1"],
            vec![Some("#112233".to_string())]
        );
    }

    #[test]
    fn writes_godot_assets_only_with_explicit_replacement() {
        let token = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("zakape-godot-test-{token}"));
        fs::create_dir(&root).unwrap();
        fs::write(
            root.join("project.godot"),
            "config_version=5\n[application]\nconfig/name=\"Test\"\n",
        )
        .unwrap();
        let png = minimal_png_bytes([90, 110, 140, 255]);
        let make_files = || {
            vec![GodotAssetFile {
                relative_path: "art/hero.png".to_string(),
                contents: png.clone(),
            }]
        };

        let written =
            godot_write_assets(root.to_string_lossy().into_owned(), make_files(), false).unwrap();
        assert_eq!(written.written, vec!["art/hero.png"]);
        assert!(root.join("art/hero.png").is_file());
        assert!(
            godot_write_assets(root.to_string_lossy().into_owned(), make_files(), false).is_err()
        );
        assert!(
            godot_write_assets(root.to_string_lossy().into_owned(), make_files(), true).is_ok()
        );

        assert!(root.starts_with(std::env::temp_dir()));
        fs::remove_dir_all(root).unwrap();
    }
}
