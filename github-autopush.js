#!/usr/bin/env node
/**
 * GitHub Auto-Push Agent
 *
 * Автоматически пушит изменения MCP-HUB на GitHub
 * Создаёт красивую историю коммитов для портфолио
 *
 * Usage:
 *   node github-autopush.js              # Push all changes
 *   node github-autopush.js --init       # Initialize repo
 *   node github-autopush.js --status     # Check status
 */

const fs = require('fs');
const path = require('path');

// Configuration
const GITHUB_API = 'https://api.github.com';
const REPO_NAME = 'oracle-vm-agent';
const REPO_DESC = '🎯 Universal Voice Agent for Oracle VM Management - Claude/Anthropic Powered';

// Files to sync
const SYNC_FILES = [
  'README.md',
  'index.js',
  'oracle-dual-vm.js',
  'oracle-admin-api.py',
  'oracle-agent-api.js',
  'todo-api.js',
  'CLAUDE.md',
  'UNIVERSAL_AGENT_SPEC.md',
  'package.json',
  '.env.example',
  'github-autopush.js'
];

// Load environment
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;

if (!GITHUB_TOKEN || !GITHUB_USERNAME) {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🔑 GitHub credentials required!                              ║
╠══════════════════════════════════════════════════════════════╣
║  Create .env file with:                                       ║
║                                                               ║
║  GITHUB_TOKEN=ghp_your_personal_access_token                  ║
║  GITHUB_USERNAME=your_github_username                         ║
║                                                               ║
║  Get token: https://github.com/settings/tokens                ║
║  Scopes needed: repo (full control)                           ║
╚══════════════════════════════════════════════════════════════╝
  `);
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'MCP-Hub-Agent'
};

async function githubRequest(endpoint, method = 'GET', body = null) {
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${GITHUB_API}${endpoint}`, options);
  return res.json();
}

async function repoExists() {
  const res = await githubRequest(`/repos/${GITHUB_USERNAME}/${REPO_NAME}`);
  return !res.message;
}

async function createRepo() {
  console.log('📦 Creating repository...');
  const res = await githubRequest('/user/repos', 'POST', {
    name: REPO_NAME,
    description: REPO_DESC,
    private: false,
    auto_init: true,
    homepage: `https://${GITHUB_USERNAME}.github.io/${REPO_NAME}`
  });

  if (res.html_url) {
    console.log(`✅ Created: ${res.html_url}`);
    return true;
  }
  console.log(`❌ Error: ${res.message}`);
  return false;
}

async function getFileSha(filePath) {
  const res = await githubRequest(`/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${filePath}`);
  return res.sha || null;
}

async function uploadFile(filePath, content, message) {
  const sha = await getFileSha(filePath);

  const body = {
    message: message || `Update ${filePath}`,
    content: Buffer.from(content).toString('base64'),
    branch: 'main'
  };

  if (sha) body.sha = sha;

  const res = await githubRequest(
    `/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${filePath}`,
    'PUT',
    body
  );

  return res.content ? true : false;
}

async function syncAll() {
  console.log('🔄 Syncing files to GitHub...\n');

  let success = 0, failed = 0;
  const timestamp = new Date().toISOString().split('T')[0];

  for (const file of SYNC_FILES) {
    const localPath = path.join(__dirname, file);

    if (!fs.existsSync(localPath)) {
      console.log(`⏭️  ${file} (not found)`);
      continue;
    }

    const content = fs.readFileSync(localPath, 'utf8');
    const message = `🤖 Auto-sync: ${file} [${timestamp}]`;

    process.stdout.write(`📤 ${file}... `);

    if (await uploadFile(file, content, message)) {
      console.log('✅');
      success++;
    } else {
      console.log('❌');
      failed++;
    }
  }

  console.log(`\n📊 Done: ${success} uploaded, ${failed} failed`);
  console.log(`🔗 https://github.com/${GITHUB_USERNAME}/${REPO_NAME}`);
}

async function showStatus() {
  console.log('📊 GitHub Status\n');

  const exists = await repoExists();
  console.log(`Repository: ${exists ? '✅ Exists' : '❌ Not found'}`);

  if (exists) {
    const repo = await githubRequest(`/repos/${GITHUB_USERNAME}/${REPO_NAME}`);
    console.log(`URL: ${repo.html_url}`);
    console.log(`Stars: ${repo.stargazers_count}`);
    console.log(`Forks: ${repo.forks_count}`);
    console.log(`Updated: ${repo.updated_at}`);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🚀 MCP-HUB GitHub Auto-Push Agent                            ║
║  Powered by Claude (Anthropic)                                ║
╚══════════════════════════════════════════════════════════════╝
  `);

  if (args.includes('--status')) {
    await showStatus();
    return;
  }

  if (args.includes('--init') || !(await repoExists())) {
    const created = await createRepo();
    if (!created && args.includes('--init')) return;
  }

  await syncAll();
}

main().catch(console.error);
