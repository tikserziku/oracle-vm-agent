<p align="center">
  <img src="https://img.shields.io/badge/Claude-Powered-cc785c?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude Powered"/>
  <img src="https://img.shields.io/badge/Oracle_Cloud-24/7-f80000?style=for-the-badge&logo=oracle&logoColor=white" alt="Oracle Cloud"/>
  <img src="https://img.shields.io/badge/Voice-Enabled-4285f4?style=for-the-badge&logo=google-assistant&logoColor=white" alt="Voice Enabled"/>
</p>

<h1 align="center">
  <br>
  🎯 MCP-HUB
  <br>
  <sub>Universal Voice Agent for VM Management</sub>
</h1>

<p align="center">
  <strong>Автономный AI-агент с голосовым управлением для Oracle Cloud</strong>
  <br>
  <em>Программирование • Деплой • Мониторинг • Автоисправление</em>
</p>

---

## 🎨 Overview

**MCP-HUB** — это система автономного управления облачной инфраструктурой через голосовые команды. Построена на базе Claude (Anthropic) с интеграцией в Oracle Cloud.

```
📱 Телефон → 🎤 Голос → 🤖 AI Agent → ⚙️ Oracle VMs
     ↑                                    ↓
     └──────── 📝 Результат ←─────────────┘
```

### ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🎤 **Voice Control** | Управляй серверами голосом через Telegram |
| 🔄 **Auto-Fix** | Автоматическое исправление ошибок без участия человека |
| 🔁 **Cross-Reboot** | VM1 ↔ VM2 взаимная перезагрузка для отказоустойчивости |
| 📦 **GitHub Sync** | Автоматический бэкап кода на GitHub |
| 🐍 **Live Coding** | Программирование и деплой кода голосом |
| 📊 **Monitoring** | Push-уведомления при падении сервисов |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    REDUNDANT ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │                  📱 VOICE INTERFACE                   │  │
│   │              Telegram Bot + Whisper/Groq              │  │
│   └────────────────────────┬─────────────────────────────┘  │
│                            │                                 │
│            ┌───────────────┼───────────────┐                │
│            ▼               ▼               ▼                │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │    VM1      │  │    VM2      │  │   GitHub    │        │
│   │   (main)    │◄─┤   (hub)     │  │  (backup)   │        │
│   │ 92.5.72.169 │  │158.180.56.74│  │             │        │
│   └──────┬──────┘  └──────┬──────┘  └─────────────┘        │
│          │                │                                 │
│          └────── SSH ─────┘                                 │
│          Cross-Reboot Capable                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- SSH access to Oracle VMs
- Telegram Bot Token
- GitHub Personal Access Token

### Installation

```bash
# Clone
git clone https://github.com/USER/oracle-vm-agent.git
cd oracle-vm-agent

# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your credentials

# Run
npm start
```

### Voice Commands Examples

```
🎤 "Проверь статус всех сервисов"
🎤 "Покажи логи voice сервиса"
🎤 "Перезапусти admin-api"
🎤 "Есть ошибки? Исправь"
🎤 "Создай endpoint /health в api"
🎤 "Перезагрузи первую машину"
```

---

## 📁 Project Structure

```
MCP-HUB/
├── 📄 index.js              # Main MCP server (50+ tools)
├── 📄 oracle-dual-vm.js     # SSH manager for both VMs
├── 📄 oracle-admin-api.py   # VM1 admin API
├── 📄 todo-api.js           # VM2 todo service
│
├── 📁 voice-agent/          # Voice control system
│   ├── bot.py               # Telegram bot
│   ├── processor.py         # AI command processor
│   └── cross_reboot.py      # VM failover system
│
├── 📄 CLAUDE.md             # Autonomous operation rules
├── 📄 UNIVERSAL_AGENT_SPEC.md # Technical specification
└── 📄 README.md             # This file
```

---

## 🛠️ MCP Tools (50+)

### 📝 Notes & Tasks
- `save_note` / `get_notes` / `search_notes`
- `add_task` / `get_tasks` / `complete_task`

### 🔧 VM Management
- `vm_list_services` / `vm_service_status` / `vm_service_logs`
- `vm_restart_service` / `vm_start_service` / `vm_stop_service`
- `vm_create_service` / `vm_edit_service` / `vm_delete_service`

### 📁 File Operations
- `vm_list_files` / `vm_read_file` / `vm_write_file` / `vm_delete_file`

### 🐍 Code Execution
- `vm_run_code` — Execute Python on VM
- `vm_check_code` — Syntax validation

### 🩺 Diagnostics
- `vm_diagnose_service` — Full service health check
- `vm_diagnose_all` — All services status

### ☁️ GitHub Integration
- `github_create_repo` / `github_create_file` / `github_get_file`
- `vm_backup_to_github` / `vm_restore_from_github`
- `vm_backup_project` — Full project backup (code + requirements + README)

---

## 🎯 Auto-Fix Logic

```python
def auto_fix(error):
    if "ImportError" in error:
        → Fix import, restart service
    elif "Address already in use" in error:
        → Kill process on port, restart
    elif "FileNotFoundError" in error:
        → Restore from GitHub backup
    elif "MemoryError" in error:
        → Clear logs, restart service
    else:
        → Notify user via Telegram
```

---

## 🔐 Security

- SSH keys stored locally on each VM
- Telegram bot restricted to authorized users
- Critical commands require voice confirmation
- All actions logged to GitHub

---

## 📊 Status Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | API info |
| `GET /monitor` | Web dashboard with push notifications |
| `GET /mcp/tools` | List all MCP tools |
| `POST /mcp/execute` | Execute MCP tool |

---

## 📱 Mobile Access (Anthropic App)

Connect from your phone via Anthropic Android/iOS app:

```
Settings → Connectors → Add Custom Connector
URL: https://mcp-hub-old-frost-2327.fly.dev/mcp
```

**Available mobile commands:**
- Notes: `save_note`, `get_notes`, `search_notes`
- Tasks: `add_task`, `get_tasks`, `complete_task`
- Tools catalog: `get_tools`, `search_tools`

---

## 🤝 Built With

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Opus_4.5-Anthropic-cc785c?style=flat-square" alt="Claude"/>
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Python-3.11+-3776ab?style=flat-square&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/Oracle_Cloud-ARM-f80000?style=flat-square&logo=oracle&logoColor=white" alt="Oracle"/>
</p>

---

<p align="center">
  <strong>🤖 Powered by Claude Code (Anthropic)</strong>
  <br>
  <em>Autonomous AI Agent Development</em>
  <br><br>
  <a href="https://anthropic.com">
    <img src="https://img.shields.io/badge/Anthropic-Claude-cc785c?style=for-the-badge" alt="Anthropic"/>
  </a>
</p>
