#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5173}"
if [[ -n "${PYTHON_BIN:-}" ]]; then
  :
elif command -v python3 >/dev/null 2>&1 && python3 -c 'import json' >/dev/null 2>&1; then
  PYTHON_BIN=python3
elif command -v python >/dev/null 2>&1 && python -c 'import json' >/dev/null 2>&1; then
  PYTHON_BIN=python
else
  printf 'Python 3 é necessário para interpretar a resposta CSRF.\n' >&2
  exit 1
fi

RAW_WORK_DIR="$(mktemp -d)"
WORK_DIR="$RAW_WORK_DIR"
if command -v cygpath >/dev/null 2>&1; then
  WORK_DIR="$(cygpath -m "$RAW_WORK_DIR")"
fi
COOKIE_JAR="$WORK_DIR/cookies.txt"
BODY="$WORK_DIR/body.json"
trap 'rm -rf "$RAW_WORK_DIR"' EXIT

assert_status() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    printf 'FAIL %s: esperado HTTP %s, recebido %s\n' "$label" "$expected" "$actual" >&2
    if [[ -s "$BODY" ]]; then
      printf '%s\n' '--- resposta ---' >&2
      while IFS= read -r line; do
        printf '%s\n' "$line" >&2
      done < "$BODY"
    fi
    exit 1
  fi
  printf 'PASS %-30s HTTP %s\n' "$label" "$actual"
}

status="$(curl --silent --show-error --output "$BODY" --write-out '%{http_code}' "$BASE_URL/healthz")"
assert_status 200 "$status" 'frontend health'

status="$(curl --silent --show-error --output "$BODY" --write-out '%{http_code}' "$BASE_URL/actuator/health")"
assert_status 200 "$status" 'backend health'

status="$(curl --silent --show-error --path-as-is --request POST --output "$BODY" \
  --write-out '%{http_code}' "$BASE_URL/api/v1/auth/login;matrix=x")"
assert_status 400 "$status" 'matrix path rejected'

status="$(curl --silent --show-error --path-as-is --request POST --output "$BODY" \
  --write-out '%{http_code}' "$BASE_URL/api/v1/auth/login%3Bmatrix=x")"
assert_status 400 "$status" 'encoded matrix path rejected'

status="$(curl --silent --show-error --output "$BODY" --write-out '%{http_code}' "$BASE_URL/api/v1/ingredients")"
assert_status 401 "$status" 'anonymous denied'

status="$(curl --silent --show-error --cookie-jar "$COOKIE_JAR" --cookie "$COOKIE_JAR" \
  --output "$BODY" --write-out '%{http_code}' "$BASE_URL/api/v1/auth/csrf")"
assert_status 200 "$status" 'csrf issued'
CSRF_TOKEN="$("$PYTHON_BIN" -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["token"])' "$BODY")"

RUN_ID="${GITHUB_RUN_ID:-$(date +%s)}"
EMAIL="smoke-${RUN_ID}-${RANDOM}@example.test"
PASSWORD='smoke-password-123'
printf '{"displayName":"Smoke Test","email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD" > "$WORK_DIR/register.json"
printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD" > "$WORK_DIR/login.json"

status="$(curl --silent --show-error --cookie-jar "$COOKIE_JAR" --cookie "$COOKIE_JAR" \
  --header 'Content-Type: application/json' --header "X-CSRF-TOKEN: $CSRF_TOKEN" \
  --data-binary "@$WORK_DIR/register.json" --output "$BODY" --write-out '%{http_code}' \
  "$BASE_URL/api/v1/auth/register")"
assert_status 201 "$status" 'register'

status="$(curl --silent --show-error --cookie-jar "$COOKIE_JAR" --cookie "$COOKIE_JAR" \
  --header 'Content-Type: application/json' --header "X-CSRF-TOKEN: $CSRF_TOKEN" \
  --data-binary "@$WORK_DIR/login.json" --output "$BODY" --write-out '%{http_code}' \
  "$BASE_URL/api/v1/auth/login")"
assert_status 200 "$status" 'login'

status="$(curl --silent --show-error --cookie "$COOKIE_JAR" \
  --output "$BODY" --write-out '%{http_code}' "$BASE_URL/api/v1/auth/me")"
assert_status 200 "$status" 'session restored'

printf '{"name":"Ingrediente Smoke %s","description":"Criado pelo smoke test","defaultUnit":"GRAM"}' "$RUN_ID-$RANDOM" > "$WORK_DIR/ingredient.json"
status="$(curl --silent --show-error --cookie "$COOKIE_JAR" \
  --header 'Content-Type: application/json' --header "X-CSRF-TOKEN: $CSRF_TOKEN" \
  --data-binary "@$WORK_DIR/ingredient.json" --output "$BODY" --write-out '%{http_code}' \
  "$BASE_URL/api/v1/ingredients")"
assert_status 201 "$status" 'authenticated mutation'

status="$(curl --silent --show-error --cookie-jar "$COOKIE_JAR" --cookie "$COOKIE_JAR" \
  --request POST --header "X-CSRF-TOKEN: $CSRF_TOKEN" \
  --output "$BODY" --write-out '%{http_code}' "$BASE_URL/api/v1/auth/logout")"
assert_status 204 "$status" 'logout'

status="$(curl --silent --show-error --cookie "$COOKIE_JAR" \
  --output "$BODY" --write-out '%{http_code}' "$BASE_URL/api/v1/auth/me")"
assert_status 401 "$status" 'session invalidated'

saw_rate_limit=false
for attempt in $(seq 1 10); do
  status="$(curl --silent --show-error --request POST \
    --header "X-Forwarded-For: 198.51.100.$attempt" \
    --header 'Content-Type: application/json' --data '{}' \
    --output "$BODY" --write-out '%{http_code}' "$BASE_URL/api/v1/auth/login")"
  if [[ "$status" == "429" ]]; then
    saw_rate_limit=true
    break
  fi
done
if [[ "$saw_rate_limit" != "true" ]]; then
  printf 'FAIL forged X-Forwarded-For bypassed authentication rate limit\n' >&2
  exit 1
fi
printf 'PASS %-30s HTTP 429\n' 'forged proxy IP rate limited'

printf 'Security smoke test completed successfully.\n'
