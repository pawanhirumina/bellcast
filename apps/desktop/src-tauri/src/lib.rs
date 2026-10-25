use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
    time::Duration,
};

use reqwest::Url;
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
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

fn bootstrap_script(instance_url: &str) -> String {
    let quoted = serde_json::to_string(instance_url).unwrap_or_else(|_| "\"\"".into());
    format!(
        r#"(function () {{
  if (window.__BELLCAST__) return;
  window.__BELLCAST__ = {{
    platform: "desktop",
    instanceUrl: {quoted},
    openExternal: function (url) {{
      try {{
        if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return;
        window.location.href = "bellcast-open://open?url=" + encodeURIComponent(url);
      }} catch (error) {{}}
    }}
  }};
}})();"#
    )
}

fn navigate_to_instance(app: &AppHandle, base: &str, api_key: &str) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Err("The main window is not ready.".into());
    };
    let mut url = Url::parse(&format!("{base}/connect"))
        .map_err(|error| format!("Could not build the connect URL: {error}"))?;
    url.set_fragment(Some(&format!("key={api_key}")));
    window
        .navigate(url)
        .map_err(|error| format!("Could not open the instance: {error}"))?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

fn app_home_url() -> Result<Url, String> {
    // The bundled frontend is served from the `tauri` custom protocol on Linux and
    // macOS, and from tauri.localhost on Windows.
    let raw = if cfg!(target_os = "windows") {
        "http://tauri.localhost/index.html"
    } else {
        "tauri://localhost/index.html"
    };
    Url::parse(raw).map_err(|error| format!("Could not build the onboarding URL: {error}"))
}

fn show_onboarding(app: &AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Err("The main window is not ready.".into());
    };
    let url = app_home_url()?;
    window
        .navigate(url)
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

fn build_window(app: &AppHandle, config: &Config) -> Result<(), String> {
    let (url, script) = if config.configured() {
        let mut connect = Url::parse(&format!("{}/connect", config.instance_url))
            .map_err(|error| error.to_string())?;
        connect.set_fragment(Some(&format!("key={}", config.api_key)));
        (
            WebviewUrl::External(connect),
            Some(bootstrap_script(&config.instance_url)),
        )
    } else {
        (WebviewUrl::App("index.html".into()), None)
    };

    let instance_origin = config.instance_url.clone();
    let handle = app.clone();

    let mut builder = WebviewWindowBuilder::new(app, "main", url)
        .title("Bellcast")
        .inner_size(1120.0, 760.0)
        .min_inner_size(780.0, 520.0)
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

            if instance_origin.is_empty() {
                return true;
            }

            let origin = target.origin().ascii_serialization();
            origin == instance_origin
                || target.scheme() == "tauri"
                || origin == "http://tauri.localhost"
                || origin == "https://tauri.localhost"
        });

    if let Some(script) = script {
        builder = builder.initialization_script(script);
    }

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
) -> Result<(), String> {
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

    navigate_to_instance(&app, &base, &key)
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
fn set_paused(app: AppHandle, state: State<'_, AppState>, paused: bool) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.paused = paused;
    save_config_file(&app, &config)
}

#[tauri::command]
fn reset_instance(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    {
        let mut config = state.config.lock().unwrap();
        *config = Config::default();
        save_config_file(&app, &config)?;
    }
    show_onboarding(&app)
}

fn spawn_poller(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
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

            if !configured || paused {
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
                tokio::time::sleep(Duration::from_secs(5)).await;
                continue;
            };

            if !response.status().is_success() {
                // Bad key, missing instance or a transient upstream error.
                tokio::time::sleep(Duration::from_secs(15)).await;
                continue;
            }

            let Ok(payload) = response.json::<serde_json::Value>().await else {
                tokio::time::sleep(Duration::from_secs(5)).await;
                continue;
            };

            let messages = payload
                .get("messages")
                .and_then(|value| value.as_array())
                .cloned()
                .unwrap_or_default();

            if messages.is_empty() {
                continue;
            }

            let focused = app
                .get_webview_window("main")
                .map(|window| window.is_focused().unwrap_or(false))
                .unwrap_or(false);

            let mut newest = since;
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
            set_paused,
            reset_instance
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let config = load_config(&handle);
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(40))
                .user_agent("Bellcast Desktop/0.1")
                .build()?;

            app.manage(AppState {
                config: Mutex::new(config.clone()),
                client,
            });

            build_window(&handle, &config)?;
            build_tray(&handle)?;
            spawn_poller(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Bellcast");
}
