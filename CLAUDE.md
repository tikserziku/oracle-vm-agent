# Oracle VM Autonomous Operations

## FULL ACCESS GRANTED

Пользователь предоставил **полные права** на обеих Oracle VM. Работай автономно, не спрашивай разрешения на стандартные операции.

## VM Configuration

| VM | IP | Назначение | Сервисы |
|----|-----|------------|---------|
| **vm1** | 92.5.72.169 | Main services | grok-admin-api, grok-android, grok-emilia, grok-monitor, grok-portal, grok-voice, grok-zigminta |
| **vm2** | 158.180.56.74 | Hub services | todo-api, mcp-hub, nginx |

**SSH Keys:**
- **VM1:** `G:\Oracle-ARM-Server-Docs\new_vm_key.pem`
- **VM2:** `C:\Users\serge\.ssh\oracle_new`

**User:** ubuntu

## Autonomous Rules

### DO (разрешено без вопросов):

1. **Диагностика** - проверять статус сервисов, логи, disk/memory/cpu
2. **Перезапуск сервисов** - `systemctl restart` любого сервиса
3. **Чтение файлов** - читать любые конфиги и код
4. **Исправление ошибок** - если сервис упал, чинить автоматически
5. **Загрузка файлов** - обновлять код через SCP
6. **Создание сервисов** - создавать новые systemd юниты
7. **Управление nginx** - добавлять/изменять конфиги
8. **Просмотр логов** - journalctl, nginx logs, app logs

### CAUTION (делать, но сообщать):

1. **Удаление файлов** - сначала бэкап, потом удалять
2. **Изменение портов** - проверить что порт свободен
3. **Обновление системы** - apt upgrade только если явно нужно

### ASK (спросить перед выполнением):

1. **Reboot VM** - только с разрешения
2. **Удаление сервисов** - только с разрешения
3. **Изменение SSH/firewall** - только с разрешения

## Quick Commands

```bash
# SSH to VM1 (main)
ssh -i "G:\Oracle-ARM-Server-Docs\new_vm_key.pem" ubuntu@92.5.72.169

# SSH to VM2 (hub)
ssh -i "G:\Oracle-ARM-Server-Docs\new_vm_key.pem" ubuntu@158.180.56.74

# List services
systemctl list-units --type=service --state=running | grep -E "(grok|todo|hub)"

# Check logs
journalctl -u SERVICE_NAME -n 50 --no-pager

# Restart service
sudo systemctl restart SERVICE_NAME
```

## Standard Paths

### VM1 (92.5.72.169):
- `/home/ubuntu/grok-voice/` - main code
- `/etc/systemd/system/grok-*.service` - service files

### VM2 (158.180.56.74):
- `/home/ubuntu/` - apps
- `/etc/nginx/sites-enabled/` - nginx configs
- `/var/www/` - static files

## Auto-Fix Procedures

### Service not running (status: failed/inactive)
1. Check logs: `journalctl -u SERVICE -n 50`
2. Identify error (ImportError, missing file, port conflict)
3. Fix the issue
4. Restart: `sudo systemctl restart SERVICE`
5. Verify: `systemctl status SERVICE`

### 502 Bad Gateway (nginx)
1. Check which service nginx proxies to
2. Verify backend is running
3. Check port matches nginx config
4. Restart backend if needed

### Disk full
1. Check: `df -h`
2. Find large files: `du -sh /* | sort -h`
3. Clean: logs, tmp, old backups
4. Never delete user data without asking

## MCP Integration

Используй `oracle-dual-vm.js` MCP сервер для SSH операций:
- `vm_exec` - выполнить команду
- `vm_service` - управление сервисами
- `vm_diagnose` - полная диагностика
- `vm_upload` - загрузка файлов
- `vm_read_file` / `vm_write_file` - работа с файлами

## Response Format

При работе с VM всегда показывай:
1. Какая VM (vm1/vm2 + IP)
2. Что сделано
3. Результат (успех/ошибка)
4. Следующие шаги если нужно
