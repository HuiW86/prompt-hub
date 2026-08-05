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

# 2. the manifest must actually describe something. An empty platforms map makes
#    the loop below iterate zero times, so every downstream check would pass
#    vacuously and ship a manifest no updater can resolve.
[ "$(jq -r '.platforms | length' "$manifest")" -gt 0 ] || fail "latest.json has no platform entries"

# 3. every platform entry has a signature and a URL whose basename exists in dist
#    and carries the tag version; and a matching .sig file is present.
# Fields are joined on US (0x1f), not tab: tab is an IFS whitespace class, so
# `read` would collapse consecutive tabs and shift an empty signature's columns,
# masking the real cause behind a confusing downstream error.
while IFS=$'\x1f' read -r plat sig url; do
  [ -n "$sig" ] || fail "platform '$plat' has an empty signature"
  file="$(basename "$url")"
  case "$file" in
    *"$want"*) : ;;
    *) fail "artifact '$file' for '$plat' does not carry version '$want'" ;;
  esac
  [ -f "$dist/$file" ] || fail "artifact '$file' referenced by latest.json is missing"
  [ -f "$dist/$file.sig" ] || fail "signature '$file.sig' is missing"
done < <(jq -r '.platforms | to_entries[] | [.key, .value.signature, .value.url] | join("\u001f")' "$manifest")

# 4. reverse direction: every updater package staged in dist must be claimed by
#    latest.json. Checking only manifest → artifacts lets a partial manifest
#    (one arch silently dropped by the sign loop) reach the draft release.
shopt -s nullglob
archives=("$dist"/*.app.tar.gz)
shopt -u nullglob
[ ${#archives[@]} -gt 0 ] || fail "no updater package (.app.tar.gz) present in $dist"
for archive in "${archives[@]}"; do
  name="$(basename "$archive")"
  jq -e --arg n "$name" '[.platforms[].url | split("/") | last] | any(. == $n)' "$manifest" >/dev/null \
    || fail "updater package '$name' is staged but not referenced by latest.json"
done

echo "provenance OK: tag '$want' ↔ latest.json ↔ artifacts all consistent"
