# Debug for alphaTex

This repo is for debugging [alphaTab.js](https://github.com/CoderLine/alphaTab) alphaTex exporter. The original README is [here](./data/README.md). Thanks to [AlexMi-Ha/GuitarTabs](https://github.com/AlexMi-Ha/GuitarTabs) for the scores!

## Version

"@coderline/alphatab": "^1.8.0"

## Quick Start

So AI will write a lot but may waste your time. I write this for your minimal action.

**1. Install dependencies**

```bash
npm install
```

Installs the required alphaTab library for GP5 file processing.

**2. Run validation**

My result: [./data/report.example.json](./data/report.example.json)

```bash
node scripts/gp-error-filter.js --in data/raw --out data/error
```

Validates all GP5 files by exporting to alphaTex format and re-importing. Failed files and their alphaTex exports are saved to error along with a detailed JSON report. Result on your machine will be [report.json](./data/error/report.json)

**3. Analyze errors**

My result: [error-analysis.example.txt](./data/error-analysis.example.txt)

```bash
node scripts/analyze-errors.js
```

Generates statistical analysis of error patterns, including error type distribution, most common error codes, and files with the most issues. Result on your machine will be [error-analysis.txt](./data/error/error-analysis.txt)

All done. Good luck! The rest of this document is written by AI for detailed information.

---

## Validation Workflow

This repository includes a validation tool to test GP5 files through alphaTab's export/import cycle.

### Setup

1. Ensure you have Node.js 16+ installed
2. Install dependencies:

```bash
npm install
```

### Running the Validation Script

The `gp-error-filter.js` script validates GP5 files by:

1. Loading each GP5 file from `data/raw`
2. Exporting to alphaTex format
3. Re-importing the alphaTex to detect parsing errors
4. Generating detailed reports

**Basic usage:**

```bash
node scripts/gp-error-filter.js --in data/raw --out data/error
```

**Available options:**

- `--in <dir>` - Input directory containing GP5 files (default: `data/raw`)
- `--out <dir>` - Output directory for reports and failed files (default: `data/error`)
- `--verbose` - Show detailed processing information
- `--dry-run` - Run validation without copying failed files

### Output Structure

After running the script, the output directory will contain:

```
data/error/
├── report.json          # Detailed JSON report with error diagnostics
├── log.txt             # Simple text log (one line per file)
├── failed_gp5/         # GP5 files that failed validation
└── fail_atex/          # Exported alphaTex of failed files
```

### Understanding Results

- **Passed files**: Successfully exported to alphaTex and re-imported without errors
- **Failed files**: Encountered parsing errors during alphaTex re-import
  - Check `report.json` for detailed error diagnostics (lexer, parser, semantic errors)
  - Review the corresponding `.atex` files in `fail_atex/` to analyze the generated alphaTex
  - Compare with original GP5 files in `failed_gp5/`

### Example

```bash
# Run validation with verbose output
node scripts/gp-error-filter.js --in data/raw --out data/error --verbose

# Check results
cat data/error/log.txt

# View detailed report
cat data/error/report.json
```

## Error Analysis

After generating the validation report, you can analyze error patterns and statistics using the `analyze-errors.js` script.

### Running the Analysis

```bash
node scripts/analyze-errors.js --report data/error/report.json
```

**Options:**
- `--report <path>` or `-r <path>` - Path to report.json file (default: `data/error/report.json`)

### Analysis Output

The script generates `error-analysis.txt` in the same directory as the report, containing:

- **Overview**: Success/failure rates and file counts
- **Error Type Distribution**: Breakdown of lexer, parser, and semantic errors
- **Top Error Codes**: Most frequent error codes with sample messages
- **Error Message Patterns**: Categorized error patterns (e.g., "Percussion Articulation", "Note Kind Mismatch")
- **Files with Most Errors**: Ranked list of problematic files
- **Detailed Breakdown**: Per-file error counts by type

### Sample Output

```
═══════════════════════════════════════════════════════════════
                   ERROR ANALYSIS REPORT                       
═══════════════════════════════════════════════════════════════

OVERVIEW
─────────────────────────────────────────────────────────────
Total Files:      80
Passed:           53 (66.3%)
Failed:           27 (33.8%)

ERROR TYPE DISTRIBUTION
─────────────────────────────────────────────────────────────
Semantic Errors:   365 (100.0%)

TOP ERROR CODES
─────────────────────────────────────────────────────────────
Code   Count  Files  Sample Message
─────────────────────────────────────────────────────────────
  209    256     18  Unexpected percussion articulation value...
  218    109     14  Wrong note kind 'Fretted' for staff...
```

This analysis helps identify:
- Common error patterns that need fixing in alphaTab
- Files with the most issues for targeted investigation
- Specific error codes to prioritize in bug fixes
