#!/bin/sh
set -e

echo "=== Gitleaks ==="
gitleaks git . --verbose
gitleaks dir . --verbose

echo "=== Outdated dependencies ==="
pnpm outdated

echo "=== Vulnerabilities ==="
pnpm audit

echo "=== Health checks passed ==="
