#!/usr/bin/env node
/**
 * gp-error-filter.js
 *
 * Single-file utility to scan GP5 files, export to alphaTex, then re-import
 * to validate. Copies failed GP5 files to an output folder and writes a
 * JSON report plus a short log.
 *
 * Dependencies:
 *   - Node.js 16+ (tested on v20+)
 *   - @coderline/alphatab (>= 1.8.0)
 *
 * Usage:
 *   node scripts/gp-error-filter.js --in data/raw --out data/error [--dry-run] [--verbose]
 *
 * Notes for cross-repo use:
 *   - This is a self-contained single JS file intended to be dropped into other projects.
 *   - Before running, ensure `npm install @coderline/alphatab` in the target project.
 *   - If you need alphaSkia rendering later, also install `@coderline/alphaskia` and register fonts.
 */

const fs = require('fs').promises;
const path = require('path');

const alphaTab = (() => {
  try {
    return require('@coderline/alphatab');
  } catch (e) {
    console.error('Missing dependency: @coderline/alphatab.\nRun: npm install @coderline/alphatab');
    process.exit(2);
  }
})();

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { in: 'data/raw', out: 'data/error', dryRun: false, verbose: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--in' || a === '--input') opts.in = args[++i];
    else if (a === '--out' || a === '--output') opts.out = args[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--verbose') opts.verbose = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/gp-error-filter.js --in <gp-dir> --out <error-dir> [--dry-run] [--verbose]');
      process.exit(0);
    } else {
      console.warn('Unknown arg:', a);
    }
  }
  return opts;
}

function extractDiagnostics(error) {
  const diag = {
    message: error && error.message ? error.message : String(error),
    type: error && error.type !== undefined ? error.type : null,
    lexerErrors: [],
    parserErrors: [],
    semanticErrors: []
  };

  const mapItem = (item) => {
    // some items use start:{line,col,offset}, others use line/column directly
    const start = item.start || {};
    return {
      code: item.code || null,
      message: item.message || null,
      severity: item.severity !== undefined ? item.severity : null,
      start: {
        line: start.line ?? item.line ?? null,
        column: start.col ?? start.column ?? item.column ?? null,
        offset: start.offset ?? item.offset ?? null
      },
      end: item.end ? { line: item.end.line, column: item.end.col, offset: item.end.offset } : null
    };
  };

  try {
    if (error.lexerDiagnostics && Array.isArray(error.lexerDiagnostics.items)) {
      diag.lexerErrors = error.lexerDiagnostics.items.map(mapItem);
    }
    if (error.parserDiagnostics && Array.isArray(error.parserDiagnostics.items)) {
      diag.parserErrors = error.parserDiagnostics.items.map(mapItem);
    }
    if (error.semanticDiagnostics && Array.isArray(error.semanticDiagnostics.items)) {
      diag.semanticErrors = error.semanticDiagnostics.items.map(mapItem);
    }
  } catch (e) {
    // Ignore mapping problems
  }

  return diag;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyFile(src, dest) {
  // Ensure dest directory
  await ensureDir(path.dirname(dest));
  return fs.copyFile(src, dest);
}

async function processFile(inDir, outDir, fileName, options) {
  const inputPath = path.join(inDir, fileName);
  const baseName = path.basename(fileName, path.extname(fileName));
  const atexName = `${baseName}.atex`;

  if (options.verbose) console.log(`Processing: ${fileName}`);

  let atex = null;  // Declare outside try block so catch can access it

  try {
    const data = await fs.readFile(inputPath);

    // Load gp5 bytes
    const settings = new alphaTab.Settings();
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(data), settings);

    // Export to alphaTex
    const exporter = new alphaTab.exporter.AlphaTexExporter();
    // Use exportToString to get the alphaTex as a string
    atex = exporter.exportToString(score, settings);

    // Try to import the alphaTex back
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(atex, settings);

    // Attempt to read the score (this may throw AlphaTexErrorWithDiagnostics)
    importer.readScore();

    // If we reach here, validation passed
    return { input: fileName, atex: atexName, status: 'passed' };

  } catch (error) {
    // Extract diagnostics and write report entry
    const diagnostics = extractDiagnostics(error);
    // Count errors
    const errorCount = (diagnostics.lexerErrors?.length || 0) + (diagnostics.parserErrors?.length || 0) + (diagnostics.semanticErrors?.length || 0);

    const reportItem = {
      gp5: fileName,
      atex: atexName,
      errorCount,
      diagnostics
    };

    // copy failing gp5 to outDir/failed_gp5
    if (!options.dryRun) {
      const targetDir = path.join(outDir, 'failed_gp5');
      await ensureDir(targetDir);
      const destPath = path.join(targetDir, fileName);
      try {
        await copyFile(inputPath, destPath);
      } catch (e) {
        console.error('Failed to copy failed GP5:', e.message);
      }

      // save failed alphaTex to outDir/fail_atex
      const atexDir = path.join(outDir, 'fail_atex');
      await ensureDir(atexDir);
      const atexPath = path.join(atexDir, atexName);
      try {
        await fs.writeFile(atexPath, atex, 'utf8');
      } catch (e) {
        console.error('Failed to save alphaTex:', e.message);
      }
    }

    return { input: fileName, atex: atexName, status: 'failed', errorCount, diagnostics };
  }
}

async function main() {
  const opts = parseArgs();
  const inDir = path.resolve(opts.in);
  const outDir = path.resolve(opts.out);
  const reportPath = path.join(outDir, 'report.json');
  const logPath = path.join(outDir, 'log.txt');

  console.log(`Input dir: ${inDir}`);
  console.log(`Output dir: ${outDir}`);
  console.log(`Dry-run: ${opts.dryRun}`);

  await ensureDir(outDir);

  const files = await fs.readdir(inDir);
  const gp5Files = files.filter(f => f.toLowerCase().endsWith('.gp5'));

  const results = [];
  const logLines = [];

  for (let i = 0; i < gp5Files.length; i++) {
    const fileName = gp5Files[i];
    process.stdout.write(`[${i + 1}/${gp5Files.length}] ${fileName} ... `);
    try {
      const res = await processFile(inDir, outDir, fileName, opts);
      results.push(res);
      if (res.status === 'passed') {
        console.log('OK');
        logLines.push(`${fileName}: PASSED`);
      } else {
        console.log(`FAILED (${res.errorCount} errors)`);
        logLines.push(`${fileName}: FAILED (${res.errorCount} errors)`);
      }
    } catch (e) {
      console.error('ERR', e.message);
      logLines.push(`${fileName}: ERROR (${e.message})`);
      results.push({ input: fileName, status: 'error', message: e.message });
    }
  }

  // Write report and log
  const summary = {
    generatedAt: new Date().toISOString(),
    inputDir: inDir,
    outDir: outDir,
    totalFiles: gp5Files.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    results
  };

  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');
  await fs.writeFile(logPath, logLines.join('\n'), 'utf8');

  console.log('\nSummary:');
  console.log(`  Total: ${summary.totalFiles}`);
  console.log(`  Passed: ${summary.passed}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log(`Report: ${reportPath}`);
  console.log(`Log: ${logPath}`);

  if (opts.verbose) {
    console.log('\nDetailed results saved to report.json');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
