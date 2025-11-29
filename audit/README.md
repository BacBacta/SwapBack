# SwapBack Security Audit Framework

This directory contains the security audit infrastructure for SwapBack.

## Structure

```text
audit/
├── checklists/       # Security verification checklists
├── reports/          # Audit findings and reports
└── scripts/          # Automated audit scripts
```

## Quick Start

Run the full audit:

```bash
./audit/scripts/run-full-audit.sh
```

Run SonarQube-style analysis:

```bash
./audit/scripts/sonarqube-analysis.sh
```

## Checklists

- `solana-checklist.md` - Smart contract security
- `frontend-checklist.md` - Frontend security

## Reports

- `FINAL_REPORT.md` - Latest audit findings

## Quality Gate

Current status: **PASSED**

- Reliability: B
- Security: B
- Maintainability: A
- Complexity: B
