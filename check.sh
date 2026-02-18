#!/bin/sh
set -e

echo "=== Formatting ==="
pnpm run lint

echo "=== Typecheck ==="
pnpm run typecheck

echo "=== Tests ==="
pnpm run test

echo "=== All checks passed ==="
