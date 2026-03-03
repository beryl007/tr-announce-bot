#!/usr/bin/env node
/**
 * Glossary Format Converter
 *
 * Convert glossary files between different formats:
 * - XLSX (Excel)
 * - CSV
 * - JSON
 * - YAML
 *
 * Usage:
 *   node tools/convert-glossary.js input.xlsx output.json
 *   node tools/convert-glossary.js input.csv output.json
 *   node tools/convert-glossary.js input.json output.csv
 *   node tools/convert-glossary.js input.xlsx output.yaml
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get format from file extension
function getFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const formats = {
    '.xlsx': 'xlsx',
    '.xls': 'xls',
    '.csv': 'csv',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml'
  };
  return formats[ext] || 'unknown';
}

// Read glossary from various formats
async function readGlossary(filePath) {
  const format = getFormat(filePath);
  const absolutePath = path.resolve(filePath);

  console.log(`Reading ${format.toUpperCase()} file: ${absolutePath}`);

  switch (format) {
    case 'json':
      return readJSON(absolutePath);
    case 'csv':
      return await readCSV(absolutePath);
    case 'xlsx':
    case 'xls':
      return await readExcel(absolutePath);
    case 'yaml':
    case 'yml':
      return await readYAML(absolutePath);
    default:
      throw new Error(`Unsupported input format: ${format}`);
  }
}

// Write glossary to various formats
async function writeGlossary(data, filePath) {
  const format = getFormat(filePath);
  const absolutePath = path.resolve(filePath);

  console.log(`Writing ${format.toUpperCase()} file: ${absolutePath}`);

  switch (format) {
    case 'json':
      writeJSON(data, absolutePath);
      break;
    case 'csv':
      writeCSV(data, absolutePath);
      break;
    case 'yaml':
    case 'yml':
      writeYAML(data, absolutePath);
      break;
    case 'xlsx':
      await writeExcel(data, absolutePath);
      break;
    default:
      throw new Error(`Unsupported output format: ${format}`);
  }
}

// === Format Readers ===

function readJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

async function readCSV(filePath) {
  const csv = await import('csv-parse');
  const content = fs.readFileSync(filePath, 'utf8');
  return new Promise((resolve, reject) => {
    csv.parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }, (err, records) => {
      if (err) reject(err);
      else resolve(normalizeGlossary(records));
    });
  });
}

async function readExcel(filePath) {
  const xlsx = await import('xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);
  return normalizeGlossary(data);
}

async function readYAML(filePath) {
  const yaml = await import('js-yaml');
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content);
}

// === Format Writers ===

function writeJSON(data, filePath) {
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeCSV(data, filePath) {
  const { stringify } = require('csv-stringify/sync');
  const output = stringify(data, {
    header: true,
    columns: [{ key: 'cn' }, { key: 'en' }, { key: 'context' }]
  });
  fs.writeFileSync(filePath, output, 'utf8');
}

async function writeYAML(data, filePath) {
  const yaml = await import('js-yaml');
  const content = yaml.dump(data, {
    lineWidth: -1,
    noRefs: true
  });
  fs.writeFileSync(filePath, content, 'utf8');
}

async function writeExcel(data, filePath) {
  const xlsx = await import('xlsx');
  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Glossary');
  xlsx.writeFile(workbook, filePath);
}

// === Helper Functions ===

/**
 * Normalize glossary data to standard format [{cn, en, context}]
 */
function normalizeGlossary(data) {
  return data.map(item => {
    // Handle different column names
    const cn = item.cn || item.中文 || item.Chinese || item['中文名'] || '';
    const en = item.en || item.English || item.英文 || item['英文名'] || '';
    const context = item.context || item.ctx || item.上下文 || item.note || item.notes || '';

    if (!cn && !en) {
      console.warn('Skipping empty entry:', item);
      return null;
    }

    return { cn, en, context };
  }).filter(item => item !== null);
}

// === CLI Interface ===

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║          Glossary Format Converter v1.0                   ║
╠════════════════════════════════════════════════════════════╣
║  Convert glossary files between multiple formats           ║
║                                                            ║
║  Supported formats: XLSX, XLS, CSV, JSON, YAML             ║
║                                                            ║
║  Usage:                                                    ║
║    node tools/convert-glossary.js <input> <output>        ║
║                                                            ║
║  Examples:                                                 ║
║    node tools/convert-glossary.js glossary.xlsx data.json  ║
║    node tools/convert-glossary.js data.json glossary.csv   ║
║    node tools/convert-glossary.js input.xlsx output.yaml   ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
    process.exit(1);
  }

  const [input, output] = args;

  if (!fs.existsSync(input)) {
    console.error(`❌ Error: Input file not found: ${input}`);
    process.exit(1);
  }

  try {
    // Read input file
    const data = await readGlossary(input);
    console.log(`✓ Loaded ${data.length} glossary entries`);

    // Write output file
    await writeGlossary(data, output);
    console.log(`✓ Conversion complete!`);

    // Show preview
    console.log('\n📋 Preview (first 3 entries):');
    data.slice(0, 3).forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.cn} → ${item.en}`);
    });

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
