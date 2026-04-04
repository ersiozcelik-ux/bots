# CeraHub Discord Bot

## Deploy auf Railway

### 1. GitHub Repository erstellen
- Erstelle ein neues GitHub Repo
- Lade alle Dateien aus diesem Ordner hoch

### 2. Railway.app Setup
1. Gehe zu [railway.app](https://railway.app) und logge dich mit GitHub ein
2. Klicke **"New Project"** → **"Deploy from GitHub repo"**
3. Wähle dein Repo aus

### 3. Environment Variables setzen
In Railway unter **Variables** diese Werte eintragen:

| Variable | Wert |
|----------|------|
| `DISCORD_BOT_TOKEN` | Dein Bot Token von Discord Developer Portal |
| `DISCORD_APPLICATION_ID` | Deine Application ID |
| `SUPABASE_URL` | `https://ciybdtgrarvjkpphuqbn.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Dein Supabase Service Role Key |

### 4. Deploy
Railway deployed automatisch. Der Bot ist dann **online** und zeigt einen Status an!

### 5. Discord Bot Permissions
Stelle sicher dass dein Bot diese Permissions hat:
- `Manage Roles` (für Get Role)
- `Send Messages`
- `Use Application Commands`

### Bot Invite Link
Ersetze `YOUR_APP_ID` mit deiner Application ID:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=268435456&scope=bot%20applications.commands
```

## Commands
- `/panel` — Zeigt das Control Panel mit Buttons
- `/ban @user` — Bannt einen User (nur Admins)
- `/unban @user` — Entbannt einen User (nur Admins)

## Buttons
- 🔑 **Redeem Key** — Key eingeben und mit Discord verknüpfen
- 📜 **Get Script** — Lua Script im Luarmor-Format
- 🎭 **Get Role** — Rolle automatisch bekommen
- ⚙ **Reset HWID** — HWID zurücksetzen
- 📊 **Get Stats** — Key-Status und Infos
