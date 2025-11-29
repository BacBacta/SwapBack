# 🔒 Security Audit Framework - SwapBack

## Project Information

| Field | Value |
|-------|-------|
| **Project Name** | SwapBack |
| **Audit Date** | November 29, 2025 |
| **Auditor** | Internal Security Review |
| **Scope** | Smart Contracts (Anchor/Rust) + Frontend (Next.js/TypeScript) |
| **Repository** | /workspaces/SwapBack |

## Scope

### Smart Contracts (Solana/Anchor)
- `programs/swapback_cnft/src/lib.rs` - Main lock/unlock program

### Frontend Application
- `app/src/` - Next.js application
- `app/src/components/` - React components
- `app/src/lib/` - Utility libraries
- `app/src/hooks/` - React hooks

## Severity Classification

| Severity | Description |
|----------|-------------|
| 🔴 **CRITICAL** | Direct loss of funds, complete system compromise |
| 🟠 **HIGH** | Significant impact, potential fund loss under specific conditions |
| 🟡 **MEDIUM** | Limited impact, workarounds available |
| 🔵 **LOW** | Minor issues, best practice violations |
| ⚪ **INFORMATIONAL** | Suggestions for improvement |

## Quick Start

```bash
# Run full audit
./audit/scripts/run-full-audit.sh

# View reports
ls audit/reports/
```

## Audit Structure

```
audit/
├── README.md                    # This file
├── METHODOLOGY.md               # Audit methodology
├── FINDINGS.md                  # Vulnerability findings
├── scripts/                     # Automation scripts
│   ├── run-full-audit.sh       # Complete audit
│   ├── smart-contract-audit.sh # Rust/Anchor audit
│   └── frontend-scan.sh        # Frontend security scan
├── checklists/                  # Security checklists
│   ├── solana-checklist.md     # Solana/Anchor checklist
│   └── frontend-checklist.md   # Frontend checklist
└── reports/                     # Generated reports
```
