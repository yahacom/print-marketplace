#!/usr/bin/env bash
# PreToolUse hook, two jobs:
#   1. Audit log (never blocks): any call whose path/command/content matches
#      common credential-related naming is recorded to .claude/credential-access.log
#      (tool + session only, never the matched content).
#   2. Hard block: if the call's own content looks like a literal secret VALUE
#      (API key, private key block, JWT, ...), deny it outright. Static path rules
#      (permissions.deny / sandbox.filesystem.denyRead) can't catch this — it's
#      about what's in the call, not which file/path it names.
# Key-name and value-pattern ideas borrowed from a project-provided JSON secret
# scrubber (regex set, not the redaction logic — that script sanitizes payloads
# after the fact; this one decides allow/deny before the tool runs).
set -euo pipefail

input="$(cat)"
tool_name="$(echo "$input" | jq -r '.tool_name // ""')"
session_id="$(echo "$input" | jq -r '.session_id // "unknown"')"
# Serialize the whole tool_input (any field, any depth: file_path, command,
# content, new_string, pattern, ...) so one regex pass covers every tool.
target="$(echo "$input" | jq -r '.tool_input | tostring' 2>/dev/null || echo "")"

mkdir -p .claude

# Portable across BSD grep (macOS) and GNU grep: -E extended regex, -i case-insensitive,
# no PCRE-only syntax ((?i), \b) since BSD grep lacks -P.
name_regex='credential|secret|password|passwd|token|api[_-]?key|private[_-]?key|service[_-]?account|adminsdk|\.pem|\.key|\.p12|\.env|\.netrc|id_rsa|id_ed25519|\.pgpass|\.npmrc'
if echo "$target" | grep -qiE "$name_regex"; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) tool=$tool_name session=$session_id match=name" >> .claude/credential-access.log
fi

value_regex='sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|-----BEGIN[A-Z ]*PRIVATE KEY-----'
if echo "$target" | grep -qE "$value_regex"; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) tool=$tool_name session=$session_id match=literal-secret BLOCKED" >> .claude/credential-access.log
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: this call appears to contain a literal credential/secret value, not just a reference to one."}}'
fi

exit 0
