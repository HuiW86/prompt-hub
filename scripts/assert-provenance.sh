#!/usr/bin/env bash
# Release provenance assertion (ADR-017 §6): fail the release unless the tag,
# latest.json, and the actual artifact set all agree — rather than trusting a
# human to spot a malformed manifest or a mismatched artifact after the fact.
set -euo pipefail

want="${1:?usage: assert-provenance.sh <version> <dist-dir>}"
dist="${2:?usage: assert-provenance.sh <version> <dist-dir>}"
manifest="$dist/latest.json"

fail() {
  echo "::error::$1"
  exit 1
}

[ -f "$manifest" ] || fail "latest.json missing in $dist"

# 1. manifest version == tag
mver="$(jq -r '.version' "$manifest")"
[ "$mver" = "$want" ] || fail "latest.json version '$mver' != tag '$want'"

# 2. every platform entry has a signature and a URL whose basename exists in dist
#    and carries the tag version; and a matching .sig file is present.
while IFS=$'\t' read -r plat sig url; do
  [ -n "$sig" ] || fail "platform '$plat' has an empty signature"
  file="$(basename "$url")"
  case "$file" in
    *"$want"*) : ;;
    *) fail "artifact '$file' for '$plat' does not carry version '$want'" ;;
  esac
  [ -f "$dist/$file" ] || fail "artifact '$file' referenced by latest.json is missing"
  [ -f "$dist/$file.sig" ] || fail "signature '$file.sig' is missing"
done < <(jq -r '.platforms | to_entries[] | [.key, .value.signature, .value.url] | @tsv' "$manifest")

echo "provenance OK: tag '$want' ↔ latest.json ↔ artifacts all consistent"
