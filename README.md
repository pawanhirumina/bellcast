# Bellcast

Self-hosted push notifications you actually own. One API key, one instance, no accounts,
no third-party push service.

- **Web** — Next.js on Vercel, Slack-style inbox UI, light/dark themes, offline cache,
  browser notifications.
- **API** — one key, authenticated long-polling, idempotent publish, topics without setup.
- **Desktop** — Tauri v2 tray app with its own bundled UI and native notifications on Linux,
  macOS and Windows.

The full design is in [ARCHITECTURE.md](./ARCHITECTURE.md).

## What's new in 0.2.0

- Slack-style web UI: channel sidebar, day dividers, hover actions, composer, search and settings.
- Light and dark themes, applied instantly and remembered per device.
- Multi-select messages with select-all and bulk delete behind a confirmation dialog.
- Desktop app ships its own bundled UI instead of loading the remote web app, and keeps
  long-poll notifications running in the background.
- Publish ignores browser-provided RFC 9218 `Priority` headers so JSON bodies validate.
- Schema is unchanged: redeploy the web app and update the desktop client.

## Repo layout

```
apps/
  web/        Next.js app + API routes
  desktop/    Tauri v2 shell
supabase/
  migrations/ Postgres schema, RLS and RPCs
```

## Run it locally

No configuration is needed for local development. The API falls back to a JSON file
store and a fixed development key.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000> and use the key **`dev-key`** (or press **Use key**).

Dev data lives in `apps/web/.data/bellcast.json`. Delete it while the server is stopped to
start empty.

### Publish something

```bash
curl -X POST http://localhost:3000/api/v1/publish/alerts \
  -H "X-API-Key: dev-key" \
  -H "Title: Backup finished" \
  -H "Priority: high" \
  -H "Tags: backup,success" \
  -d "All files were copied."
```

JSON works too, including `click` and `actions`:

```bash
curl -X POST http://localhost:3000/api/v1/publish/alerts \
  -H "X-API-Key: dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Deploy finished",
    "body": "v1.2.3 is live.",
    "priority": 4,
    "tags": ["deploy"],
    "click": "https://example.com/deploys"
  }'
```

### Delivery

Clients hold a request open and receive messages as they arrive:

```bash
curl -N "http://localhost:3000/api/v1/sync?since=0&wait=25" -H "X-API-Key: dev-key"
```

The response includes the messages and a `cursor` to pass back as `since`.

## Production

1. Create a Supabase project and run `supabase/migrations/20261025000000_init.sql`
   (SQL editor or `supabase db push`).
2. Import this repository into Vercel and set **Root Directory** to `apps/web`.
3. Add the environment variables below.
4. Deploy, open the app, and connect with your API key.

| Variable | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only. Never expose to the browser. |
| `BELLCAST_API_KEY` | yes | `openssl rand -hex 32`. The one key for this instance. |
| `CRON_SECRET` | recommended | Protects `/api/cron/prune`. Vercel Cron sends it automatically. |
| `BELLCAST_RETENTION_DAYS` | no | Defaults to `30`. |
| `BELLCAST_MAX_BODY_BYTES` | no | Defaults to `65536`. |
| `BELLCAST_DEV_STORE` | no | Set `0` to disable the file store. Production never uses it. |

Browser clients exchange the key for an HttpOnly session cookie. CLI and CI use the
`X-API-Key` header. The browser never talks to Supabase directly.

`apps/web/vercel.json` schedules retention pruning once a day. Remove it if you do not want
automatic cleanup.

## Desktop app

The desktop app is a Tauri tray client with its own bundled Slack-style UI — it does not load
your deployed instance in a webview. It polls the API in the background and fires native
notifications even when the window is hidden.

### Install

Download the installer for your distro from the
[latest release](https://github.com/pawanhirumina/bellcast/releases/latest).

**Fedora / RHEL:**

```bash
sudo dnf install https://github.com/pawanhirumina/bellcast/releases/download/v0.2.0/Bellcast-0.2.0-1.x86_64.rpm
```

**Debian / Ubuntu:**

```bash
curl -LO https://github.com/pawanhirumina/bellcast/releases/download/v0.2.0/Bellcast_0.2.0_amd64.deb
sudo apt install ./Bellcast_0.2.0_amd64.deb
```

Use the `.rpm` or `.deb` package instead of the AppImage.

### Unacceptable TLS certificate

If the desktop app shows **“Unacceptable TLS certificate”**, the instance URL and
certificate are fine. The AppImage bundles Debian/Ubuntu TLS libraries, which cannot
find the CA bundle on some distros (for example Fedora 44).

Install the native package with the command above (`.rpm` on Fedora/RHEL, `.deb` on
Debian/Ubuntu), then remove the AppImage autostart entry so the broken build does not
launch at login:

```bash
rm -f ~/.config/autostart/Bellcast.desktop
```

If you must keep using the AppImage on Fedora, create the compatibility symlink before
launching it:

```bash
sudo ln -s /etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem \
  /etc/pki/tls/certs/ca-certificates.crt
```

### Fedora build prerequisites

```bash
sudo dnf install webkit2gtk4.1-devel gtk3-devel librsvg2-devel \
  libappindicator-gtk3-devel patchelf
```

Install Rust if you have not already:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Then:

```bash
pnpm install
pnpm desktop:dev      # development build
pnpm desktop:build    # deb + rpm + AppImage in apps/desktop/src-tauri/target/release/bundle
```

The first launch asks for the instance URL and API key, verifies `/api/v1/health`, then
opens the bundled inbox already signed in. Configuration is stored in
`~/.config/app.bellcast.desktop/config.json` with owner-only permissions.

**v1 limitation:** the key is stored in that file, not the OS keychain. Keychain storage is
planned.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Instance status. |
| `POST` | `/api/v1/session` | Exchange the key for a cookie. |
| `DELETE` | `/api/v1/session` | Sign out. |
| `POST` | `/api/v1/publish/:topic` | Publish a message. |
| `GET` | `/api/v1/topics` | Topic summaries. |
| `GET` | `/api/v1/messages?topic=&before=&limit=` | Paginated history. |
| `GET` | `/api/v1/sync?since=&wait=&topic=` | Authenticated long-poll. |
| `DELETE` | `/api/v1/messages/:id` | Delete a message. |

Publishing accepts JSON or plain text. `Title`, `Priority` (`min`…`max` or `1`–`5`), `Tags`
and `Click` also work as headers, and `Idempotency-Key` makes retries safe per topic.

## Versioning

Bellcast uses [SemVer](https://semver.org). Releases are `0.x` while the API is pre-stable:
breaking changes bump the minor version (`0.1` → `0.2`), fixes bump the patch version.
`1.0.0` will mark the first stable API.

## License

MIT — see [LICENSE](./LICENSE).
