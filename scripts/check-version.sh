#!/usr/bin/env bash
# Pre-release guard (ADR-017 §6): the three version sources have no official
# auto-sync, so a tag may not match what gets built. Fail the release unless the
# tag version equals package.json, tauri.conf.json, and Cargo.toml [package].
set -euo pipefail

want="${1:?usage: check-version.sh <version-without-v-prefix>}"
root="$(cd "$(dirname "$0")/.." && pwd)"

pkg="$(node -p "require('$root/package.json').version")"
conf="$(node -p "require('$root/src-tauri/tauri.conf.json').version")"
cargo="$(grep -m1 '^version = ' "$root/src-tauri/Cargo.toml" | sed -E 's/version = "(.*)"/\1/')"

fail=0
for pair in "package.json:$pkg" "tauri.conf.json:$conf" "Cargo.toml:$cargo"; do
  name="${pair%%:*}"
  got="${pair#*:}"
  if [ "$got" != "$want" ]; then
    echo "::error::$name version '$got' != tag '$want'"
    fail=1
  fi
done

[ "$fail" -eq 0 ] && echo "version triple matches tag '$want'"
exit "$fail"
