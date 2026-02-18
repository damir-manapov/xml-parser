#!/bin/sh
set -e

echo "=== Gitleaks ==="
gitleaks git --source . --verbose
gitleaks dir --source . --verbose

echo "=== Outdated dependencies ==="
pnpm outdated

echo "=== Vulnerabilities ==="
pnpm audit

echo "=== Health checks passed ==="
