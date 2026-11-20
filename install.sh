#!/usr/bin/env bash
set -euo pipefail

main() {
  local use_build="${RESUMEFORGE_BUILD:-0}"
  local use_seed="${RESUMEFORGE_SEED:-0}"
  local use_down="${RESUMEFORGE_DOWN:-0}"
  local skip_open="${RESUMEFORGE_NO_OPEN:-0}"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --build)
        use_build=1
        shift
        ;;
      --seed)
        use_seed=1
        shift
        ;;
      --down|stop)
        use_down=1
        shift
        ;;
      --no-open)
        skip_open=1
        shift
        ;;
      -h|--help)
        cat <<'EOF'
ResumeForge Local Installer

Usage: ./install.sh [--build] [--seed] [--down] [--no-open]

Environment overrides:
  RESUMEFORGE_DIR      Install directory (default: ~/resumeforge or cloned repo root)
  RESUMEFORGE_PORT     Preferred app port (default: auto-selected from 3000..3020)
  RESUMEFORGE_NO_OPEN  Set to 1 to skip opening the browser
  RESUMEFORGE_REF      Git branch or tag for remote downloads (default: main)
EOF
        return 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        return 1
        ;;
    esac
  done

  local ref="${RESUMEFORGE_REF:-main}"
  if [[ ! "$ref" =~ ^[A-Za-z0-9._/-]+$ ]] || [[ "$ref" == *".."* ]]; then
    echo "Invalid RESUMEFORGE_REF: '$ref'." >&2
    return 1
  fi

  is_port_free() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
      ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    elif command -v ss >/dev/null 2>&1; then
      ! ss -ltn "sport = :$port" 2>/dev/null | grep -q ":$port "
    elif command -v nc >/dev/null 2>&1; then
      ! nc -z 127.0.0.1 "$port" >/dev/null 2>&1
    else
      if (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1; then
        return 1
      fi
      return 0
    fi
  }

  find_free_port() {
    local start="$1"
    local end="$2"
    local p
    for ((p = start; p <= end; p++)); do
      if is_port_free "$p"; then
        printf '%s\n' "$p"
        return 0
      fi
    done
    echo "No available loopback port found in range ${start}-${end}." >&2
    return 1
  }

  rand_alnum_32() {
    local raw=""
    while [[ "${#raw}" -lt 32 ]]; do
      if command -v openssl >/dev/null 2>&1; then
        raw+=$(openssl rand -base64 48 | LC_ALL=C tr -dc 'A-Za-z0-9' || true)
      else
        raw+=$(dd if=/dev/urandom bs=256 count=1 2>/dev/null | LC_ALL=C tr -dc 'A-Za-z0-9' || true)
      fi
    done
    printf '%s\n' "${raw:0:32}"
  }

  rand_hex_64() {
    if command -v openssl >/dev/null 2>&1; then
      openssl rand -hex 32
    else
      od -An -tx1 -N32 /dev/urandom | tr -d ' \n'
      printf '\n'
    fi
  }

  fetch_url() {
    local url="$1"
    local dest="$2"
    local tmp="${dest}.tmp"
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL "$url" -o "$tmp"
    elif command -v wget >/dev/null 2>&1; then
      wget -qO "$tmp" "$url"
    else
      echo "Either 'curl' or 'wget' is required to download ResumeForge files." >&2
      return 1
    fi
    mv -f "$tmp" "$dest"
  }

  read_dotenv_setting() {
    local env_file="$1"
    local key="$2"
    local default_val="$3"
    local line val
    if [[ ! -f "$env_file" ]]; then
      printf '%s\n' "$default_val"
      return 0
    fi
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      if [[ "$line" =~ ^[[:space:]]*${key}[[:space:]]*=[[:space:]]*(.*)[[:space:]]*$ ]]; then
        val="${BASH_REMATCH[1]}"
        val="${val%$'\r'}"
        val="${val#\"}"
        val="${val%\"}"
        val="${val#\'}"
        val="${val%\'}"
        if [[ -n "$val" ]]; then
          printf '%s\n' "$val"
          return 0
        fi
      fi
    done < "$env_file"
    printf '%s\n' "$default_val"
  }

  echo ""
  echo "ResumeForge Local Installer"

  # 1. Preflight Docker checks
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker was not found on PATH." >&2
    if [[ "$(uname -s)" == "Darwin" ]]; then
      echo "Install Docker Desktop for macOS, start it, and re-run this command:" >&2
      echo "  brew install --cask docker" >&2
    else
      echo "Install Docker Engine with Compose v2, start Docker, and re-run:" >&2
      echo "  https://docs.docker.com/engine/install/" >&2
    fi
    return 1
  fi

  if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose v2 is required ('docker compose version' failed)." >&2
    return 1
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but the Docker daemon is not running." >&2
    echo "Start Docker Desktop / dockerd and re-run this command." >&2
    return 1
  fi

  # 2. Resolve install directory
  local cwd is_repo_clone=0 install_dir
  cwd="$(pwd)"
  if [[ -f "${cwd}/docker-compose.yml" && -f "${cwd}/package.json" ]]; then
    is_repo_clone=1
  fi

  if [[ -n "${RESUMEFORGE_DIR:-}" ]]; then
    install_dir="$RESUMEFORGE_DIR"
    if [[ -f "${install_dir}/docker-compose.yml" && -f "${install_dir}/package.json" ]]; then
      is_repo_clone=1
    else
      is_repo_clone=0
    fi
  elif [[ "$is_repo_clone" -eq 1 ]]; then
    install_dir="$cwd"
  else
    install_dir="${HOME}/resumeforge"
  fi

  mkdir -p "$install_dir"
  local compose_path="${install_dir}/docker-compose.yml"
  local env_path="${install_dir}/.env"

  # 3. Handle --down
  if [[ "$use_down" == "1" ]]; then
    if [[ ! -f "$compose_path" ]]; then
      echo "Nothing to stop: ${compose_path} does not exist."
      return 0
    fi
    (cd "$install_dir" && docker compose down)
    echo "ResumeForge stopped. Your PostgreSQL data volume (resumeforge_pgdata) is preserved."
    return 0
  fi

  # 4. Download compose file when not running inside a cloned repo
  if [[ "$is_repo_clone" -eq 0 ]]; then
    local base_raw_url="https://raw.githubusercontent.com/ZenzerJs/ResumeForge/${ref}"
    echo "Syncing compose configuration into ${install_dir} ..."
    fetch_url "${base_raw_url}/docker-compose.yml" "$compose_path"
    if fetch_url "${base_raw_url}/install.sh" "${install_dir}/install.sh"; then
      chmod +x "${install_dir}/install.sh"
    fi
  fi

  # 5. Idempotent .env bootstrap
  if [[ ! -f "$env_path" ]]; then
    local app_port pg_port pg_password app_secret sync_secret
    if [[ -n "${RESUMEFORGE_PORT:-}" ]]; then
      if [[ ! "${RESUMEFORGE_PORT}" =~ ^[0-9]+$ ]] || (( RESUMEFORGE_PORT < 1 || RESUMEFORGE_PORT > 65535 )); then
        echo "Invalid RESUMEFORGE_PORT: '${RESUMEFORGE_PORT}'." >&2
        return 1
      fi
      app_port="$RESUMEFORGE_PORT"
    else
      app_port="$(find_free_port 3000 3020)"
    fi
    pg_port="$(find_free_port 5432 5450)"
    pg_password="$(rand_alnum_32)"
    app_secret="$(rand_hex_64)"
    sync_secret="$(rand_hex_64)"

    (
      umask 077
      cat > "$env_path" <<EOF
# Auto-generated by ResumeForge install.sh
POSTGRES_USER=resumeforge
POSTGRES_PASSWORD=${pg_password}
POSTGRES_DB=resumeforge
POSTGRES_PORT=${pg_port}
APP_BIND_ADDRESS=127.0.0.1
APP_PORT=${app_port}
NEXT_PUBLIC_APP_URL=http://localhost:${app_port}
APP_ACCESS_SECRET=${app_secret}
JOB_SYNC_SECRET=${sync_secret}
DEMO_MODE=false
EOF
    )
    chmod 600 "$env_path"
    echo "Created ${env_path} with generated secrets (app port: ${app_port}, postgres port: ${pg_port})."
  else
    echo "Using existing ${env_path} (preserving secrets and ports)."
  fi

  local active_app_port local_url health_url
  active_app_port="$(read_dotenv_setting "$env_path" "APP_PORT" "3000")"
  local_url="http://localhost:${active_app_port}"
  health_url="http://127.0.0.1:${active_app_port}/login"

  # 6. Pull / Build & Launch
  if [[ "$use_build" == "1" ]]; then
    if [[ ! -f "${install_dir}/Dockerfile" ]]; then
      echo "--build requires a cloned ResumeForge repository with a Dockerfile." >&2
      return 1
    fi
    echo "Building and starting ResumeForge containers locally ..."
    (cd "$install_dir" && docker compose up --build -d)
  else
    echo "Pulling latest ResumeForge image ..."
    if ! (cd "$install_dir" && docker compose pull); then
      echo "Failed to pull container image from GHCR." >&2
      if [[ -f "${install_dir}/Dockerfile" ]]; then
        echo "You can build locally instead with: ./install.sh --build" >&2
      fi
      return 1
    fi
    echo "Starting ResumeForge containers ..."
    (cd "$install_dir" && docker compose up -d --no-build)
  fi

  # 7. Wait for readiness
  echo "Waiting for ResumeForge to accept connections at ${health_url} ..."
  local ready=0
  local elapsed=0
  while (( elapsed < 90 )); do
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS --max-time 3 "$health_url" >/dev/null 2>&1; then
        ready=1
        break
      fi
    elif command -v wget >/dev/null 2>&1; then
      if wget -qO- --timeout=3 "$health_url" >/dev/null 2>&1; then
        ready=1
        break
      fi
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  if [[ "$ready" -ne 1 ]]; then
    echo "ResumeForge did not respond at ${health_url} within 90 seconds." >&2
    echo "Inspect startup logs with:" >&2
    echo "  docker compose -f \"${compose_path}\" logs --tail=50 app" >&2
    return 1
  fi

  if [[ "$use_seed" == "1" ]]; then
    echo "Seeding sample Evidence Bank data ..."
    (cd "$install_dir" && docker compose exec -T app node --experimental-strip-types prisma/seed.ts) || true
  fi

  echo ""
  echo "ResumeForge is ready at ${local_url}"
  echo "  Data folder : ${install_dir}"
  echo "  Stop        : docker compose -f \"${compose_path}\" down"
  echo "  Logs        : docker compose -f \"${compose_path}\" logs -f app"
  echo "  Update      : Re-run the install command (data is preserved)"
  echo ""

  if [[ "$skip_open" != "1" ]]; then
    if [[ "$(uname -s)" == "Darwin" ]] && command -v open >/dev/null 2>&1; then
      open "$local_url" >/dev/null 2>&1 || true
    elif command -v xdg-open >/dev/null 2>&1 && { [[ -n "${DISPLAY:-}" ]] || [[ -n "${WAYLAND_DISPLAY:-}" ]]; }; then
      xdg-open "$local_url" >/dev/null 2>&1 &
    fi
  fi
}

main "$@"
