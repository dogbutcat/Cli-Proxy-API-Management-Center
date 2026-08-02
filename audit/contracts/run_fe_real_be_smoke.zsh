#!/bin/zsh
source ~/.zshrc >/dev/null 2>&1
setopt aliases
set -euo pipefail

FE_ROOT="/Users/oliver/Documents/Projects/ai/Cli-Proxy-API-Management-Center-upgrade-fe-b1aefec"
BE_ROOT="/Users/oliver/Documents/Projects/ai/CLIProxyAPI-upgrade-be-bc71c77"
PLAN_CONTRACT_DIR="/Users/oliver/Documents/Projects/ai/myclaude/memories/plans/upgrade_be_fe_upstream/audit/contracts"
CONTRACT_JSON="$PLAN_CONTRACT_DIR/api_contract.json"
CONTRACT_SHA_FILE="$PLAN_CONTRACT_DIR/api_contract.sha256"
OUT_DIR="$FE_ROOT/audit/contracts"
KEY="contract-management-key"
PORT="${PORT:-38327}"
TMPDIR="$(mktemp -d)"
LOG="$OUT_DIR/fe_real_be_server.log"
RESULT_JSON="$OUT_DIR/fe_real_be_smoke.json"
RESULT_MD="$OUT_DIR/fe_real_be_smoke.md"
CONFIG="$TMPDIR/config.yaml"
PID=""

cleanup() {
  if [[ -n "$PID" ]] && kill -0 "$PID" >/dev/null 2>&1; then
    kill "$PID" >/dev/null 2>&1 || true
    wait "$PID" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

mkdir -p "$OUT_DIR" "$TMPDIR/auths" "$TMPDIR/import-sessions"

cat > "$CONFIG" <<YAML
host: "127.0.0.1"
port: $PORT
auth-dir: "$TMPDIR/auths"
api-keys:
  - "contract-api-key"
remote-management:
  allow-remote: false
  secret-key: ""
  disable-control-panel: true
usage-import-session:
  dir: "$TMPDIR/import-sessions"
  chunk-size-bytes: 1048576
  max-session-bytes: 10485760
  max-active: 2
  ttl-minutes: 60
YAML

cd "$BE_ROOT"
MANAGEMENT_PASSWORD="$KEY" go run ./cmd/server --config "$CONFIG" --no-browser >"$LOG" 2>&1 &
PID="$!"

for _ in {1..100}; do
  if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done
curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null

auth=(-H "Authorization: Bearer $KEY")

request() {
  local name="$1"
  local method="$2"
  local route_path="$3"
  local body="${4:-}"
  local outfile="$TMPDIR/$name.json"
  local http_status

  if [[ -n "$body" ]]; then
    http_status="$(curl -sS "${auth[@]}" -H "Content-Type: application/json" -X "$method" -d "$body" -o "$outfile" -w "%{http_code}" "http://127.0.0.1:$PORT$route_path")"
  else
    http_status="$(curl -sS "${auth[@]}" -X "$method" -o "$outfile" -w "%{http_code}" "http://127.0.0.1:$PORT$route_path")"
  fi

  python3 - "$outfile" "$name" "$http_status" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
name = sys.argv[2]
status = int(sys.argv[3])
text = path.read_text(encoding="utf-8")
try:
    payload = json.loads(text) if text else {}
except json.JSONDecodeError as exc:
    raise SystemExit(f"{name}: non-JSON response at {status}: {exc}") from exc

json.dump({"name": name, "status": status, "payload": payload}, sys.stdout)
PY
}

now_ms="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"
today_ms="$(( now_ms - (now_ms % 86400000) ))"
analytics_body='{"range":{"from_ms":0,"to_ms":'"$now_ms"'},"granularity":"day","include":{"totals":true,"series":true,"breakdowns":true}}'
create_body='{"filename":"contract.jsonl","size_bytes":0,"resume_key":"contract-resume"}'

unauth_code="$(curl -sS -o "$TMPDIR/unauth.json" -w "%{http_code}" "http://127.0.0.1:$PORT/v0/management/usage/capabilities")"
[[ "$unauth_code" == "401" ]]

{
  request capabilities GET "/v0/management/usage/capabilities"
  echo
  request usage_status GET "/v0/management/usage/status"
  echo
  request auth_files GET "/v0/management/auth-files"
  echo
  request opencode GET "/v0/management/opencode-go"
  echo
  request opencode_quota GET "/v0/management/opencode-go/quota"
  echo
  request dashboard GET "/v0/management/usage/dashboard/summary?today_start_ms=$today_ms&now_ms=$now_ms"
  echo
  request monitoring_accounts GET "/v0/management/usage/monitoring/accounts?from_ms=0&to_ms=$now_ms"
  echo
  request monitoring_keys GET "/v0/management/usage/monitoring/keys?from_ms=0&to_ms=$now_ms"
  echo
  request monitoring_realtime GET "/v0/management/usage/monitoring/realtime?limit=5"
  echo
  request monitoring_selectors GET "/v0/management/usage/monitoring/selectors?from_ms=0&to_ms=$now_ms"
  echo
  request monitoring_analytics POST "/v0/management/usage/monitoring/analytics" "$analytics_body"
  echo
  request model_prices GET "/v0/management/model-prices"
  echo
  request model_prices_usage GET "/v0/management/model-prices/usage-summary?from_ms=0&to_ms=$now_ms"
  echo
  request account_actions GET "/v0/management/account-action-candidates"
  echo
  request import_session POST "/v0/management/usage/import-sessions" "$create_body"
  echo
} > "$TMPDIR/routes.ndjson"

actual_sha="$(shasum -a 256 "$CONTRACT_JSON" | awk '{print $1}')"
expected_sha="$(awk '{print $1}' "$CONTRACT_SHA_FILE")"
[[ "$actual_sha" == "$expected_sha" ]]

python3 - "$TMPDIR/routes.ndjson" "$RESULT_JSON" "$RESULT_MD" "$actual_sha" "$BE_ROOT" "$FE_ROOT" "$unauth_code" <<'PY'
import json
import pathlib
import sys

routes_file = pathlib.Path(sys.argv[1])
result_json = pathlib.Path(sys.argv[2])
result_md = pathlib.Path(sys.argv[3])
contract_sha = sys.argv[4]
be_root = pathlib.Path(sys.argv[5])
fe_root = pathlib.Path(sys.argv[6])
unauth_code = int(sys.argv[7])

rows = [json.loads(line) for line in routes_file.read_text(encoding="utf-8").splitlines() if line.strip()]
status_by_name = {row["name"]: row["status"] for row in rows}
payload_by_name = {row["name"]: row["payload"] for row in rows}

expected = {
    "capabilities": {200},
    "usage_status": {200},
    "auth_files": {200},
    "opencode": {200},
    "opencode_quota": {200},
    "dashboard": {200, 500},
    "monitoring_accounts": {200, 500},
    "monitoring_keys": {200, 500},
    "monitoring_realtime": {200, 500},
    "monitoring_selectors": {200, 500},
    "monitoring_analytics": {200, 400, 500},
    "model_prices": {200, 500},
    "model_prices_usage": {200, 500},
    "account_actions": {200, 501},
    "import_session": {200, 201},
}

failures = []
if unauth_code != 401:
    failures.append(f"unauth capabilities returned {unauth_code}, expected 401")

for name, allowed in expected.items():
    status = status_by_name.get(name)
    if status not in allowed:
        failures.append(f"{name} returned {status}, expected one of {sorted(allowed)}")

capabilities = payload_by_name.get("capabilities", {})
if not isinstance(capabilities, dict):
    failures.append("capabilities payload is not an object")
else:
    account_actions = capabilities.get("account_actions")
    if not isinstance(account_actions, dict) or account_actions.get("supported") is not False:
        failures.append("capabilities.account_actions.supported is not false")

auth_files = payload_by_name.get("auth_files")
if not isinstance(auth_files, dict):
    failures.append("auth_files payload is not an object")
elif "files" not in auth_files:
    failures.append("auth_files payload is missing files")

import_session = payload_by_name.get("import_session", {})
import_text = json.dumps(import_session, sort_keys=True)
if "contract-resume" in import_text or "resume_key" in import_text:
    failures.append("import session response leaked resume key material")

for name, payload in payload_by_name.items():
    if not isinstance(payload, (dict, list)):
        failures.append(f"{name} payload is not an object or array")
    if status_by_name[name] >= 400:
        if not isinstance(payload, dict) or not any(key in payload for key in ("error", "message", "code")):
            failures.append(f"{name} error payload is missing an error envelope")

if failures:
    raise SystemExit("; ".join(failures))

result = {
    "status": "PASS",
    "stage": "G5",
    "fe_worktree": str(fe_root),
    "be_worktree": str(be_root),
    "contract_sha256": contract_sha,
    "auth_negative_status": unauth_code,
    "routes": [{"name": row["name"], "status": row["status"]} for row in rows],
}
result_json.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")

lines = [
    "# FE Real BE Smoke",
    "",
    "- status: PASS",
    f"- contract sha256: {contract_sha}",
    f"- unauth capabilities: {unauth_code}",
    "",
    "| Route | Status |",
    "| :--- | :---: |",
]
for row in rows:
    lines.append(f"| `{row['name']}` | {row['status']} |")
result_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

echo "FE_REAL_BE_SMOKE_OK"
