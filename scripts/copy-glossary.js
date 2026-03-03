#!/usr/bin/env node
/**
 * Copy glossary file to api directory for Vercel deployment
 * Vercel serverless functions only have access to files in the api/ directory
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Source and destination paths
const sourcePaths = [
  path.join(rootDir, 'data', 'Glossary260210.json'),
  path.join(rootDir, 'data', 'glossary.json'),
];

const destDir = path.join(rootDir, 'api');
const destFiles = [
  path.join(destDir, 'Glossary260210.json'),
  path.join(destDir, 'glossary.json'),
];

// Find the source file
let sourceFile = null;
for (const p of sourcePaths) {
  if (fs.existsSync(p)) {
    sourceFile = p;
    break;
  }
}

if (!sourceFile) {
  console.warn('⚠️  No glossary file found in data/ directory');
  process.exit(0);
}

// Ensure api directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy the file
const fileName = path.basename(sourceFile);
const destFile = path.join(destDir, fileName);

fs.copyFileSync(sourceFile, destFile);

// Parse and log info
const data = JSON.parse(fs.readFileSync(destFile, 'utf-8'));
console.log(`✓ Copied glossary to api/${fileName} (${data.length} entries)`);
