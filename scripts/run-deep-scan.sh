#!/usr/bin/env bash
set -euo pipefail

mkdir -p .reports

echo "Running npm audit..."
npm audit --json > .reports/npm-audit.json || true

echo "Running typecheck..."
npm run typecheck || true

echo "Running tests (fast)..."
npm run test:run || true

if command -v semgrep >/dev/null 2>&1; then
  echo "Running semgrep (local)..."
  semgrep --config=auto --json . > .reports/semgrep.json || true
elif command -v docker >/dev/null 2>&1; then
  echo "semgrep not installed locally — running via Docker (this may require Docker permissions)"
  docker run --rm -v "$(pwd)":/src returntocorp/semgrep semgrep --config=auto --json /src > .reports/semgrep.json || true
else
  echo "semgrep not available. To run semgrep locally, install via pip: 'pip install semgrep' or use Docker." >&2
fi

echo "Reports written to .reports/"
