<p align="center">
  <img src="https://img.shields.io/badge/Claude-Powered-cc785c?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude Powered"/>
  <img src="https://img.shields.io/badge/Oracle_Cloud-24/7-f80000?style=for-the-badge&logo=oracle&logoColor=white" alt="Oracle Cloud"/>
  <img src="https://img.shields.io/badge/MCP-Protocol-00d9ff?style=for-the-badge" alt="MCP Protocol"/>
</p>

<h1 align="center">
  <br>
  🎯 MCP-HUB
  <br>
  <sub>Autonomous VM Management Agent via MCP</sub>
</h1>

<p align="center">
  <strong>Автономный AI-агент для управления Oracle Cloud через телефон</strong>
  <br>
  <em>Программирование • Деплой • Мониторинг • Автоисправление</em>
</p>

---

## 🎨 Что это?

**MCP-HUB** — система автономного управления облачной инфраструктурой через [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Позволяет управлять двумя Oracle Cloud VMs прямо с телефона через приложение Anthropic.

```
📱 Телефон (Anthropic App)
        ↓
🌐 Fly.io MCP Server (https://mcp-hub-old-frost-2327.fly.dev/mcp)
        ↓
🖥️ Oracle Agent API (VM2:8080)
        ↓
⚙️ VM1 (main) ←──SSH──→ VM2 (hub)
```

### ✨ Ключевые возможности

| Функция | Описание |
|---------|----------|
| 📱 **Mobile Control** | Управление серверами с телефона через Anthropic App |
| 🔄 **Auto-Fix** | Автоматическое исправление ошибок (анализ логов → фикс → рестарт) |
| 🔁 **Cross-Reboot** | VM1 ↔ VM2 взаимная перезагрузка для отказоустойчивости |
| 📦 **Smart Deploy** | Проверка ресурсов → бэкап → деплой → рестарт сервиса |
| 🩺 **Diagnostics** | Полная диагностика: диск, память, load, статус сервисов |
| 🔐 **Auto-Start** | Все сервисы автоматически запускаются после перезагрузки |

---

## 🚀 Быстрый старт

### Подключение с телефона

1. Откройте приложение **Anthropic** (Android/iOS)
2. Settings → Connectors → Add Custom Connector
3. URL: `https://mcp-hub-old-frost-2327.fly.dev/mcp`
4. Готово! Теперь можете давать команды голосом или текстом

### Примеры команд

```
"Покажи сервисы на vm1"
"Выполни команду df -h на vm2"
"Проверь ресурсы перед деплоем"
"Задеплой этот Python код на VM1"
"Сервис grok-voice упал - исправь"
"Перезагрузи vm2"
```

---

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP-HUB ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   📱 MOBILE (Anthropic App)                                     │
│        │                                                         │
│        ▼                                                         │
│   ┌─────────────────────────────────────────┐                   │
│   │         FLY.IO MCP SERVER               │                   │
│   │   mcp-hub-old-frost-2327.fly.dev/mcp    │                   │
│   │   • 24 MCP Tools                        │                   │
│   │   • Streamable HTTP Transport           │                   │
│   └────────────────┬────────────────────────┘                   │
│                    │ HTTP API                                    │
│                    ▼                                             │
│   ┌─────────────────────────────────────────┐                   │
│   │         VM2 (hub) - 158.180.56.74       │                   │
│   │   • oracle-agent-api.js (port 8080)     │                   │
│   │   • nginx reverse proxy                 │                   │
│   │   • PM2 process manager                 │                   │
│   └────────────────┬────────────────────────┘                   │
│                    │ SSH                                         │
│                    ▼                                             │
│   ┌─────────────────────────────────────────┐                   │
│   │         VM1 (main) - 92.5.72.169        │                   │
│   │   • grok-admin-api, grok-voice          │                   │
│   │   • grok-emilia, grok-portal            │                   │
│   │   • systemd services                    │                   │
│   └─────────────────────────────────────────┘                   │
│                                                                  │
│   🔁 Cross-Reboot: VM1 может перезагрузить VM2 и наоборот       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ MCP Tools (24 инструмента)

### VM Management (8 tools)

| Tool | Description |
|------|-------------|
| `vm_exec` | Выполнить команду на VM (vm1 или vm2) |
| `vm_logs` | Получить логи сервиса |
| `vm_diagnose` | Полная диагностика VM |
| `vm_resources` | Проверить ресурсы (диск, память, load) |
| `vm_deploy` | Деплой кода с проверкой ресурсов |
| `vm_fix` | Автоисправление сервиса (до 3 попыток) |
| `vm_services` | Список всех сервисов и их статус |
| `vm_reboot` | Перезагрузка VM (кросс-перезагрузка) |

### Notes & Tasks (8 tools)

| Tool | Description |
|------|-------------|
| `save_note` | Сохранить заметку |
| `get_notes` | Получить заметки |
| `search_notes` | Поиск по заметкам |
| `delete_note` | Удалить заметку |
| `add_task` | Добавить задачу |
| `get_tasks` | Получить задачи |
| `complete_task` | Завершить задачу |
| `delete_task` | Удалить задачу |

### Other Tools (8 tools)

| Tool | Description |
|------|-------------|
| `search_tools` | Поиск AI инструментов |
| `add_tool` | Добавить инструмент |
| `get_top_tools` | Топ инструментов |
| `get_news` | Получить новости |
| `add_news` | Добавить новость |
| `get_stats` | Статистика хаба |
| `export_all` | Экспорт всех данных |
| `sync_oracle` | Синхронизация с Oracle |

---

## 🔄 Auto-Fix Logic

Когда сервис падает, `vm_fix` автоматически:

```javascript
1. Читает логи сервиса
2. Анализирует ошибку:
   • EADDRINUSE → убивает процесс на порту
   • MODULE_NOT_FOUND → npm install
   • ENOENT → восстановление из бэкапа
3. Перезапускает сервис
4. Проверяет статус
5. Повторяет до 3 раз если не помогло
```

---

## 📁 Структура проекта

```
MCP-HUB/
├── oracle-agent-api.js     # HTTP API для управления VM (работает на VM2)
├── oracle-dual-vm.js       # SSH manager для обеих VM
├── oracle-admin-api.py     # Admin API на VM1
├── todo-api.js             # Todo сервис на VM2
├── github-autopush.js      # Автопуш на GitHub
├── index.js                # Локальный MCP сервер
├── CLAUDE.md               # Инструкции для AI агента
├── UNIVERSAL_AGENT_SPEC.md # Техническая спецификация
└── README.md               # Этот файл
```

---

## 🔐 Безопасность

- **API Key** защищает oracle-agent-api (`X-API-Key` header)
- **SSH ключи** хранятся локально на каждой VM
- **Fly.io** проксирует запросы (нет прямого доступа к VM)
- **Auto-start** настроен через systemd/PM2

---

## 📊 Сервисы на VM

### VM1 (main) - Systemd Services
```
✅ grok-admin-api  - Admin REST API
✅ grok-voice      - Voice processing
✅ grok-emilia     - Emilia AI
✅ grok-monitor    - Monitoring
✅ grok-portal     - Web portal
✅ grok-android    - Android backend
✅ grok-zigminta   - Zigminta service
```

### VM2 (hub) - PM2 Services
```
✅ oracle-agent    - Agent API (port 8080)
✅ transcriber     - Audio transcription
✅ mcp-hub-storage - MCP storage
✅ todo-api        - Todo service
✅ jarvis          - Jarvis assistant
✅ gemini-image    - Image generation
✅ veo-video       - Video generation
✅ emilia-voice    - Voice synthesis
✅ nginx           - Reverse proxy (systemd)
```

---

## 🔁 Cross-Reboot System

Каждая VM может перезагрузить другую:

```bash
# На VM2 - перезагрузить VM1
~/reboot_vm1.sh

# На VM1 - перезагрузить VM2
~/reboot_vm2.sh

# Диагностика с автоисправлением
~/auto_diagnose.sh --fix
```

После перезагрузки все сервисы запускаются автоматически!

---

## 🤝 Технологии

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Opus_4.5-Anthropic-cc785c?style=flat-square" alt="Claude"/>
  <img src="https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Python-3.11-3776ab?style=flat-square&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/Oracle_Cloud-ARM-f80000?style=flat-square&logo=oracle&logoColor=white" alt="Oracle"/>
  <img src="https://img.shields.io/badge/Fly.io-Deploy-8b5cf6?style=flat-square" alt="Fly.io"/>
</p>

---

## 📱 MCP Connection

```
URL: https://mcp-hub-old-frost-2327.fly.dev/mcp
Transport: Streamable HTTP
Tools: 24
```

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
