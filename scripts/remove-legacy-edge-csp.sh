#!/usr/bin/env bash
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"

API='https://api.cloudflare.com/client/v4'
ZONE_NAME="${CLOUDFLARE_ZONE_NAME:-otya.site}"
PHASE='http_response_headers_transform'

cf_get() {
  curl --fail-with-body --silent --show-error \
    --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    --header 'Content-Type: application/json' \
    "$1"
}

zone_json="$(cf_get "${API}/zones?name=${ZONE_NAME}&status=active&per_page=50")"
zone_id="$(printf '%s' "$zone_json" | jq -r --arg name "$ZONE_NAME" '[.result[] | select(.name == $name) | .id] | if length == 1 then .[0] else empty end')"
if [[ -z "$zone_id" ]]; then
  echo '::error::Could not resolve exactly one active Otya zone: ${ZONE_NAME}.'
  exit 1
fi

ruleset_http="$(curl --silent --show-error --output /tmp/otya-edge-ruleset.json --write-out '%{http_code}' \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  --header 'Content-Type: application/json' \
  "${API}/zones/${zone_id}/rulesets/phases/${PHASE}/entrypoint")"

if [[ "$ruleset_http" == '404' ]]; then
  echo 'No zone-level response-header transform ruleset exists.'
  exit 0
fi
if [[ "$ruleset_http" != '200' ]]; then
  echo "::error::Could not inspect response-header transform rules (HTTP ${ruleset_http})."
  cat /tmp/otya-edge-ruleset.json
  exit 1
fi

ruleset_id="$(jq -r '.result.id // empty' /tmp/otya-edge-ruleset.json)"
if [[ -z "$ruleset_id" ]]; then
  echo '::error::Response-header transform ruleset response did not contain an ID.'
  exit 1
fi

# The obsolete policy is intentionally fingerprinted by several independent
# markers. The canonical OTYA policy does not contain unsafe-eval, GTM or
# static.cloudflareinsights.com in production. Never delete based on name alone.
legacy_matches="$(jq -c '[
  .result.rules[]?
  | . as $rule
  | ([($rule.action_parameters.headers // {}) | to_entries[]
      | select((.key | ascii_downcase) == "content-security-policy")
      | (.value.value // "")][0] // "") as $csp
  | select(
      $rule.action == "rewrite"
      and ($csp | contains("unsafe-eval"))
      and ($csp | contains("www.googletagmanager.com"))
      and ($csp | contains("static.cloudflareinsights.com"))
      and ($csp | contains("frame-src '"'"'self'"'"' https://accounts.google.com"))
      and (($csp | contains("script-src '"'"'self'"'"' '"'"'unsafe-inline'"'"' '"'"'unsafe-eval'"'"' https://www.googletagmanager.com")))
    )
  | {id, ref, description}
]' /tmp/otya-edge-ruleset.json)"

match_count="$(printf '%s' "$legacy_matches" | jq 'length')"
if [[ "$match_count" == '0' ]]; then
  echo 'No obsolete OTYA CSP response-header transform rule matched the protected fingerprint.'
  exit 0
fi
if [[ "$match_count" != '1' ]]; then
  echo "::error::Found ${match_count} obsolete-CSP candidates; refusing to guess."
  printf '%s\n' "$legacy_matches"
  exit 1
fi

rule_id="$(printf '%s' "$legacy_matches" | jq -r '.[0].id')"
rule_desc="$(printf '%s' "$legacy_matches" | jq -r '.[0].description // .[0].ref // "unnamed rule"')"
echo "Removing obsolete OTYA CSP response-header rule: ${rule_desc} (${rule_id})"

delete_http="$(curl --silent --show-error --output /tmp/otya-edge-delete.json --write-out '%{http_code}' \
  --request DELETE \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  --header 'Content-Type: application/json' \
  "${API}/zones/${zone_id}/rulesets/${ruleset_id}/rules/${rule_id}")"
if [[ "$delete_http" != '200' ]]; then
  echo "::error::Cloudflare refused deletion of the identified obsolete CSP rule (HTTP ${delete_http})."
  cat /tmp/otya-edge-delete.json
  exit 1
fi

echo 'Obsolete edge CSP transform removed. Canonical browser policy remains owned by otya-core.'
