#!/bin/sh
set -e

# ============================================================
# DTSD Dashboard — Docker Entrypoint
# ============================================================
# Adjusts the nextjs user UID/GID at runtime if PUID/PGID
# environment variables are set, then drops privileges via
# su-exec. No-op if PUID/PGID match the built-in values.
#
# Usage:
#   docker run -e PUID=1000 -e PGID=1000 dtsd
# ============================================================

# Default to built-in UID/GID if not overridden
PUID="${PUID:-$(id -u nextjs)}"
PGID="${PGID:-$(getent group nodejs | cut -d: -f3)}"

CURRENT_UID=$(id -u nextjs)
CURRENT_GID=$(getent group nodejs | cut -d: -f3)

# Adjust GID if different from built-in
if [ "$PGID" != "$CURRENT_GID" ]; then
  echo "entrypoint: adjusting nodejs group GID $CURRENT_GID → $PGID"
  sed -i "s/nodejs:x:${CURRENT_GID}:/nodejs:x:${PGID}:/" /etc/group
fi

# Adjust UID if different from built-in
if [ "$PUID" != "$CURRENT_UID" ]; then
  echo "entrypoint: adjusting nextjs user UID $CURRENT_UID → $PUID"
  sed -i "s/nextjs:x:${CURRENT_UID}:/nextjs:x:${PUID}:/" /etc/passwd
fi

# Fix ownership of writable directories
chown -R nextjs:nodejs /app/data /app/logs 2>/dev/null || true

# Drop to nextjs user and exec CMD
exec su-exec nextjs:nodejs "$@"
