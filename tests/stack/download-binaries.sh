#!/usr/bin/env bash
# Download the pinned Supabase Auth and PostgREST release binaries for the local test stack (Linux x86-64).
set -euo pipefail
AUTH_VERSION="${AUTH_VERSION:-v2.197.0}"
POSTGREST_VERSION="${POSTGREST_VERSION:-v13.0.8}"
DEST="${STACK_BIN_DIR:-$(dirname "$0")/../../.stack/bin}"
mkdir -p "$DEST"
cd "$DEST"
curl -fsSL -o auth.tar.gz "https://github.com/supabase/auth/releases/download/${AUTH_VERSION}/auth-${AUTH_VERSION}-x86.tar.gz"
tar xzf auth.tar.gz && rm auth.tar.gz
curl -fsSL -o postgrest.tar.xz "https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-linux-static-x86-64.tar.xz"
tar xJf postgrest.tar.xz && rm postgrest.tar.xz
./auth --help >/dev/null 2>&1 || true
./postgrest --version
echo "Binaries ready in $DEST"
