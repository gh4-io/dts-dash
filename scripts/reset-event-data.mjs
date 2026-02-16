#!/usr/bin/env node
/**
 * Reset Event Data Script
 * Clears aircraft event data (input.json) while preserving system data (SQLite)
 *
 * Usage: npm run db:event-reset
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DATA_FILE = path.join(projectRoot, 'data', 'input.json');
const BACKUP_DIR = path.join(projectRoot, 'data', 'backups');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${question}${colors.reset} `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

async function main() {
  log('═══════════════════════════════════════════════════════════', 'blue');
  log('  Reset Event Data Tool', 'blue');
  log('═══════════════════════════════════════════════════════════', 'blue');
  log('');

  // Check if input.json exists
  if (!fs.existsSync(DATA_FILE)) {
    log('⚠ data/input.json does not exist. Nothing to reset.', 'yellow');
    process.exit(0);
  }

  // Show current data stats
  log('Current Data:', 'blue');
  try {
    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    const fileStats = fs.statSync(DATA_FILE);

    try {
      const parsed = JSON.parse(fileContent);
      const records = Array.isArray(parsed) ? parsed : parsed.value ?? [];
      log(`  Records: ${colors.yellow}${records.length}${colors.reset}`);
    } catch {
      log(`  File size: ${colors.yellow}${formatBytes(fileStats.size)}${colors.reset}`);
    }
  } catch (error) {
    log(`  Error reading file: ${error.message}`, 'red');
  }
  log('');

  // Warning
  log('⚠  WARNING: This will DELETE all aircraft event data from input.json', 'red');
  log('   System data (users, customers, settings) will NOT be affected.', 'reset');
  log('');

  // Confirm
  const answer = await promptUser('Create backup and reset? [y/N]:');

  if (answer !== 'y' && answer !== 'yes') {
    log('Reset cancelled.', 'blue');
    process.exit(0);
  }

  // Create backup directory if needed
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Create backup with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
  const backupFile = path.join(BACKUP_DIR, `input_${timestamp}.json`);

  log('');
  log('Creating backup...', 'blue');
  try {
    fs.copyFileSync(DATA_FILE, backupFile);
    const backupRelPath = path.relative(projectRoot, backupFile);
    log(`✓ Backup saved: ${backupRelPath}`, 'green');
  } catch (error) {
    log(`✗ Backup failed: ${error.message}`, 'red');
    process.exit(1);
  }

  // Reset input.json to empty array
  log('Resetting input.json...', 'blue');
  try {
    fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
    log('✓ Event data cleared', 'green');
  } catch (error) {
    log(`✗ Reset failed: ${error.message}`, 'red');
    log(`You can restore from backup: cp ${backupFile} ${DATA_FILE}`, 'yellow');
    process.exit(1);
  }

  log('');
  log('═══════════════════════════════════════════════════════════', 'green');
  log('✓ Reset complete', 'green');
  log('═══════════════════════════════════════════════════════════', 'green');
  log('');
  log('Next steps:', 'blue');
  log('  1. Restart the dev server (if running) to clear cache');
  log('  2. Import new data via Admin UI or API');
  log(`  3. To restore backup: ${colors.yellow}cp ${backupFile} ${DATA_FILE}${colors.reset}`);
  log('');
}

main().catch((error) => {
  log(`Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
