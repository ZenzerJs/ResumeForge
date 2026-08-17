#!/bin/sh
PGDATA="/mnt/host/c/Users/jayde/.gemini/config/projects/Resume-Forge/.pgdata"
mkdir -p /run/postgresql
chown -R postgres:postgres /run/postgresql

mkdir -p "$PGDATA"
chmod 700 "$PGDATA"
chown -R postgres:postgres "$PGDATA" 2>/dev/null || true

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  su-exec postgres initdb -D "$PGDATA" -E UTF8 --no-locale
  echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"
  echo "unix_socket_directories = '/run/postgresql'" >> "$PGDATA/postgresql.conf"
  echo "host all all 0.0.0.0/0 trust" >> "$PGDATA/pg_hba.conf"
  echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
  echo "host all all ::1/128 trust" >> "$PGDATA/pg_hba.conf"
else
  echo "unix_socket_directories = '/run/postgresql'" >> "$PGDATA/postgresql.conf"
fi

su-exec postgres pg_ctl -D "$PGDATA" -l /tmp/pg_logfile.log start
sleep 2
su-exec postgres psql -h 127.0.0.1 -U postgres -c "CREATE USER resumeforge WITH SUPERUSER PASSWORD 'resumeforge';" || true
su-exec postgres psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE resumeforge OWNER resumeforge;" || true
