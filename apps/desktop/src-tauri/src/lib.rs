use std::{fs, path::PathBuf, sync::Mutex, time::Duration, time::SystemTime, time::UNIX_EPOCH};

use reqwest::Url;
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt as AutostartExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

const CLOSE_TO_TRAY: bool = true;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct Config {
    #[serde(default)]
    instance_url: String,
    #[serde(default)]
    api_key: String,
    #[serde(default)]
    last_seq: i64,
    #[serde(default)]
    paused: bool,
}

impl Config {
    fn configured(&self) -> bool {
        !self.instance_url.is_empty() && !self.api_key.is_empty()
    }
}

struct AppState {
    config: Mutex<Config>,
    client: reqwest::Client,
}

#[derive(Serialize)]
struct PublicConfig {
    instance_url: String,
    has_key: bool,
    paused: bool,
}

fn config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("config.json"))
}

fn load_config(app: &AppHandle) -> Config {
    let Some(path) = config_path(app) else {
        return Config::default();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return Config::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn save_config_file(app: &AppHandle, config: &Config) -> Result<(), String> {
    let path = config_path(app).ok_or("Could not resolve the config directory.")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|error| error.to_string())?;
    fs::write(&path, json).map_err(|error| error.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

fn normalize_url(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Enter the URL of your Bellcast instance.".into());
    }
    let candidate = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    let url = Url::parse(&candidate).map_err(|_| "That URL is not valid.".to_string())?;
    match url.scheme() {
        "http" | "https" => {}
        _ => return Err("The URL must start with http:// or https://.".into()),
    }
    if url.host_str().is_none() {
        return Err("That URL has no host.".into());
    }
    Ok(url.origin().ascii_serialization())
}

fn credentials(state: &State<'_, AppState>) -> Result<(String, String), String> {
    let config = state.config.lock().unwrap();
    if !config.configured() {
        return Err("Connect this app to an instance first.".into());
    }
    Ok((config.instance_url.clone(), config.api_key.clone()))
}

fn api_error(status: u16, body: &str) -> String {
    let detail = serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(|error| error.get("message"))
                .and_then(|message| message.as_str())
                .map(str::to_string)
        });
    match status {
        401 | 403 => "The instance rejected the API key. Open Settings and reconnect.".into(),
        404 => "That endpoint is missing on this instance.".into(),
        429 => "The instance is rate limiting requests. Try again shortly.".into(),
        _ => detail.unwrap_or_else(|| format!("The instance answered with HTTP {status}.")),
    }
}

async fn get_json(
    client: &reqwest::Client,
    base: &str,
    key: &str,
    path: &str,
) -> Result<serde_json::Value, String> {
    let response = client
        .get(format!("{base}{path}"))
        .header("X-API-Key", key)
        .send()
        .await
        .map_err(|error| format!("Can't reach the instance: {error}"))?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(api_error(status.as_u16(), &text));
    }
    serde_json::from_str(&text)
        .map_err(|_| "The instance returned an unexpected response.".to_string())
}

async fn check_health(client: &reqwest::Client, base: &str) -> Result<(), String> {
    let url = format!("{base}/api/v1/health");
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Could not reach the instance: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "The instance answered with HTTP {}.",
            response.status().as_u16()
        ));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|_| "The reply was not valid Bellcast JSON.".to_string())?;

    if body.get("ok").and_then(|value| value.as_bool()) != Some(true) {
        return Err("That URL does not look like a Bellcast instance.".into());
    }

    Ok(())
}

fn idempotency_key() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("desktop-{nanos}")
}

fn build_window(app: &AppHandle) -> Result<(), String> {
    let handle = app.clone();

    let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Bellcast")
        .inner_size(1120.0, 760.0)
        .min_inner_size(760.0, 520.0)
        .center()
        .visible(false)
        .on_navigation(move |target| {
            if target.scheme() == "bellcast-open" {
                if let Some((_, value)) = target.query_pairs().find(|(key, _)| key == "url") {
                    let destination = value.to_string();
                    if destination.starts_with("http://") || destination.starts_with("https://") {
                        let _ = handle.opener().open_url(destination, None::<&str>);
                    }
                }
                return false;
            }

            // The bundled UI is the only page this window may load. External
            // links open in the system browser through the opener plugin.
            let origin = target.origin().ascii_serialization();
            target.scheme() == "tauri"
                || origin == "http://tauri.localhost"
                || origin == "https://tauri.localhost"
        });

    let window = builder.build().map_err(|error| error.to_string())?;

    let closer = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            if CLOSE_TO_TRAY {
                api.prevent_close();
                let _ = closer.hide();
            }
        }
    });

    window.show().map_err(|error| error.to_string())?;
    Ok(())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Bellcast", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pause notifications", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(app, &[&open, &pause, &separator, &quit])?;
    let pause_item = pause.clone();

    let mut tray = TrayIconBuilder::with_id("bellcast")
        .tooltip("Bellcast")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "pause" => {
                let state = app.state::<AppState>();
                let paused = {
                    let mut config = state.config.lock().unwrap();
                    config.paused = !config.paused;
                    let _ = save_config_file(app, &config);
                    config.paused
                };
                let _ = pause_item.set_text(if paused {
                    "Resume notifications"
                } else {
                    "Pause notifications"
                });
                emit_status(
                    app,
                    if paused { "paused" } else { "live" },
                    if paused {
                        Some("Notifications are paused.".to_string())
                    } else {
                        None
                    },
                );
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

fn emit_status(app: &AppHandle, status: &str, message: Option<String>) {
    let _ = app.emit(
        "bellcast://status",
        serde_json::json!({ "status": status, "message": message }),
    );
}

fn notify(app: &AppHandle, title: &str, body: &str) {
    let mut builder = app.notification().builder().title(title);
    if !body.is_empty() {
        builder = builder.body(body);
    }
    if let Err(error) = builder.show() {
        eprintln!("[bellcast] notification failed: {error}");
    }
}

#[tauri::command]
async fn save_config(
    app: AppHandle,
    state: State<'_, AppState>,
    instance_url: String,
    api_key: String,
) -> Result<PublicConfig, String> {
    let base = normalize_url(&instance_url)?;
    let key = api_key.trim().to_string();
    if key.is_empty() {
        return Err("Enter the API key for this instance.".into());
    }

    check_health(&state.client, &base).await?;

    {
        let mut config = state.config.lock().unwrap();
        config.instance_url = base.clone();
        config.api_key = key.clone();
        config.paused = false;
        config.last_seq = 0;
        save_config_file(&app, &config)?;
    }

    if let Err(error) = app.autolaunch().enable() {
        eprintln!("[bellcast] could not enable autostart: {error}");
    }

    emit_status(&app, "connecting", None);

    Ok(PublicConfig {
        instance_url: base,
        has_key: true,
        paused: false,
    })
}

#[tauri::command]
fn get_config(state: State<'_, AppState>) -> PublicConfig {
    let config = state.config.lock().unwrap();
    PublicConfig {
        instance_url: config.instance_url.clone(),
        has_key: !config.api_key.is_empty(),
        paused: config.paused,
    }
}

#[tauri::command]
async fn health(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let base = {
        let config = state.config.lock().unwrap();
        config.instance_url.clone()
    };
    if base.is_empty() {
        return Err("No instance configured yet.".into());
    }
    let response = state
        .client
        .get(format!("{base}/api/v1/health"))
        .send()
        .await
        .map_err(|error| format!("Can't reach the instance: {error}"))?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(api_error(status.as_u16(), &text));
    }
    serde_json::from_str(&text)
        .map_err(|_| "The instance returned an unexpected response.".to_string())
}

#[tauri::command]
async fn fetch_topics(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let (base, key) = credentials(&state)?;
    get_json(&state.client, &base, &key, "/api/v1/topics").await
}

#[tauri::command]
async fn fetch_messages(
    state: State<'_, AppState>,
    topic: Option<String>,
    before: Option<i64>,
    limit: Option<u32>,
) -> Result<serde_json::Value, String> {
    let (base, key) = credentials(&state)?;
    let mut url = Url::parse(&format!("{base}/api/v1/messages"))
        .map_err(|_| "The instance URL is not valid.".to_string())?;
    {
        let mut query = url.query_pairs_mut();
        if let Some(topic) = topic.filter(|value| !value.is_empty()) {
            query.append_pair("topic", &topic);
        }
        if let Some(before) = before {
            query.append_pair("before", &before.to_string());
        }
        query.append_pair("limit", &limit.unwrap_or(100).to_string());
    }
    let path = format!(
        "{}{}",
        url.path(),
        url.query().map(|value| format!("?{value}")).unwrap_or_default()
    );
    get_json(&state.client, &base, &key, &path).await
}

#[tauri::command]
async fn publish_message(
    state: State<'_, AppState>,
    topic: String,
    body: String,
    title: Option<String>,
    priority: Option<i64>,
    tags: Option<Vec<String>>,
    click: Option<String>,
) -> Result<serde_json::Value, String> {
    let (base, key) = credentials(&state)?;
    let payload = serde_json::json!({
        "title": title.filter(|value| !value.trim().is_empty()),
        "body": body,
        "priority": priority.unwrap_or(3),
        "tags": tags.unwrap_or_default(),
        "click": click.filter(|value| !value.trim().is_empty()),
    });
    let url = format!(
        "{base}/api/v1/publish/{}",
        urlencoding(&topic.to_ascii_lowercase())
    );
    let response = state
        .client
        .post(url)
        .header("X-API-Key", &key)
        .header("Idempotency-Key", idempotency_key())
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("Can't reach the instance: {error}"))?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(api_error(status.as_u16(), &text));
    }
    serde_json::from_str(&text)
        .map_err(|_| "The instance returned an unexpected response.".to_string())
}

#[tauri::command]
async fn delete_message(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let (base, key) = credentials(&state)?;
    let url = format!("{base}/api/v1/messages/{}", urlencoding(&id));
    let response = state
        .client
        .delete(url)
        .header("X-API-Key", &key)
        .send()
        .await
        .map_err(|error| format!("Can't reach the instance: {error}"))?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(api_error(status.as_u16(), &text));
    }
    Ok(())
}

#[tauri::command]
fn set_cursor(app: AppHandle, state: State<'_, AppState>, seq: i64) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    if seq > config.last_seq {
        config.last_seq = seq;
        save_config_file(&app, &config)?;
    }
    Ok(())
}

#[tauri::command]
fn set_paused(app: AppHandle, state: State<'_, AppState>, paused: bool) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.paused = paused;
    save_config_file(&app, &config)?;
    drop(config);
    emit_status(
        &app,
        if paused { "paused" } else { "live" },
        if paused {
            Some("Notifications are paused.".to_string())
        } else {
            None
        },
    );
    Ok(())
}

#[tauri::command]
fn reset_instance(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    {
        let mut config = state.config.lock().unwrap();
        *config = Config::default();
        save_config_file(&app, &config)?;
    }
    emit_status(&app, "unconfigured", None);
    Ok(())
}

#[tauri::command]
fn open_url(app: AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Only http(s) links can be opened.".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| error.to_string())
}

fn urlencoding(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

fn spawn_poller(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        emit_status(&app, "connecting", None);

        loop {
            let (base, key, since, paused, configured) = {
                let state = app.state::<AppState>();
                let config = state.config.lock().unwrap();
                (
                    config.instance_url.clone(),
                    config.api_key.clone(),
                    config.last_seq,
                    config.paused,
                    config.configured(),
                )
            };

            if !configured {
                emit_status(&app, "unconfigured", None);
                tokio::time::sleep(Duration::from_secs(3)).await;
                continue;
            }

            if paused {
                emit_status(&app, "paused", Some("Notifications are paused.".into()));
                tokio::time::sleep(Duration::from_secs(3)).await;
                continue;
            }

            let client = {
                let state = app.state::<AppState>();
                state.client.clone()
            };

            let url = format!("{base}/api/v1/sync?since={since}&wait=25");
            let response = client
                .get(url)
                .header("X-API-Key", &key)
                .send()
                .await;

            let Ok(response) = response else {
                emit_status(
                    &app,
                    "offline",
                    Some("Can't reach your instance. Retrying in the background.".into()),
                );
                tokio::time::sleep(Duration::from_secs(5)).await;
                continue;
            };

            if !response.status().is_success() {
                let status = response.status().as_u16();
                emit_status(
                    &app,
                    if status == 401 || status == 403 {
                        "unauthorized"
                    } else {
                        "error"
                    },
                    Some(api_error(status, "")),
                );
                tokio::time::sleep(Duration::from_secs(15)).await;
                continue;
            }

            let Ok(payload) = response.json::<serde_json::Value>().await else {
                emit_status(
                    &app,
                    "error",
                    Some("The instance returned an unexpected response.".into()),
                );
                tokio::time::sleep(Duration::from_secs(5)).await;
                continue;
            };

            if payload.get("reset").and_then(|value| value.as_bool()) == Some(true) {
                let state = app.state::<AppState>();
                let mut config = state.config.lock().unwrap();
                config.last_seq = 0;
                let _ = save_config_file(&app, &config);
                emit_status(&app, "live", None);
                let _ = app.emit("bellcast://reset", ());
                continue;
            }

            let messages = payload
                .get("messages")
                .and_then(|value| value.as_array())
                .cloned()
                .unwrap_or_default();

            let mut newest = since;
            let focused = app
                .get_webview_window("main")
                .map(|window| window.is_focused().unwrap_or(false))
                .unwrap_or(false);

            for message in &messages {
                let seq = message
                    .get("seq")
                    .and_then(|value| value.as_i64())
                    .unwrap_or(newest);
                newest = newest.max(seq);

                if focused {
                    continue;
                }

                let topic = message
                    .get("topic")
                    .and_then(|value| value.as_str())
                    .unwrap_or("bellcast");
                let title = message
                    .get("title")
                    .and_then(|value| value.as_str())
                    .filter(|value| !value.is_empty())
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| format!("#{topic}"));
                let body = message
                    .get("body")
                    .and_then(|value| value.as_str())
                    .unwrap_or("");
                notify(&app, &title, body);
            }

            if newest > since {
                let state = app.state::<AppState>();
                let mut config = state.config.lock().unwrap();
                config.last_seq = newest;
                let _ = save_config_file(&app, &config);
            }

            emit_status(&app, "live", None);

            if !messages.is_empty() {
                let _ = app.emit("bellcast://messages", messages);
            }
        }
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            save_config,
            get_config,
            health,
            fetch_topics,
            fetch_messages,
            publish_message,
            delete_message,
            set_cursor,
            set_paused,
            reset_instance,
            open_url
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let config = load_config(&handle);
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(40))
                .user_agent("Bellcast Desktop/0.1")
                .build()?;

            app.manage(AppState {
                config: Mutex::new(config),
                client,
            });

            build_window(&handle)?;
            build_tray(&handle)?;
            spawn_poller(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Bellcast");
}
