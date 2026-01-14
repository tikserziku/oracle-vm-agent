const express = require('express');

const app = express();
app.use(express.json());

// ORACLE VM APIs
const ORACLE_HUB_API = 'http://158.180.56.74/hub/api';
const ORACLE_ADMIN_API = 'http://92.5.72.169:5001';

// Fetch data from Oracle VM Hub
async function fetchOracle(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(ORACLE_HUB_API + endpoint, options);
  return res.json();
}

// Fetch from Oracle Admin API (for file/service operations)
async function fetchOracleAdmin(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);
  try {
    const res = await fetch(ORACLE_ADMIN_API + endpoint, options);
    return res.json();
  } catch (e) {
    return { error: e.message };
  }
}

// TRANSCRIBER API
const TRANSCRIBER_URL = process.env.TRANSCRIBER_URL || 'http://92.5.72.169:5000';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function transcribeVideo(videoUrl, language, provider) {
  const response = await fetch(TRANSCRIBER_URL + '/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_url: videoUrl,
      api_key: GEMINI_API_KEY,
      language: language || 'auto',
      provider: provider || 'gemini'
    })
  });
  return response.json();
}

// GITHUB API
const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;

const githubHeaders = {
  'Authorization': 'Bearer ' + GITHUB_TOKEN,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'MCP-Hub'
};

async function githubGetFile(repo, filePath, branch) {
  const res = await fetch(GITHUB_API + '/repos/' + GITHUB_USERNAME + '/' + repo + '/contents/' + filePath + '?ref=' + (branch||'main'), { headers: githubHeaders });
  const result = await res.json();
  if (result.content) result.decoded = Buffer.from(result.content, 'base64').toString('utf8');
  return result;
}

async function githubCreateFile(repo, filePath, content, message, branch) {
  let sha = null;
  try { const existing = await githubGetFile(repo, filePath, branch); if (existing.sha) sha = existing.sha; } catch (e) {}
  const res = await fetch(GITHUB_API + '/repos/' + GITHUB_USERNAME + '/' + repo + '/contents/' + filePath, {
    method: 'PUT', headers: githubHeaders,
    body: JSON.stringify({ message: message || ('Update ' + filePath), content: Buffer.from(content).toString('base64'), branch: branch||'main', ...(sha && { sha }) })
  });
  return res.json();
}

async function githubListRepos(limit) {
  const res = await fetch(GITHUB_API + '/user/repos?per_page=' + (limit||10) + '&sort=updated', { headers: githubHeaders });
  return res.json();
}

async function githubCreateRepo(name, description, isPrivate) {
  const res = await fetch(GITHUB_API + '/user/repos', { method: 'POST', headers: githubHeaders, body: JSON.stringify({ name, description, private: isPrivate||false, auto_init: true }) });
  return res.json();
}

async function githubDeleteFile(repo, filePath, message, branch) {
  const existing = await githubGetFile(repo, filePath, branch);
  if (!existing.sha) throw new Error('File not found');
  const res = await fetch(GITHUB_API + '/repos/' + GITHUB_USERNAME + '/' + repo + '/contents/' + filePath, { method: 'DELETE', headers: githubHeaders, body: JSON.stringify({ message: message || ('Delete ' + filePath), sha: existing.sha, branch: branch||'main' }) });
  return res.json();
}

// === PROJECT HELPERS ===
// Extract requirements from Python code
function extractRequirements(pythonCode) {
  const requirements = new Set();
  const importMap = {
    'flask': 'flask', 'Flask': 'flask',
    'requests': 'requests',
    'dotenv': 'python-dotenv', 'load_dotenv': 'python-dotenv',
    'groq': 'groq',
    'openai': 'openai',
    'anthropic': 'anthropic',
    'google.generativeai': 'google-generativeai', 'genai': 'google-generativeai',
    'elevenlabs': 'elevenlabs',
    'gtts': 'gTTS',
    'pydub': 'pydub',
    'soundfile': 'soundfile',
    'numpy': 'numpy',
    'pandas': 'pandas',
    'PIL': 'Pillow', 'pillow': 'Pillow',
    'cv2': 'opencv-python',
    'torch': 'torch',
    'transformers': 'transformers',
    'aiohttp': 'aiohttp',
    'asyncio': null, // stdlib
    'os': null, 'sys': null, 'json': null, 'datetime': null, 'subprocess': null,
    'threading': null, 'time': null, 're': null, 'base64': null, 'io': null
  };
  // Match import statements
  const importRegex = /^(?:from\s+(\S+)|import\s+(\S+))/gm;
  let match;
  while ((match = importRegex.exec(pythonCode)) !== null) {
    const mod = (match[1] || match[2]).split('.')[0].split(',')[0].trim();
    if (importMap[mod] !== undefined) {
      if (importMap[mod]) requirements.add(importMap[mod]);
    } else if (!mod.startsWith('_')) {
      requirements.add(mod); // Unknown module, add as-is
    }
  }
  return Array.from(requirements).sort();
}

// Extract environment variables from Python code
function extractEnvVars(pythonCode) {
  const envVars = new Set();
  const envRegex = /os\.(?:environ|getenv)\s*[.\[(]\s*['"]([A-Z_][A-Z0-9_]*)['"]/g;
  let match;
  while ((match = envRegex.exec(pythonCode)) !== null) {
    envVars.add(match[1]);
  }
  return Array.from(envVars).sort();
}

// Generate .env.example content
function generateEnvExample(envVars, serviceName) {
  let content = `# Environment variables for ${serviceName}\n# Copy to .env and fill in your values\n\n`;
  for (const v of envVars) {
    content += `${v}=your_${v.toLowerCase()}_here\n`;
  }
  return content;
}

// Generate README content
function generateReadme(serviceName, pythonFile, port, description, requirements, envVars) {
  let readme = `# ${serviceName}\n\n${description || 'Oracle VM Service'}\n\n`;
  readme += `## Setup\n\n`;
  readme += `1. Install dependencies:\n\`\`\`bash\npip install -r requirements.txt\n\`\`\`\n\n`;
  if (envVars.length) {
    readme += `2. Configure environment:\n\`\`\`bash\ncp .env.example .env\n# Edit .env with your API keys\n\`\`\`\n\n`;
  }
  readme += `## Running\n\n`;
  readme += `\`\`\`bash\npython ${pythonFile}\n\`\`\`\n\n`;
  if (port) {
    readme += `Service runs on port **${port}**\n\n`;
  }
  readme += `## Systemd Service\n\n`;
  readme += `\`\`\`bash\nsudo cp ${serviceName}.service /etc/systemd/system/\nsudo systemctl daemon-reload\nsudo systemctl enable ${serviceName}\nsudo systemctl start ${serviceName}\n\`\`\`\n`;
  return readme;
}

// MCP TOOLS - Extended with File and Emergency tools
const MCP_TOOLS = [
  // === NOTES ===
  { name: 'save_note', description: 'Save note to Oracle VM', inputSchema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } }, required: ['title', 'content'] } },
  { name: 'get_notes', description: 'Get notes from Oracle VM', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'search_notes', description: 'Search notes', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  
  // === TASKS ===
  { name: 'add_task', description: 'Add task to Oracle VM', inputSchema: { type: 'object', properties: { title: { type: 'string' }, priority: { type: 'string' } }, required: ['title'] } },
  { name: 'get_tasks', description: 'Get tasks from Oracle VM', inputSchema: { type: 'object', properties: { status: { type: 'string' } } } },
  { name: 'complete_task', description: 'Complete task', inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } },
  
  // === AI TOOLS CATALOG ===
  { name: 'add_tool', description: 'Add AI tool', inputSchema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' } }, required: ['name', 'description', 'category'] } },
  { name: 'search_tools', description: 'Search AI tools', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
  { name: 'get_top_tools', description: 'Top AI tools', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  
  // === NEWS ===
  { name: 'get_news', description: 'Get AI news', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'add_news', description: 'Add news', inputSchema: { type: 'object', properties: { title: { type: 'string' }, text: { type: 'string' } }, required: ['title', 'text'] } },
  
  // === STATS ===
  { name: 'get_stats', description: 'Hub stats from Oracle VM', inputSchema: { type: 'object', properties: {} } },
  { name: 'export_all', description: 'Export all data', inputSchema: { type: 'object', properties: {} } },
  
  // === GITHUB ===
  { name: 'github_create_repo', description: 'Create GitHub repo', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'github_create_file', description: 'Create/update file in repo', inputSchema: { type: 'object', properties: { repo: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' } }, required: ['repo', 'path', 'content'] } },
  { name: 'github_get_file', description: 'Get file from repo', inputSchema: { type: 'object', properties: { repo: { type: 'string' }, path: { type: 'string' } }, required: ['repo', 'path'] } },
  { name: 'github_list_repos', description: 'List GitHub repos', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'github_delete_file', description: 'Delete file from repo', inputSchema: { type: 'object', properties: { repo: { type: 'string' }, path: { type: 'string' } }, required: ['repo', 'path'] } },
  
  // === TRANSCRIBER ===
  { name: 'transcribe_video', description: 'Transcribe video (YouTube, TikTok). Saves to Oracle VM.', inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'Video URL' }, language: { type: 'string', description: 'auto, ru, en' } }, required: ['url'] } },
  
  // === FILE TOOLS (Oracle VM) ===
  { name: 'vm_list_files', description: '📁 List files in Oracle VM directory', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Directory path (e.g., /home/ubuntu)' } }, required: ['path'] } },
  { name: 'vm_read_file', description: '📄 Read file from Oracle VM', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'File path' } }, required: ['path'] } },
  { name: 'vm_write_file', description: '✏️ Write file to Oracle VM', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'File path' }, content: { type: 'string', description: 'File content' } }, required: ['path', 'content'] } },
  
  // === FILE TOOLS - DELETE ===
  { name: 'vm_delete_file', description: '🗑️ Delete file or folder from Oracle VM', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'File/folder path to delete' } }, required: ['path'] } },

  // === SERVICE MANAGEMENT ===
  { name: 'vm_list_services', description: '🔧 List all grok-* services on Oracle VM', inputSchema: { type: 'object', properties: {} } },
  { name: 'vm_service_status', description: '📊 Check service status', inputSchema: { type: 'object', properties: { service: { type: 'string', description: 'Service name (e.g., grok-voice)' } }, required: ['service'] } },
  { name: 'vm_service_logs', description: '📜 Get service logs', inputSchema: { type: 'object', properties: { service: { type: 'string' }, lines: { type: 'number', description: 'Number of lines (default 50)' } }, required: ['service'] } },
  { name: 'vm_restart_service', description: '🔄 Restart service on Oracle VM', inputSchema: { type: 'object', properties: { service: { type: 'string', description: 'Service name' } }, required: ['service'] } },
  { name: 'vm_stop_service', description: '⏹️ Stop service', inputSchema: { type: 'object', properties: { service: { type: 'string' } }, required: ['service'] } },
  { name: 'vm_start_service', description: '▶️ Start service', inputSchema: { type: 'object', properties: { service: { type: 'string' } }, required: ['service'] } },

  // === SERVICE CREATION & EDITING ===
  { name: 'vm_create_service', description: '🆕 Create new service from Python code', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Service name (without grok- prefix)' }, code: { type: 'string', description: 'Python code' }, port: { type: 'number' }, description: { type: 'string' } }, required: ['name', 'code'] } },
  { name: 'vm_delete_service', description: '🗑️ Delete service completely', inputSchema: { type: 'object', properties: { service: { type: 'string' }, delete_files: { type: 'boolean', description: 'Also delete Python file (default true)' } }, required: ['service'] } },
  { name: 'vm_edit_service', description: '✏️ Edit service Python code', inputSchema: { type: 'object', properties: { service: { type: 'string' }, code: { type: 'string', description: 'New Python code' }, restart: { type: 'boolean', description: 'Restart after edit (default true)' } }, required: ['service', 'code'] } },

  // === CODE EXECUTION ===
  { name: 'vm_run_code', description: '🐍 Run Python code on Oracle VM', inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'Python code to execute' }, timeout: { type: 'number', description: 'Timeout in seconds (max 60)' } }, required: ['code'] } },
  { name: 'vm_check_code', description: '🔍 Check Python code for syntax errors', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },

  // === DIAGNOSTICS ===
  { name: 'vm_diagnose_service', description: '🩺 Full diagnostic for a service (status, logs, errors, syntax)', inputSchema: { type: 'object', properties: { service: { type: 'string' } }, required: ['service'] } },
  { name: 'vm_diagnose_all', description: '🏥 Health check all services', inputSchema: { type: 'object', properties: {} } },

  // === DEPLOY ===
  { name: 'vm_deploy_html', description: '🚀 Deploy HTML/CSS/JS to Oracle VM web', inputSchema: { type: 'object', properties: { filename: { type: 'string' }, content: { type: 'string' }, subdomain: { type: 'string' } }, required: ['filename', 'content'] } },

  // === GITHUB SYNC ===
  { name: 'vm_backup_to_github', description: '☁️ Backup service to GitHub', inputSchema: { type: 'object', properties: { service: { type: 'string', description: 'Service name (e.g., grok-voice)' } }, required: ['service'] } },
  { name: 'vm_restore_from_github', description: '⬇️ Restore service from GitHub backup', inputSchema: { type: 'object', properties: { service: { type: 'string' } }, required: ['service'] } },
  { name: 'vm_backup_all_to_github', description: '☁️ Backup ALL services to GitHub', inputSchema: { type: 'object', properties: {} } },

  // === FULL PROJECT BACKUP ===
  { name: 'vm_backup_project', description: '📦 Backup service as FULL PROJECT (code, requirements, .env.example, service config, README)', inputSchema: { type: 'object', properties: { service: { type: 'string', description: 'Service name (e.g., grok-voice)' } }, required: ['service'] } },
  { name: 'vm_backup_all_projects', description: '📦 Backup ALL services as full projects to GitHub', inputSchema: { type: 'object', properties: {} } },
  { name: 'vm_services_mapping', description: '🗺️ Get mapping of all services to their Python files', inputSchema: { type: 'object', properties: {} } }
];

// TOOL EXECUTION
async function executeTool(name, args) {
  switch (name) {
    // === NOTES ===
    case 'save_note': {
      const note = { id: Date.now(), title: args.title, content: args.content, tags: args.tags || [], date: new Date().toISOString() };
      await fetchOracle('/notes', 'POST', note);
      return '✅ Note saved: ' + args.title;
    }
    case 'get_notes': {
      const notes = await fetchOracle('/notes');
      if (!notes || !notes.length) return 'No notes';
      const limit = args.limit || 10;
      return notes.slice(0, limit).map((x, i) => '[' + (i+1) + '] ' + x.title + '\n' + (x.content || '').slice(0, 500)).join('\n\n---\n\n');
    }
    case 'search_notes': {
      const notes = await fetchOracle('/notes');
      const q = args.query.toLowerCase();
      const f = (notes || []).filter(n => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q));
      if (!f.length) return 'Nothing found for: ' + args.query;
      return f.map(n => n.title + '\n' + (n.content || '').slice(0, 300)).join('\n\n---\n\n');
    }
    
    // === TASKS ===
    case 'add_task': {
      const task = { id: Date.now(), title: args.title, priority: args.priority || 'medium', due: args.due, done: false };
      await fetchOracle('/tasks', 'POST', task);
      return '✅ Task added: ' + args.title;
    }
    case 'get_tasks': {
      let tasks = await fetchOracle('/tasks');
      if (!tasks || !tasks.length) return 'No tasks';
      if (args.status === 'pending') tasks = tasks.filter(x => !x.done);
      if (args.status === 'done') tasks = tasks.filter(x => x.done);
      const prio = { high: '🔴', medium: '🟡', low: '🟢' };
      return tasks.map(t => (t.done ? '✅' : '⬜') + ' [' + t.id + '] ' + (prio[t.priority] || '⚪') + ' ' + t.title + (t.due ? ' (до ' + t.due + ')' : '')).join('\n');
    }
    case 'complete_task': {
      const data = await fetchOracle('/data');
      const task = (data.tasks || []).find(t => t.id === args.id);
      if (!task) return '❌ Task not found: ' + args.id;
      task.done = true;
      await fetchOracle('/sync', 'PUT', data);
      return '✅ Task completed: ' + task.title;
    }
    
    // === AI TOOLS ===
    case 'add_tool': {
      const tool = { id: Date.now(), name: args.name, description: args.description, category: args.category, rating: args.rating || 0 };
      await fetchOracle('/tools', 'POST', tool);
      return '✅ Tool added: ' + args.name;
    }
    case 'search_tools': {
      const tools = await fetchOracle('/tools');
      if (!tools || !tools.length) return 'No tools';
      let filtered = tools;
      if (args.query) {
        const q = args.query.toLowerCase();
        filtered = tools.filter(x => (x.name || '').toLowerCase().includes(q) || (x.description || '').toLowerCase().includes(q));
      }
      if (!filtered.length) return 'No tools found';
      return filtered.map(x => '⭐' + (x.rating || 0) + ' ' + x.name + ' [' + x.category + '] - ' + x.description).join('\n');
    }
    case 'get_top_tools': {
      const tools = await fetchOracle('/tools');
      if (!tools || !tools.length) return 'No tools';
      const sorted = tools.sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, args.limit || 5);
      return sorted.map((x, i) => (i+1) + '. ⭐' + (x.rating || 0) + ' ' + x.name + ' - ' + x.description).join('\n');
    }
    
    // === NEWS ===
    case 'get_news': {
      const news = await fetchOracle('/news');
      if (!news || !news.length) return 'No news';
      const limit = args.limit || 5;
      return news.slice(0, limit).map(x => '📰 ' + x.title + '\n' + (x.text || '').slice(0, 200)).join('\n\n');
    }
    case 'add_news': {
      const item = { id: Date.now(), title: args.title, text: args.text, date: new Date().toISOString() };
      await fetchOracle('/news', 'POST', item);
      return '✅ News added: ' + args.title;
    }
    
    // === STATS ===
    case 'get_stats': {
      const stats = await fetchOracle('/stats');
      return '📊 Oracle VM Hub Stats:\n\n• Notes: ' + stats.notes + '\n• Tasks: ' + stats.tasks + '\n• Tools: ' + stats.tools + '\n• News: ' + stats.news;
    }
    case 'export_all': {
      const data = await fetchOracle('/data');
      return JSON.stringify(data, null, 2);
    }
    
    // === GITHUB ===
    case 'github_create_repo': {
      if (!GITHUB_TOKEN) return '❌ GITHUB_TOKEN not set';
      const r = await githubCreateRepo(args.name, args.description, args.private);
      return r.html_url ? '✅ Repo created: ' + r.html_url : '❌ Error: ' + JSON.stringify(r);
    }
    case 'github_create_file': {
      if (!GITHUB_TOKEN) return '❌ GITHUB_TOKEN not set';
      const r = await githubCreateFile(args.repo, args.path, args.content, args.message, args.branch);
      return r.content && r.content.html_url ? '✅ File: ' + r.content.html_url : '❌ Error: ' + JSON.stringify(r);
    }
    case 'github_get_file': {
      if (!GITHUB_TOKEN) return '❌ GITHUB_TOKEN not set';
      const r = await githubGetFile(args.repo, args.path, args.branch);
      return r.decoded || r.message || JSON.stringify(r);
    }
    case 'github_list_repos': {
      if (!GITHUB_TOKEN) return '❌ GITHUB_TOKEN not set';
      const r = await githubListRepos(args.limit);
      if (!Array.isArray(r)) return '❌ Error: ' + JSON.stringify(r);
      return r.map(x => '📁 ' + x.name + (x.private ? ' 🔒' : '')).join('\n');
    }
    case 'github_delete_file': {
      if (!GITHUB_TOKEN) return '❌ GITHUB_TOKEN not set';
      const r = await githubDeleteFile(args.repo, args.path, args.message, args.branch);
      return r.commit ? '✅ Deleted: ' + args.path : '❌ Error: ' + JSON.stringify(r);
    }
    
    // === TRANSCRIBER ===
    case 'transcribe_video': {
      if (!GEMINI_API_KEY) return '❌ GEMINI_API_KEY not set';
      try {
        const r = await transcribeVideo(args.url, args.language, args.provider);
        if (r.status === 'success') {
          const videoTitle = r.title || args.url.split('/').pop() || 'Video';
          const note = {
            id: Date.now(),
            title: '🎬 Transcription: ' + videoTitle,
            content: r.transcript,
            summary: r.summary || '',
            url: args.url,
            date: new Date().toISOString(),
            tags: ['transcription', 'video']
          };
          await fetchOracle('/notes', 'POST', note);
          
          let resp = '=== ✅ TRANSCRIPTION SAVED ===\n';
          resp += 'URL: ' + args.url + '\n\n';
          if (r.summary) resp += 'SUMMARY:\n' + r.summary + '\n\n';
          resp += 'FULL TEXT:\n' + r.transcript;
          return resp;
        }
        return '❌ Error: ' + (r.message || JSON.stringify(r));
      } catch (e) {
        return '❌ Error: ' + e.message;
      }
    }
    
    // === FILE TOOLS (Oracle VM) ===
    case 'vm_list_files': {
      const r = await fetchOracleAdmin('/files/list', 'POST', { path: args.path });
      if (r.error) return '❌ Error: ' + r.error;
      if (r.files) return '📁 Files in ' + args.path + ':\n\n' + r.files.map(f => (f.isDir ? '📁 ' : '📄 ') + f.name).join('\n');
      return JSON.stringify(r);
    }
    case 'vm_read_file': {
      const r = await fetchOracleAdmin('/files/read', 'POST', { path: args.path });
      if (r.error) return '❌ Error: ' + r.error;
      if (r.content) return '📄 ' + args.path + ':\n\n' + r.content;
      return JSON.stringify(r);
    }
    case 'vm_write_file': {
      const r = await fetchOracleAdmin('/files/write', 'POST', { path: args.path, content: args.content });
      if (r.error) return '❌ Error: ' + r.error;
      if (r.success) return '✅ File written: ' + args.path;
      return JSON.stringify(r);
    }
    
    // === EMERGENCY TOOLS (Oracle VM) ===
    case 'vm_list_services': {
      const r = await fetchOracleAdmin('/services/list');
      if (r.error) return '❌ Error: ' + r.error;
      if (r.services) return '🔧 Services:\n\n' + r.services.map(s => (s.active ? '🟢' : '🔴') + ' ' + s.name + ' - ' + s.description).join('\n');
      return JSON.stringify(r);
    }
    case 'vm_service_status': {
      const r = await fetchOracleAdmin('/services/status', 'POST', { service: args.service });
      if (r.error) return '❌ Error: ' + r.error;
      if (r.status) return '📊 ' + args.service + ': ' + (r.active ? '🟢 Running' : '🔴 Stopped') + '\n\n' + r.status;
      return JSON.stringify(r);
    }
    case 'vm_service_logs': {
      const r = await fetchOracleAdmin('/services/logs', 'POST', { service: args.service, lines: args.lines || 30 });
      if (r.error) return '❌ Error: ' + r.error;
      if (r.logs) return '📜 Logs for ' + args.service + ':\n\n' + r.logs;
      return JSON.stringify(r);
    }
    case 'vm_restart_service': {
      const r = await fetchOracleAdmin('/services/restart', 'POST', { service: args.service });
      if (r.error) return '❌ Error: ' + r.error;
      if (r.success) return '✅ Service restarted: ' + args.service;
      return JSON.stringify(r);
    }
    case 'vm_deploy_html': {
      const r = await fetchOracleAdmin('/deploy/html', 'POST', {
        filename: args.filename,
        content: args.content,
        subdomain: args.subdomain
      });
      if (r.error) return '❌ Error: ' + r.error;
      if (r.url) return '✅ Deployed: ' + r.url;
      return JSON.stringify(r);
    }

    // === FILE DELETE ===
    case 'vm_delete_file': {
      const r = await fetchOracleAdmin('/files/delete', 'POST', { path: args.path });
      if (r.error) return '❌ Error: ' + r.error;
      if (r.success) return '✅ Deleted: ' + args.path;
      return JSON.stringify(r);
    }

    // === SERVICE STOP/START ===
    case 'vm_stop_service': {
      const r = await fetchOracleAdmin('/services/stop', 'POST', { service: args.service });
      if (r.error) return '❌ Error: ' + r.error;
      if (r.success) return '⏹️ Service stopped: ' + args.service;
      return JSON.stringify(r);
    }
    case 'vm_start_service': {
      const r = await fetchOracleAdmin('/services/start', 'POST', { service: args.service });
      if (r.error) return '❌ Error: ' + r.error;
      if (r.success) return '▶️ Service started: ' + args.service;
      return JSON.stringify(r);
    }

    // === SERVICE CREATION (with GitHub backup) ===
    case 'vm_create_service': {
      const r = await fetchOracleAdmin('/services/create', 'POST', {
        name: args.name, code: args.code, port: args.port,
        description: args.description || ('Service ' + args.name)
      });
      if (r.error) return '❌ Error: ' + r.error + (r.traceback ? '\n\n' + r.traceback : '');
      if (r.success) {
        let msg = '✅ Service created: ' + r.service + '\n📄 Python: ' + r.python_file + '\n📊 ' + (r.active ? '🟢 Running' : '🔴 Not running');
        // Auto-backup to GitHub
        if (GITHUB_TOKEN) {
          try {
            const ghResult = await githubCreateFile('oracle-services', r.service + '.py', args.code, 'Create service: ' + r.service);
            if (ghResult.content) msg += '\n☁️ GitHub: backed up';
          } catch (e) { msg += '\n⚠️ GitHub backup failed'; }
        }
        return msg;
      }
      return JSON.stringify(r);
    }

    // === SERVICE DELETION ===
    case 'vm_delete_service': {
      const r = await fetchOracleAdmin('/services/delete', 'POST', {
        service: args.service, delete_files: args.delete_files !== false
      });
      if (r.error) return '❌ Error: ' + r.error;
      if (r.success) {
        let msg = '🗑️ Service deleted: ' + r.deleted + (r.files_deleted ? '\n📄 Python file deleted' : '');
        // Also delete from GitHub if requested
        if (GITHUB_TOKEN && args.delete_from_github !== false) {
          try {
            await githubDeleteFile('oracle-services', args.service + '.py', 'Delete service: ' + args.service);
            msg += '\n☁️ GitHub: removed';
          } catch (e) { /* ignore if not exists */ }
        }
        return msg;
      }
      return JSON.stringify(r);
    }

    // === SERVICE EDITING (with GitHub backup) ===
    case 'vm_edit_service': {
      const r = await fetchOracleAdmin('/services/edit', 'POST', {
        service: args.service, code: args.code, restart: args.restart !== false
      });
      if (r.error) return '❌ Error: ' + r.error;
      if (r.success) {
        let msg = '✅ Edited: ' + r.service + '\n🔄 Restarted: ' + (r.restarted ? 'Yes' : 'No') + '\n📊 ' + (r.active ? '🟢 Running' : '🔴 Not running');
        // Auto-backup to GitHub
        if (GITHUB_TOKEN) {
          try {
            const ghResult = await githubCreateFile('oracle-services', args.service + '.py', args.code, 'Update service: ' + args.service);
            if (ghResult.content) msg += '\n☁️ GitHub: updated';
          } catch (e) { msg += '\n⚠️ GitHub backup failed'; }
        }
        return msg;
      }
      return JSON.stringify(r);
    }

    // === BACKUP SERVICE TO GITHUB ===
    case 'vm_backup_to_github': {
      if (!GITHUB_TOKEN) return '❌ GITHUB_TOKEN not set';
      const fileResult = await fetchOracleAdmin('/files/read', 'POST', { path: '/home/ubuntu/grok-voice/' + args.service + '.py' });
      if (fileResult.error) return '❌ Error reading file: ' + fileResult.error;
      try {
        const ghResult = await githubCreateFile('oracle-services', args.service + '.py', fileResult.content, 'Backup: ' + args.service);
        if (ghResult.content) return '☁️ Backed up to GitHub: ' + args.service + '.py\n🔗 ' + ghResult.content.html_url;
        return '❌ GitHub error: ' + JSON.stringify(ghResult);
      } catch (e) {
        return '❌ Error: ' + e.message;
      }
    }

    // === RESTORE SERVICE FROM GITHUB ===
    case 'vm_restore_from_github': {
      if (!GITHUB_TOKEN) return '❌ GITHUB_TOKEN not set';
      try {
        const ghFile = await githubGetFile('oracle-services', args.service + '.py');
        if (!ghFile.decoded) return '❌ File not found on GitHub: ' + args.service + '.py';
        // Write to VM and restart
        const writeResult = await fetchOracleAdmin('/files/write', 'POST', {
          path: '/home/ubuntu/grok-voice/' + args.service + '.py',
          content: ghFile.decoded
        });
        if (writeResult.error) return '❌ Error writing: ' + writeResult.error;
        // Restart service
        await fetchOracleAdmin('/services/restart', 'POST', { service: args.service });
        return '✅ Restored from GitHub: ' + args.service + '\n🔄 Service restarted';
      } catch (e) {
        return '❌ Error: ' + e.message;
      }
    }

    // === BACKUP ALL PYTHON FILES TO GITHUB ===
    case 'vm_backup_all_to_github': {
      if (!GITHUB_TOKEN) return '❌ GITHUB_TOKEN not set';
      // List all .py files in grok-voice directory
      const files = await fetchOracleAdmin('/files/list', 'POST', { path: '/home/ubuntu/grok-voice' });
      if (files.error) return '❌ Error: ' + files.error;
      const pyFiles = (files.items || []).filter(f => f.name.endsWith('.py'));
      if (!pyFiles.length) return '❌ No Python files found';

      let msg = '☁️ Backing up Python files to GitHub:\n\n';
      let success = 0, failed = 0;
      for (const f of pyFiles) {
        try {
          const fileResult = await fetchOracleAdmin('/files/read', 'POST', { path: '/home/ubuntu/grok-voice/' + f.name });
          if (fileResult.content) {
            await githubCreateFile('oracle-services', f.name, fileResult.content, 'Backup: ' + f.name);
            msg += '✅ ' + f.name + '\n';
            success++;
          }
        } catch (e) { msg += '❌ ' + f.name + '\n'; failed++; }
      }
      msg += '\n📊 Done: ' + success + ' backed up, ' + failed + ' failed';
      return msg;
    }

    // === BACKUP SPECIFIC FILE TO GITHUB ===
    case 'vm_backup_file_to_github': {
      if (!GITHUB_TOKEN) return '❌ GITHUB_TOKEN not set';
      const filename = args.filename || (args.service + '.py');
      const fileResult = await fetchOracleAdmin('/files/read', 'POST', { path: '/home/ubuntu/grok-voice/' + filename });
      if (fileResult.error) return '❌ Error: ' + fileResult.error;
      try {
        const ghResult = await githubCreateFile('oracle-services', filename, fileResult.content, 'Backup: ' + filename);
        if (ghResult.content) return '☁️ Backed up: ' + filename + '\n🔗 ' + ghResult.content.html_url;
        return '❌ GitHub error: ' + JSON.stringify(ghResult);
      } catch (e) {
        return '❌ Error: ' + e.message;
      }
    }

    // === FULL PROJECT BACKUP ===
    case 'vm_backup_project': {
      if (!GITHUB_TOKEN) return '❌ GITHUB_TOKEN not set';
      const svcName = args.service.startsWith('grok-') ? args.service : 'grok-' + args.service;
      const folder = svcName + '/';
      let msg = '📦 Project backup: ' + svcName + '\n\n';
      let files = 0;

      // 1. Get service info to find Python file
      const svcInfo = await fetchOracleAdmin('/services/info', 'POST', { service: svcName });
      let pyFile = null, pyContent = null, port = null, description = svcName;

      if (svcInfo.python_filename) {
        pyFile = svcInfo.python_filename;
        description = svcInfo.description || svcName;
        port = svcInfo.port;
        // Read Python file
        const r = await fetchOracleAdmin('/files/read', 'POST', { path: svcInfo.python_file });
        pyContent = r.content;
      }

      // Fallback: search in directory
      if (!pyContent) {
        const fileList = await fetchOracleAdmin('/files/list', 'POST', { path: '/home/ubuntu/grok-voice' });
        const pyFiles = (fileList.items || []).filter(f => f.name.endsWith('.py'));

        // Try exact match first
        for (const f of pyFiles) {
          if (f.name === svcName + '.py') {
            pyFile = f.name;
            break;
          }
        }
        if (pyFile) {
          const r = await fetchOracleAdmin('/files/read', 'POST', { path: '/home/ubuntu/grok-voice/' + pyFile });
          pyContent = r.content;
        }
      }

      if (!pyContent) return '❌ Python file not found for service: ' + svcName;

      // Upload Python file
      try {
        await githubCreateFile('oracle-services', folder + pyFile, pyContent, 'Backup project: ' + pyFile);
        msg += '✅ ' + pyFile + '\n';
        files++;
      } catch (e) { msg += '❌ ' + pyFile + ': ' + e.message + '\n'; }

      // 2. Generate requirements.txt
      const requirements = extractRequirements(pyContent);
      if (requirements.length) {
        const reqContent = requirements.join('\n') + '\n';
        try {
          await githubCreateFile('oracle-services', folder + 'requirements.txt', reqContent, 'Add requirements.txt');
          msg += '✅ requirements.txt (' + requirements.length + ' deps)\n';
          files++;
        } catch (e) { msg += '❌ requirements.txt\n'; }
      }

      // 3. Generate .env.example
      const envVars = extractEnvVars(pyContent);
      if (envVars.length) {
        const envContent = generateEnvExample(envVars, svcName);
        try {
          await githubCreateFile('oracle-services', folder + '.env.example', envContent, 'Add .env.example');
          msg += '✅ .env.example (' + envVars.length + ' vars: ' + envVars.join(', ') + ')\n';
          files++;
        } catch (e) { msg += '❌ .env.example\n'; }
      }

      // 4. Read systemd service file from svcInfo
      if (svcInfo.service_file) {
        try {
          await githubCreateFile('oracle-services', folder + svcName + '.service', svcInfo.service_file, 'Add systemd service');
          msg += '✅ ' + svcName + '.service\n';
          files++;
        } catch (e) { msg += '⚠️ ' + svcName + '.service failed\n'; }
      } else {
        msg += '⚠️ No systemd service file\n';
      }

      // 5. Generate README
      const readme = generateReadme(svcName, pyFile, port, description, requirements, envVars);
      try {
        await githubCreateFile('oracle-services', folder + 'README.md', readme, 'Add README');
        msg += '✅ README.md\n';
        files++;
      } catch (e) { msg += '❌ README.md\n'; }

      msg += '\n📊 Total: ' + files + ' files backed up';
      msg += '\n🔗 https://github.com/' + GITHUB_USERNAME + '/oracle-services/tree/main/' + svcName;
      return msg;
    }

    case 'vm_backup_all_projects': {
      if (!GITHUB_TOKEN) return '❌ GITHUB_TOKEN not set';
      const services = await fetchOracleAdmin('/services/list');
      if (services.error) return '❌ Error: ' + services.error;
      if (!services.services || !services.services.length) return '❌ No services found';

      let msg = '📦 Full project backup for all services:\n\n';
      let success = 0, failed = 0;

      for (const svc of services.services) {
        try {
          msg += '---\n📁 ' + svc.name + '\n';
          // Use same logic as vm_backup_project
          const result = await executeTool('vm_backup_project', { service: svc.name });
          if (result.includes('✅')) {
            success++;
            msg += '✅ Done\n';
          } else {
            failed++;
            msg += '⚠️ ' + result.split('\n')[0] + '\n';
          }
        } catch (e) {
          failed++;
          msg += '❌ Error: ' + e.message + '\n';
        }
      }

      msg += '\n📊 Summary: ' + success + ' services backed up, ' + failed + ' failed';
      msg += '\n🔗 https://github.com/' + GITHUB_USERNAME + '/oracle-services';
      return msg;
    }

    case 'vm_services_mapping': {
      const r = await fetchOracleAdmin('/services/mapping');
      if (r.error) return '❌ Error: ' + r.error;
      if (!r.services || !r.services.length) return '❌ No services found';
      let msg = '🗺️ Service → Python file mapping:\n\n';
      for (const svc of r.services) {
        msg += (svc.active ? '🟢' : '🔴') + ' ' + svc.service + ' → ' + (svc.python_filename || '?') + '\n';
        if (svc.description) msg += '   📝 ' + svc.description + '\n';
      }
      return msg;
    }

    // === CODE EXECUTION ===
    case 'vm_run_code': {
      const r = await fetchOracleAdmin('/code/run', 'POST', { code: args.code, timeout: args.timeout || 30 });
      if (r.error && !r.output) return '❌ Error: ' + r.error;
      let msg = '🐍 Python result:\n\n';
      if (r.output) msg += '📤 Output:\n' + r.output;
      if (r.error) msg += '\n⚠️ Stderr:\n' + r.error;
      msg += '\n📊 Exit: ' + r.code;
      return msg;
    }
    case 'vm_check_code': {
      const r = await fetchOracleAdmin('/code/check', 'POST', { code: args.code });
      if (r.valid) return '✅ Syntax OK';
      if (r.error) return '❌ Syntax error:\n' + r.error;
      return JSON.stringify(r);
    }

    // === DIAGNOSTICS ===
    case 'vm_diagnose_service': {
      const r = await fetchOracleAdmin('/diagnose/service', 'POST', { service: args.service });
      if (r.error) return '❌ Error: ' + r.error;
      let msg = '🩺 ' + r.service + ': ' + (r.healthy ? '✅ HEALTHY' : '⚠️ ISSUES') + '\n';
      msg += '📡 ' + (r.is_active ? '🟢 Running' : '🔴 Stopped') + '\n';
      if (r.issues && r.issues.length) msg += '⚠️ Issues:\n' + r.issues.map(i => '• ' + i).join('\n') + '\n';
      if (r.recent_errors && r.recent_errors.trim()) msg += '\n🔴 Errors:\n' + r.recent_errors.slice(0, 800);
      return msg;
    }
    case 'vm_diagnose_all': {
      const r = await fetchOracleAdmin('/diagnose/all');
      if (r.error) return '❌ Error: ' + r.error;
      let msg = '🏥 Health: ' + r.healthy + '/' + r.total + ' healthy\n\n';
      if (r.services) msg += r.services.map(s => (s.healthy ? '🟢' : '🔴') + ' ' + s.name).join('\n');
      return msg;
    }

    default:
      return '❌ Unknown tool: ' + name;
  }
}

// ENDPOINTS
app.get('/', (req, res) => res.json({
  status: 'ok',
  name: 'MCP Hub v3.2 + Full Project Backup',
  tools: MCP_TOOLS.length,
  storage: 'Oracle VM',
  features: ['notes', 'tasks', 'github', 'transcriber', 'vm_files', 'vm_services', 'project_backup']
}));

app.get('/mcp/tools', (req, res) => res.json({ tools: MCP_TOOLS }));

app.post('/mcp/execute', async (req, res) => {
  try {
    const r = await executeTool(req.body.name, req.body.arguments || {});
    res.json({ result: r });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// Direct transcribe endpoint
app.post('/transcribe', async (req, res) => {
  const { url, language, provider } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    const r = await executeTool('transcribe_video', { url, language, provider });
    res.json({ result: r });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/transcribe', async (req, res) => {
  const { url, language, provider } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required. Use: /transcribe?url=VIDEO_URL' });
  try {
    const r = await executeTool('transcribe_video', { url, language, provider });
    res.json({ result: r });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// === MONITOR PAGE ===
const MONITOR_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🖥️ Oracle Services Monitor</title>
    <meta name="theme-color" content="#1a1a2e">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            color: #fff;
            padding: 20px;
        }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { text-align: center; margin-bottom: 10px; font-size: 1.8em; }
        .subtitle { text-align: center; color: #888; margin-bottom: 20px; }
        .status-card {
            background: rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 15px;
            backdrop-filter: blur(10px);
        }
        .service {
            display: flex;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .service:last-child { border-bottom: none; }
        .service-status {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 12px;
            animation: pulse 2s infinite;
        }
        .service-status.online { background: #00ff88; box-shadow: 0 0 10px #00ff88; }
        .service-status.offline { background: #ff4757; box-shadow: 0 0 10px #ff4757; animation: none; }
        .service-status.checking { background: #ffa502; }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .service-name { flex: 1; font-weight: 500; }
        .service-file { color: #888; font-size: 0.85em; }
        .summary {
            display: flex;
            justify-content: space-around;
            text-align: center;
            margin-bottom: 20px;
        }
        .summary-item h2 { font-size: 2em; }
        .summary-item p { color: #888; font-size: 0.9em; }
        .btn {
            width: 100%;
            padding: 16px;
            border: none;
            border-radius: 12px;
            font-size: 1em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            margin-bottom: 10px;
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .btn-primary:hover { transform: scale(1.02); }
        .btn-secondary {
            background: rgba(255,255,255,0.1);
            color: white;
        }
        .notification-status {
            text-align: center;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 15px;
            font-size: 0.9em;
        }
        .notification-status.subscribed { background: rgba(0,255,136,0.2); color: #00ff88; }
        .notification-status.not-subscribed { background: rgba(255,71,87,0.2); color: #ff4757; }
        .last-check {
            text-align: center;
            color: #666;
            font-size: 0.85em;
            margin-top: 15px;
        }
        .logs {
            background: #0d0d0d;
            border-radius: 8px;
            padding: 15px;
            font-family: monospace;
            font-size: 0.8em;
            max-height: 200px;
            overflow-y: auto;
            margin-top: 15px;
        }
        .log-entry { padding: 3px 0; border-bottom: 1px solid #222; }
        .log-ok { color: #00ff88; }
        .log-error { color: #ff4757; }
        .log-info { color: #ffa502; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🖥️ Oracle Monitor</h1>
        <p class="subtitle">Мониторинг сервисов с Push-уведомлениями</p>
        <div class="summary">
            <div class="summary-item">
                <h2 id="online-count">-</h2>
                <p>🟢 Онлайн</p>
            </div>
            <div class="summary-item">
                <h2 id="offline-count">-</h2>
                <p>🔴 Офлайн</p>
            </div>
            <div class="summary-item">
                <h2 id="total-count">-</h2>
                <p>📊 Всего</p>
            </div>
        </div>
        <div id="notification-status" class="notification-status not-subscribed">
            🔕 Уведомления отключены
        </div>
        <button id="subscribe-btn" class="btn btn-primary" onclick="toggleSubscription()">
            🔔 Включить уведомления
        </button>
        <button class="btn btn-secondary" onclick="checkNow()">
            🔄 Проверить сейчас
        </button>
        <div class="status-card">
            <div id="services-list">
                <div class="service">
                    <div class="service-status checking"></div>
                    <span class="service-name">Загрузка...</span>
                </div>
            </div>
        </div>
        <p class="last-check">Последняя проверка: <span id="last-check-time">-</span></p>
        <div class="logs" id="logs">
            <div class="log-entry log-info">🚀 Монитор запущен...</div>
        </div>
    </div>
    <script>
        const API_URL = '';
        const CHECK_INTERVAL = 5 * 60 * 1000;
        let isSubscribed = false;
        let lastStatuses = {};

        function log(message, type = 'info') {
            const logs = document.getElementById('logs');
            const time = new Date().toLocaleTimeString();
            const typeClass = type === 'ok' ? 'log-ok' : type === 'error' ? 'log-error' : 'log-info';
            logs.innerHTML = '<div class="log-entry ' + typeClass + '">[' + time + '] ' + message + '</div>' + logs.innerHTML;
        }

        async function checkServices() {
            try {
                log('🔍 Проверка сервисов...');
                const response = await fetch(API_URL + '/mcp/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'vm_diagnose_all', arguments: {} })
                });
                const data = await response.json();
                const result = data.result || '';
                const healthMatch = result.match(/Health: (\\d+)\\/(\\d+)/);
                let online = 0, total = 0;
                if (healthMatch) {
                    online = parseInt(healthMatch[1]);
                    total = parseInt(healthMatch[2]);
                }
                document.getElementById('online-count').textContent = online;
                document.getElementById('offline-count').textContent = total - online;
                document.getElementById('total-count').textContent = total;
                const mappingResponse = await fetch(API_URL + '/mcp/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'vm_services_mapping', arguments: {} })
                });
                const mappingData = await mappingResponse.json();
                updateServicesList(mappingData.result);
                document.getElementById('last-check-time').textContent = new Date().toLocaleTimeString();
                log('✅ Проверка завершена: ' + online + '/' + total + ' онлайн', online === total ? 'ok' : 'error');
                checkForChanges(mappingData.result);
            } catch (error) {
                log('❌ Ошибка: ' + error.message, 'error');
            }
        }

        function updateServicesList(result) {
            const container = document.getElementById('services-list');
            const lines = result.split('\\n').filter(l => l.includes('→'));
            let html = '';
            lines.forEach(line => {
                const isOnline = line.includes('🟢');
                const match = line.match(/[🟢🔴]\\s+(\\S+)\\s+→\\s+(\\S+)/);
                if (match) {
                    const name = match[1];
                    const file = match[2];
                    html += '<div class="service"><div class="service-status ' + (isOnline ? 'online' : 'offline') + '"></div><div><div class="service-name">' + name + '</div><div class="service-file">' + file + '</div></div></div>';
                    lastStatuses[name] = isOnline;
                }
            });
            container.innerHTML = html || '<div class="service"><span>Нет данных</span></div>';
        }

        function checkForChanges(result) {
            if (!isSubscribed) return;
            const lines = result.split('\\n').filter(l => l.includes('→'));
            lines.forEach(line => {
                const isOnline = line.includes('🟢');
                const match = line.match(/[🟢🔴]\\s+(\\S+)\\s+→/);
                if (match) {
                    const name = match[1];
                    if (lastStatuses[name] === true && !isOnline) {
                        sendNotification('🔴 ' + name + ' упал!', 'Сервис ' + name + ' перестал отвечать');
                    } else if (lastStatuses[name] === false && isOnline) {
                        sendNotification('🟢 ' + name + ' восстановлен', 'Сервис ' + name + ' снова работает');
                    }
                }
            });
        }

        async function toggleSubscription() {
            if (!('Notification' in window)) {
                alert('Ваш браузер не поддерживает уведомления');
                return;
            }
            if (isSubscribed) {
                isSubscribed = false;
                updateSubscriptionUI();
                log('🔕 Уведомления отключены');
                localStorage.removeItem('push-subscribed');
            } else {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    isSubscribed = true;
                    updateSubscriptionUI();
                    log('🔔 Уведомления включены!', 'ok');
                    localStorage.setItem('push-subscribed', 'true');
                    sendNotification('🔔 Уведомления включены!', 'Вы будете получать алерты при падении сервисов');
                } else {
                    log('❌ Разрешение на уведомления отклонено', 'error');
                }
            }
        }

        function updateSubscriptionUI() {
            const status = document.getElementById('notification-status');
            const btn = document.getElementById('subscribe-btn');
            if (isSubscribed) {
                status.className = 'notification-status subscribed';
                status.textContent = '🔔 Уведомления включены';
                btn.textContent = '🔕 Отключить уведомления';
            } else {
                status.className = 'notification-status not-subscribed';
                status.textContent = '🔕 Уведомления отключены';
                btn.textContent = '🔔 Включить уведомления';
            }
        }

        function sendNotification(title, body) {
            if (!isSubscribed || Notification.permission !== 'granted') return;
            const notification = new Notification(title, {
                body: body,
                icon: '🖥️',
                vibrate: [200, 100, 200],
                tag: 'oracle-monitor',
                renotify: true
            });
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }

        function checkNow() {
            checkServices();
        }

        window.onload = () => {
            if (localStorage.getItem('push-subscribed') === 'true' && Notification.permission === 'granted') {
                isSubscribed = true;
                updateSubscriptionUI();
            }
            checkServices();
            setInterval(checkServices, CHECK_INTERVAL);
            log('⏰ Автопроверка каждые 5 минут');
        };
    </script>
</body>
</html>`;

app.get('/monitor', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(MONITOR_HTML);
});

// MCP endpoint for Claude Connectors
app.get('/mcp', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.write('data: ' + JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n\n');
});

app.post('/mcp', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { method, params, id } = req.body;
  if (method === 'initialize') {
    return res.json({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mcp-hub', version: '3.1.0' } } });
  }
  if (method === 'tools/list') {
    return res.json({ jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } });
  }
  if (method === 'tools/call') {
    const r = await executeTool(params.name, params.arguments || {});
    return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: r }] } });
  }
  res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
});

app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.write('data: ' + JSON.stringify({ type: 'connected', tools: MCP_TOOLS.length, storage: 'Oracle VM' }) + '\n\n');
});

app.post('/message', async (req, res) => {
  const { method, params, id } = req.body;
  if (method === 'tools/list') {
    return res.json({ jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } });
  }
  if (method === 'tools/call') {
    const r = await executeTool(params.name, params.arguments || {});
    return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: r }] } });
  }
  res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('MCP Hub v3.2 + Full Project Backup on port ' + PORT);
  console.log('Oracle Storage: ' + ORACLE_HUB_API);
  console.log('Oracle Admin: ' + ORACLE_ADMIN_API);
  console.log('Transcriber: ' + TRANSCRIBER_URL);
  console.log('Tools: ' + MCP_TOOLS.length);
});
