import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let glossaryCache = null;

/**
 * Load glossary from JSON file
 */
export function loadGlossary() {
  if (glossaryCache) {
    return glossaryCache;
  }

  try {
    // For Vercel: try api directory first (where serverless function runs)
    // For local: try project root
    const possiblePaths = [
      // Vercel deployment paths (api/ is where the code runs)
      join(process.cwd(), 'Glossary260210.json'),
      join(process.cwd(), 'glossary.json'),
      // Local development paths
      join(process.cwd(), 'data', 'Glossary260210.json'),
      join(process.cwd(), 'data', 'glossary.json'),
      join(process.cwd(), 'src', 'data', 'glossary.json'),
      // Relative to this file
      join(__dirname, '..', '..', '..', 'data', 'Glossary260210.json'),
      join(__dirname, '..', '..', '..', 'data', 'glossary.json'),
    ];

    let data = null;
    let loadedPath = '';

    for (const path of possiblePaths) {
      try {
        data = readFileSync(path, 'utf-8');
        loadedPath = path;
        console.log('Loaded glossary from:', path);
        break;
      } catch (e) {
        // Try next path
      }
    }

    if (!data) {
      console.warn('Glossary file not found in any location. Tried:', possiblePaths);
      // Return fallback data
      glossaryCache = [];
      return [];
    }

    glossaryCache = JSON.parse(data);
    console.log(`Loaded ${glossaryCache.length} glossary entries from: ${loadedPath}`);
    return glossaryCache;
  } catch (error) {
    console.warn('Could not load glossary file:', error.message);
    return [];
  }
}

/**
 * Find term in glossary by Chinese text
 */
export function findTerm(cnText, glossary = null) {
  const terms = glossary || loadGlossary();

  // Exact match first
  let exact = terms.find(t => t.cn === cnText);
  if (exact) {
    return exact;
  }

  // Partial match (for longer phrases)
  return terms.find(t => cnText.includes(t.cn));
}

/**
 * Apply glossary replacements to text
 */
export function applyGlossary(text, glossary = null) {
  const terms = glossary || loadGlossary();

  // Sort by length (longer terms first to avoid partial replacements)
  const sortedTerms = [...terms].sort((a, b) => (b.cn?.length || 0) - (a.cn?.length || 0));

  let result = text;
  for (const term of sortedTerms) {
    if (term.cn && term.en) {
      result = result.replaceAll(term.cn, term.en);
    }
  }

  return result;
}

/**
 * Extract game terms from text using glossary
 */
export function extractTerms(text, glossary = null) {
  const terms = glossary || loadGlossary();
  const found = [];

  for (const term of terms) {
    if (term.cn && text.includes(term.cn)) {
      found.push(term);
    }
  }

  return found;
}

/**
 * Reload glossary (useful after updates)
 */
export function reloadGlossary() {
  glossaryCache = null;
  return loadGlossary();
}
