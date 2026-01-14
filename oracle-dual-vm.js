#!/usr/bin/env node
/**
 * Oracle Dual VM Manager - MCP Server
 * Full autonomous access to both Oracle VMs
 *
 * VM1: 92.5.72.169 - Main services (grok-*)
 * VM2: 158.180.56.74 - Hub services (todo, mcp-hub)
 */

const { spawn } = require('child_process');
const path = require('path');

const SSH_USER = 'ubuntu';

const VMS = {
  vm1: {
    name: 'main',
    ip: '92.5.72.169',
    sshKey: 'G:\\Oracle-ARM-Server-Docs\\new_vm_key.pem',
    description: 'Main services: grok-voice, grok-admin-api, grok-emilia, etc.',
    services: ['grok-admin-api', 'grok-android', 'grok-emilia', 'grok-monitor', 'grok-portal', 'grok-voice', 'grok-zigminta']
  },
  vm2: {
    name: 'hub',
    ip: '158.180.56.74',
    sshKey: 'C:\\Users\\serge\\.ssh\\oracle_new',
    description: 'Hub services: todo-api, mcp-hub, nginx',
    services: ['todo-api', 'mcp-hub-storage', 'transcriber', 'jarvis', 'gemini-image', 'veo-video', 'emilia-voice']
  }
};

function sshCommand(vmKey, command) {
  return new Promise((resolve, reject) => {
    const vm = VMS[vmKey];
    if (!vm) {
      reject(new Error(`Unknown VM: ${vmKey}. Use 'vm1' or 'vm2'`));
      return;
    }

    const sshArgs = [
      '-i', vm.sshKey,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=10',
      `${SSH_USER}@${vm.ip}`,
      command
    ];

    const ssh = spawn('ssh', sshArgs, { shell: true });
    let stdout = '';
    let stderr = '';

    ssh.stdout.on('data', (data) => { stdout += data.toString(); });
    ssh.stderr.on('data', (data) => { stderr += data.toString(); });

    ssh.on('close', (code) => {
      resolve({
        success: code === 0,
        vm: vm.name,
        ip: vm.ip,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code
      });
    });

    ssh.on('error', (err) => {
      reject(err);
    });
  });
}

function scpUpload(vmKey, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    const vm = VMS[vmKey];
    if (!vm) {
      reject(new Error(`Unknown VM: ${vmKey}`));
      return;
    }

    const scpArgs = [
      '-i', vm.sshKey,
      '-o', 'StrictHostKeyChecking=no',
      localPath,
      `${SSH_USER}@${vm.ip}:${remotePath}`
    ];

    const scp = spawn('scp', scpArgs, { shell: true });
    let stderr = '';

    scp.stderr.on('data', (data) => { stderr += data.toString(); });

    scp.on('close', (code) => {
      resolve({
        success: code === 0,
        vm: vm.name,
        ip: vm.ip,
        localPath,
        remotePath,
        error: stderr.trim()
      });
    });
  });
}

// MCP Server Implementation
const readline = require('readline');

const tools = [
  {
    name: 'vm_exec',
    description: 'Execute command on VM. vmKey: "vm1" (92.5.72.169 main) or "vm2" (158.180.56.74 hub)',
    inputSchema: {
      type: 'object',
      properties: {
        vmKey: { type: 'string', enum: ['vm1', 'vm2'], description: 'VM to execute on' },
        command: { type: 'string', description: 'Shell command to execute' }
      },
      required: ['vmKey', 'command']
    }
  },
  {
    name: 'vm_service',
    description: 'Manage systemd service on VM (status/start/stop/restart/logs)',
    inputSchema: {
      type: 'object',
      properties: {
        vmKey: { type: 'string', enum: ['vm1', 'vm2'] },
        service: { type: 'string', description: 'Service name' },
        action: { type: 'string', enum: ['status', 'start', 'stop', 'restart', 'logs'], default: 'status' },
        lines: { type: 'number', description: 'Log lines (for logs action)', default: 50 }
      },
      required: ['vmKey', 'service']
    }
  },
  {
    name: 'vm_list_services',
    description: 'List all services on VM',
    inputSchema: {
      type: 'object',
      properties: {
        vmKey: { type: 'string', enum: ['vm1', 'vm2'] }
      },
      required: ['vmKey']
    }
  },
  {
    name: 'vm_upload',
    description: 'Upload file to VM via SCP',
    inputSchema: {
      type: 'object',
      properties: {
        vmKey: { type: 'string', enum: ['vm1', 'vm2'] },
        localPath: { type: 'string', description: 'Local file path' },
        remotePath: { type: 'string', description: 'Remote destination path' }
      },
      required: ['vmKey', 'localPath', 'remotePath']
    }
  },
  {
    name: 'vm_read_file',
    description: 'Read file content from VM',
    inputSchema: {
      type: 'object',
      properties: {
        vmKey: { type: 'string', enum: ['vm1', 'vm2'] },
        path: { type: 'string', description: 'File path on VM' },
        lines: { type: 'number', description: 'Limit to N lines (tail)', default: 100 }
      },
      required: ['vmKey', 'path']
    }
  },
  {
    name: 'vm_write_file',
    description: 'Write content to file on VM',
    inputSchema: {
      type: 'object',
      properties: {
        vmKey: { type: 'string', enum: ['vm1', 'vm2'] },
        path: { type: 'string', description: 'File path on VM' },
        content: { type: 'string', description: 'File content' }
      },
      required: ['vmKey', 'path', 'content']
    }
  },
  {
    name: 'vm_diagnose',
    description: 'Run full diagnostics on VM (disk, memory, services, ports)',
    inputSchema: {
      type: 'object',
      properties: {
        vmKey: { type: 'string', enum: ['vm1', 'vm2'] }
      },
      required: ['vmKey']
    }
  },
  {
    name: 'vm_info',
    description: 'Get VM configuration info',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

async function handleToolCall(name, args) {
  switch (name) {
    case 'vm_exec':
      return await sshCommand(args.vmKey, args.command);

    case 'vm_service': {
      const { vmKey, service, action = 'status', lines = 50 } = args;
      let cmd;
      switch (action) {
        case 'status': cmd = `systemctl status ${service}`; break;
        case 'start': cmd = `sudo systemctl start ${service}`; break;
        case 'stop': cmd = `sudo systemctl stop ${service}`; break;
        case 'restart': cmd = `sudo systemctl restart ${service}`; break;
        case 'logs': cmd = `journalctl -u ${service} -n ${lines} --no-pager`; break;
        default: cmd = `systemctl status ${service}`;
      }
      return await sshCommand(vmKey, cmd);
    }

    case 'vm_list_services': {
      const cmd = `systemctl list-units --type=service --state=running --no-pager | head -50`;
      return await sshCommand(args.vmKey, cmd);
    }

    case 'vm_upload':
      return await scpUpload(args.vmKey, args.localPath, args.remotePath);

    case 'vm_read_file': {
      const { vmKey, path: filePath, lines = 100 } = args;
      const cmd = `tail -n ${lines} "${filePath}"`;
      return await sshCommand(vmKey, cmd);
    }

    case 'vm_write_file': {
      const { vmKey, path: filePath, content } = args;
      // Escape content for bash
      const escaped = content.replace(/'/g, "'\\''");
      const cmd = `cat > "${filePath}" << 'EOFCONTENT'\n${content}\nEOFCONTENT`;
      return await sshCommand(vmKey, cmd);
    }

    case 'vm_diagnose': {
      const commands = [
        'echo "=== DISK ===" && df -h',
        'echo "=== MEMORY ===" && free -h',
        'echo "=== LOAD ===" && uptime',
        'echo "=== SERVICES ===" && systemctl list-units --type=service --state=running --no-pager | grep -E "(grok|todo|hub|nginx)"',
        'echo "=== PORTS ===" && ss -tlnp | grep LISTEN',
        'echo "=== RECENT ERRORS ===" && journalctl -p err -n 10 --no-pager'
      ];
      return await sshCommand(args.vmKey, commands.join(' && '));
    }

    case 'vm_info':
      return {
        success: true,
        vms: VMS,
        sshKey: SSH_KEY
      };

    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

// MCP Protocol Handler
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

rl.on('line', async (line) => {
  try {
    const msg = JSON.parse(line);

    if (msg.method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'oracle-dual-vm', version: '1.0.0' }
        }
      });
    } else if (msg.method === 'tools/list') {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: { tools }
      });
    } else if (msg.method === 'tools/call') {
      const result = await handleToolCall(msg.params.name, msg.params.arguments || {});
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        }
      });
    } else if (msg.method === 'notifications/initialized') {
      // ignore
    } else {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32601, message: 'Method not found' }
      });
    }
  } catch (e) {
    console.error('Error:', e);
  }
});

process.stderr.write('Oracle Dual VM MCP Server started\n');
