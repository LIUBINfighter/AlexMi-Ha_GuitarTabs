#!/usr/bin/env node
/**
 * Test script to verify alphaTab API usage
 */

const fs = require('fs').promises;
const path = require('path');
const alphaTab = require('@coderline/alphatab');

async function testExportImport() {
  console.log('Testing alphaTab export/import...\n');
  
  // Pick a test file
  const testFile = path.join(__dirname, '../data/raw/ACDC - Hells Bells.gp5');
  const data = await fs.readFile(testFile);
  
  console.log('1. Loading GP5 file...');
  const settings = new alphaTab.Settings();
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(data), settings);
  console.log('   ✓ Loaded score:', score.title);
  
  console.log('\n2. Creating AlphaTexExporter...');
  const exporter = new alphaTab.exporter.AlphaTexExporter();
  console.log('   Exporter methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(exporter)));
  
  console.log('\n3. Exporting to alphaTex using export()...');
  const resultBytes = exporter.export(score, settings);
  console.log('   export() result type:', typeof resultBytes);
  console.log('   export() result constructor:', resultBytes?.constructor?.name);
  
  console.log('\n4. Exporting to alphaTex using exportToString()...');
  const atexString = exporter.exportToString(score, settings);
  console.log('   exportToString() result type:', typeof atexString);
  console.log('   Is string?', typeof atexString === 'string');
  
  console.log('\n5. AlphaTex string preview (first 200 chars):');
  if (atexString) {
    console.log('   Type:', typeof atexString);
    console.log('   Length:', atexString.length);
    console.log('   Preview:', atexString.substring(0, 200));
  } else {
    console.log('   ✗ Could not extract string from result');
    console.log('   Full result:', result);
  }
  
  console.log('\n6. Testing import...');
  try {
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(atexString, settings);
    const importedScore = importer.readScore();
    console.log('   ✓ Import successful!');
    console.log('   Imported score title:', importedScore.title);
  } catch (error) {
    console.log('   ✗ Import failed:', error.message);
    console.log('   Error type:', error.constructor.name);
    if (error.lexerDiagnostics) {
      console.log('   Lexer errors:', error.lexerDiagnostics.items?.length || 0);
    }
    if (error.parserDiagnostics) {
      console.log('   Parser errors:', error.parserDiagnostics.items?.length || 0);
    }
  }
}

testExportImport().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
