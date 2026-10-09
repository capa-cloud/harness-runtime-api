#!/usr/bin/env bash
set -euo pipefail

root="${1:-.}"
status=0

dangerous_files=$(find "$root" \
  -path '*/.git' -prune -o \
  -path '*/node_modules' -prune -o \
  -path '*/dist' -prune -o \
  -type f \( \
    -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' -o \
    -name 'id_rsa' -o -name '.DS_Store' \
  \) ! -name '.env.example' -print)

if [[ -n "$dangerous_files" ]]; then
  printf 'dangerous files found:\n%s\n' "$dangerous_files"
  status=1
fi

scan() {
  local label="$1"
  local pattern="$2"
  local output
  local scan_status=0
  if command -v rg >/dev/null && [[ "${PUBLIC_SCAN_FORCE_GREP:-0}" != 1 ]]; then
    output=$(rg -l -i --hidden \
      --glob '!.git/**' --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!pnpm-lock.yaml' \
      "$pattern" "$root") || scan_status=$?
    if [[ "$scan_status" -gt 1 ]]; then
      printf 'scan failed: %s\n' "$label"
      status=1
      return
    fi
  elif command -v grep >/dev/null; then
    output=$(find "$root" \
      -path '*/.git' -prune -o -path '*/node_modules' -prune -o -path '*/dist' -prune -o \
      -type f ! -name pnpm-lock.yaml -exec bash -c '
        grep -l -i -E -I -- "$1" "${@:2}"
        result=$?
        if [[ "$result" -gt 1 ]]; then exit "$result"; fi
        exit 0
      ' _ "$pattern" {} +) || scan_status=$?
    if [[ "$scan_status" -ne 0 ]]; then
      printf 'scan failed: %s\n' "$label"
      status=1
      return
    fi
  else
    printf 'scanner unavailable: install ripgrep or grep\n'
    status=1
    return
  fi
  if [[ -n "$output" ]]; then
    printf '%s:\n%s\n' "$label" "$output"
    status=1
  fi
}

scan 'credential-shaped content' \
  '(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|authorization:[[:space:]]*bearer[[:space:]]+[A-Za-z0-9._-]{16,}|api[_-]?key[[:space:]]*[:=][[:space:]]*["'"'][^"'"']{12,}["'"'])'
scan 'credential token prefix' \
  '(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,}|sk-ant-[A-Za-z0-9_-]{40,}|sk-proj-[A-Za-z0-9_-]{40,}|(AKIA|ASIA)[A-Z0-9]{16})'
scan 'private network or local absolute path' \
  '(/Users/[A-Za-z0-9._-]+|https?://[^/[:space:]]+\.(internal|local)(/|[[:space:]]|$)|(^|[^0-9])(10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|192\.168\.[0-9]{1,3}\.[0-9]{1,3})([^0-9]|$))'

exit "$status"
