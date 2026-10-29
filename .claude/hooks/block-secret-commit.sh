#!/usr/bin/env bash
# PreToolUse hook (Bash only): blocks `git add` / `git commit` whenever a
# secret-pattern file (.env, .env.*, credentials*, *.pem, *.key, *.p12,
# secrets.*, terraform.tfstate) is dirty/untracked in the working tree, since
# a broad `git add -A`/`.`/`-u` or `git commit -a` would sweep it in.
# Deliberately conservative: any matching file present blocks the add/commit,
# not just ones named explicitly in the command. Exits 2 to hard-block the
# tool call (Claude Code feeds stderr back to the agent).
set -euo pipefail

input="$(cat)"
command="$(echo "$input" | jq -r '.tool_input.command // ""')"

if ! echo "$command" | grep -qE '(^|[;&|]|\s)git[[:space:]]+(add|commit)([[:space:]]|$)'; then
  exit 0
fi

secret_regex='(^|/)\.env(\.[A-Za-z0-9_-]+)?$|(^|/)credentials[^/]*$|\.pem$|\.key$|\.p12$|(^|/)secrets\.[^/]*$|(^|/)terraform\.tfstate$'

matches="$(git status --porcelain 2>/dev/null | awk '{print $2}' | grep -iE "$secret_regex" || true)"

if [ -n "$matches" ]; then
  echo "Blocked: a secret-pattern file is present and this git add/commit could include it:" >&2
  echo "$matches" >&2
  echo "Unstage/remove it, or add it to .gitignore first." >&2
  exit 2
fi

exit 0
