#!/bin/sh
set -e

LOG_PATH="/app/debug-46631d.log"
SESSION_ID="46631d"

log_event() {
  message="$1"
  data="$2"
  ts=$(date +%s000 2>/dev/null || date +%s)
  printf '{"sessionId":"%s","runId":"entrypoint","hypothesisId":"H3","location":"docker-entrypoint.sh","message":"%s","data":%s,"timestamp":%s}\n' \
    "$SESSION_ID" "$message" "$data" "$ts" >> "$LOG_PATH" 2>/dev/null || true
}

if [ -z "$REDIS_URL" ]; then
  log_event "REDIS_URL unset; starting bundled Redis" '{"bundledRedis":true}'
  redis-server \
    --daemonize yes \
    --appendonly yes \
    --maxmemory 256mb \
    --maxmemory-policy allkeys-lru
  export REDIS_URL="redis://127.0.0.1:6379"
  log_event "Bundled Redis started" '{"redisUrl":"redis://127.0.0.1:6379"}'
else
  log_event "Using external REDIS_URL" '{"bundledRedis":false,"hasRedisUrl":true}'
fi

exec node server/index.js
