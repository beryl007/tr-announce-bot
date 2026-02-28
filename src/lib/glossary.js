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
    const glossaryPath = join(process.cwd(), 'data', 'glossary.json');
    const data = readFileSync(glossaryPath, 'utf-8');
    glossaryCache = JSON.parse(data);
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
