# Bellcast Desktop Update - v0.2.0 Migration Plan
> Current: v0.1.0 | Next: v0.2.0 | Codename: Native Slint Rewrite

This document outlines the full revamp from Tauri/WebView to fully native Slint desktop + Slack-like UI overhaul.

---

## 1. Why this update?

v0.1.0 issues found in prod (see screenshot `image_68ac78.png` top output):
- `rustc` 40%+ CPU on first `pnpm --filter desktop dev` (335/567 crates)
- `Gtk-CRITICAL gtk_widget_get_scale_factor` warnings
- `plugin:notification|is_permission_granted 500` + `Origin header is not a valid URL` + `<body>Operation was cancelled</body>`
- WebView loads external `instance_url/connect` - not truly native, RAM leak when window stays hidden in tray
- UI is card-based, not Slack-like

Goal for v0.2.0: Native OS look, <20MB RAM idle, <8MB binary, no WebView leak.

---

## 2. Desktop Stack Migration: Tauri -> Slint

### Remove
- `tauri-plugin-opener`, `tauri-plugin-shell` WebView deps
- `WebviewWindowBuilder::new(app, "main", WebviewUrl::External(...))` - remote URL loading
- `on_navigation` blocking logic that caused `Operation was cancelled`

### Add
```toml
# apps/desktop-native/Cargo.toml
[dependencies]
slint = { version = "1.7", features = ["backend-winit", "renderer-skia"] }
tray-icon = "0.12"
tao = "0.16"
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
tauri-plugin-autostart = { version = "2", optional = true } # keep if needed, or use auto-launch crate
auto-launch = "0.5"
```

**New Architecture:**
```
Bellcast Native (Slint)
├── Poller (Rust tokio, long polling) - replaces reqwest in setup()
├── Tray (tray-icon) - show/hide, quit
├── Native Window (Slint Window)
│   ├── Sidebar: Channels / Topics (like Slack)
│   └── MessageList: Virtualized ListView (Slint ListView)
├── Config: ~/.config/bellcast/config.json (same as now)
└── Notifications: native via notify-rust / Slint notification API
```

**Build:**
- Windows: `cargo build --release --target x86_64-pc-windows-msvc` -> 5MB exe
- macOS: `cargo build --release --target universal` -> 6MB dmg
- Linux: `cargo build --release` -> 6MB AppImage, works on any distro with glibc + Wayland/X11 + dbus (Fedora, Ubuntu, Debian, Arch, etc.)

---

## 3. UI Revamp - Slack-like Native

### Design System (Slint std-widgets)
Use Slint's Fluent style (Windows 11) auto-switches to Cupertino on macOS and Material on Linux.

**Layout:**
```
[Sidebar 240px] | [Main]
- # general       |  #general | 120 members
- # alerts        |  ----------------------------------
- # deployments   |  Today
- Directs         |  [Avatar] @system 10:30 AM
                  |  Deploy succeeded
                  |  [Avatar] @telegram-bot 10:31 AM
                  |  New message from Telegram
```

**Components to rewrite:**
- `apps/web/components/message-list.tsx` (current card UI) -> `ui/message-list.slint`
  - Avatar (36px), name + time inline, hover toolbar (react, reply, delete)
  - Day dividers: Today / Yesterday pills
  - High priority: left border + tint (like Slack mention)
- `topbar.tsx`, `sidebar.tsx`, `app-shell.tsx` -> native Slint components

### Whole Website UI Revamp (Web app)
Keep React but match desktop:
- Tailwind config: `background: #1A1D21`, `hover: #222529`
- Remove rounded-[14px] cards, use Slack row style `px-5 py-1.5 hover:bg-white/[0.04]`
- Add same day separators and hover actions as desktop

---

## 4. Features - v0.2.0

### a) Custom Integrations
- `integrations/` folder: trait `Integration { fn id() -> String; fn handle(event) }`
- Built-in: GitHub, Vercel, Custom Webhook
- New: Telegram Bot integration
  - Config: `telegram_bot_token`, `chat_id`
  - Poller fetches Telegram updates via long polling, converts to Message

### b) Telegram Integration
- Settings -> Integrations -> Telegram
- Flow: User adds bot token, Bellcast does `getUpdates` long polling in Rust poller
- Maps to topic `telegram`

### c) Custom Threads for Chatting
- Like Slack threads: click message -> open thread pane on right
- Data model: `Message { parent_seq: Option<u64> }`
- UI: Thread count badge + drawer
- Desktop: Slint `Drawer` component, Web: Sheet

### d) Webhook Support with Web App URLs
- Web app URL config: `instance_url` now supports multiple: `Vec<String>`
- Each URL gets its own long polling loop (tokio::spawn)
- Webhook endpoint: `/api/v1/publish/{topic}` stays same
- Desktop merges streams into unified MessageList
- Long polling: `GET /api/v1/poll?since={seq}&timeout=40` (instead of short poll)

### e) Long Polling Implementation
```rust
async fn spawn_poller(handle: AppHandle) {
    loop {
        match client.get(format!("{}/api/v1/poll?since={}&timeout=40", instance_url, last_seq)).send().await {
            Ok(resp) => { /* push to Slint model */ },
            Err(_) => tokio::time::sleep(Duration::from_secs(5)).await,
        }
    }
}
```

### f) RAM Leak Fix
- Root cause: WebView never freed when `CLOSE_TO_TRAY = true`, plus `reqwest::Client` cloned per poll
- Fix in Slint: No WebView at all. Window `hide()` actually frees GPU resources.
- Use single global `reqwest::Client` in `AppState` (already done), add `client = Client::builder().pool_max_idle_per_host(1).build()`
- Profile release: `lto=true, codegen-units=1, strip=true, panic=abort`

---

## 5. File Changes

```
apps/desktop/ -> deprecated, move to apps/desktop-tauri-legacy/
apps/desktop-native/ -> new Slint app (new)
apps/web/components/message-list.tsx -> rewrite to Slack row style
apps/web/components/sidebar.tsx -> Slack sidebar style
ui/ -> new Slint UI files
src-tauri/capabilities/default.json -> remove, not needed in Slint
```

---

## 6. Versioning - Should first update be v0.1.0?

Short answer: **No, your next should be v0.2.0, not v0.1.0.**

SemVer rules:
- `v0.1.0` = initial development, anything may change
- `v0.1.1` = patch / bug fix (RAM leak fix only)
- `v0.2.0` = minor, new features + breaking-ish changes (new UI, Slint migration, threads, Telegram)
- `v1.0.0` = first stable public API

What you are doing is MAJOR:
- Full UI revamp (Slack-like)
- Stack change Tauri -> Slint
- New features: Telegram, threads, webhooks, long polling
- Breaking: config format changes (multiple instance_url)

This is not a patch, so `v0.1.1` is wrong. This is `v0.2.0`.

What OpenCode / DeepSeek AI did with staying on v0.1.0?
They kept v0.1.0 for a long time during rapid prototyping to signal "not stable yet". That's valid if you want to say "still pre-alpha, don't rely on API". But for users, it's confusing - looks like you didn't ship.

**Recommendation for Bellcast:**
- Current prod: `v0.1.0`
- This Slint rewrite: `v0.2.0-alpha.1` -> `v0.2.0` on release
- Next stable with all integrations working: `v1.0.0`

Add in README:
```
## Versioning
We use SemVer. v0.x = pre-stable. Breaking changes bump minor (0.1 -> 0.2).
```

---

## 7. Checklist

- [ ] Create `apps/desktop-native` with Slint template
- [ ] Port `save_config, get_config, set_paused, reset_instance` + poller
- [ ] Build native MessageList in Slint (virtualized)
- [ ] Implement tray hide/show (fix leak)
- [ ] Telegram integration + long polling
- [ ] Custom threads data model + UI
- [ ] Webhook multi-URL support
- [ ] Website UI revamp to match Slack style
- [ ] Release profile LTO + strip, test RAM <20MB idle
- [ ] Bump version to v0.2.0, tag git, build artifacts for Win/Mac/Linux

---

## 8. Commands

```bash
# dev
cd apps/desktop-native
cargo run

# release
cargo build --release
# binary at target/release/bellcast-native
```
