#!/usr/bin/env bash
set -euo pipefail
PROJECT="/opt/signal-scheduler-web"
SSH_DROPIN="/etc/ssh/sshd_config.d/00-signal-scheduler-hardening.conf"
BACKUP_WRAPPER="/usr/local/sbin/signal-scheduler-backup"
SERVICE="/etc/systemd/system/signal-scheduler-backup.service"
TIMER="/etc/systemd/system/signal-scheduler-backup.timer"
STAMP="$(date +%Y%m%d_%H%M%S)"

[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
[ -f "$PROJECT/backup.sh" ] || { echo "Missing $PROJECT/backup.sh"; exit 1; }
[ -s /root/.ssh/authorized_keys ] || { echo "No root SSH public key found; aborting to prevent lockout"; exit 2; }

mkdir -p "$PROJECT/backups" /root/signal-security-backups
chmod 700 "$PROJECT/backups"
chmod 600 "$PROJECT/.env" "$PROJECT/Caddyfile.runtime" "$PROJECT/updater/update_private.pem" 2>/dev/null || true
cp -a /etc/ssh/sshd_config "/root/signal-security-backups/sshd_config.$STAMP" 2>/dev/null || true
cp -a /etc/ssh/sshd_config.d "/root/signal-security-backups/sshd_config.d.$STAMP" 2>/dev/null || true

cat > "$SSH_DROPIN" <<'SSHCONF'
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PermitEmptyPasswords no
PermitRootLogin prohibit-password
X11Forwarding no
MaxAuthTries 4
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
SSHCONF
/usr/sbin/sshd -t
SSH_EFFECTIVE="$(/usr/sbin/sshd -T)"
grep -qx 'passwordauthentication no' <<<"$SSH_EFFECTIVE" || { echo "SSH hardening verification failed: passwordauthentication is not no"; exit 3; }
grep -Eq '^permitrootlogin (prohibit-password|without-password)

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ufw fail2ban >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH key only' >/dev/null
ufw allow 80/tcp comment 'HTTP redirect ACME' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw allow 443/udp comment 'HTTPS HTTP3' >/dev/null
ufw --force enable >/dev/null

cat > /etc/fail2ban/jail.d/signal-scheduler-sshd.local <<'JAIL'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
JAIL
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban

cat > "$BACKUP_WRAPPER" <<'BACKUP'
#!/usr/bin/env bash
set -euo pipefail
PROJECT="/opt/signal-scheduler-web"
exec 9>/run/lock/signal-scheduler-backup.lock
flock -n 9 || exit 0
umask 077
cd "$PROJECT"
bash ./backup.sh
LATEST="$(ls -1dt "$PROJECT"/backups/*/ 2>/dev/null | head -n 1 || true)"
if [ -n "$LATEST" ]; then
  install -m 600 "$PROJECT/updater/update_private.pem" "$LATEST/update_private.pem" 2>/dev/null || true
  printf 'created_at=%s\nserver=%s\n' "$(date -Is)" "$(hostname)" > "$LATEST/BACKUP_INFO.txt"
  chmod -R go-rwx "$LATEST"
fi
find "$PROJECT/backups" -mindepth 1 -maxdepth 1 -type d -mtime +7 -print -exec rm -rf -- {} +
BACKUP
chmod 700 "$BACKUP_WRAPPER"

cat > "$SERVICE" <<'UNIT'
[Unit]
Description=Signal Scheduler daily backup
Requires=docker.service
After=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/signal-scheduler-backup
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
UNIT

cat > "$TIMER" <<'TIMERUNIT'
[Unit]
Description=Run Signal Scheduler backup every day
[Timer]
OnCalendar=*-*-* 04:30:00
Persistent=true
RandomizedDelaySec=15m
Unit=signal-scheduler-backup.service
[Install]
WantedBy=timers.target
TIMERUNIT
systemctl daemon-reload
systemctl enable --now signal-scheduler-backup.timer >/dev/null
systemctl start signal-scheduler-backup.service
RESULT="$(systemctl show -p Result --value signal-scheduler-backup.service)"
[ "$RESULT" = "success" ] || { echo "Initial backup failed: $RESULT"; systemctl status --no-pager signal-scheduler-backup.service || true; exit 4; }
LATEST="$(ls -1dt "$PROJECT"/backups/*/ 2>/dev/null | head -n 1 || true)"
[ -n "$LATEST" ] && [ -s "${LATEST}scheduler_data.tar.gz" ] || { echo "Backup verification failed"; exit 5; }

# Stage a real V8.1.1 encrypted package locally so the web updater can be tested.
STAGING="$PROJECT/.staging_v811"
PKGDIR="$PROJECT/.update_packages"
rm -rf "$STAGING"
mkdir -p "$STAGING/app/static" "$PKGDIR"
cp "$PROJECT/app/main.py" "$STAGING/app/main.py"
cp "$PROJECT/app/static/index.html" "$STAGING/app/static/index.html"
sed -i 's/APP_BUILD = "8.1.0-web-20261007"/APP_BUILD = "8.1.1-web-20261007"/' "$STAGING/app/main.py"
sed -i 's/V8\.0\.1 Web · 云端账号隔离版/V8.1.1 Web · 安全备份收尾版/g' "$STAGING/app/static/index.html"
sed -i "s/8\.1\.0-web-20261007/8.1.1-web-20261007/g" "$STAGING/app/static/index.html"

docker exec signal-scheduler-updater python /project/scripts/build_update_package.py   --public-key /project/updater/update_public.pem   --source-dir /project/.staging_v811   --version 8.1.1   --build 8.1.1-web-20261007   --file app/main.py   --file app/static/index.html   --output /project/.update_packages/v8.1.1.ssu >/tmp/signal_update_build.json

PKG="$PKGDIR/v8.1.1.ssu"
SHA="$(sha256sum "$PKG" | awk '{print $1}')"
docker exec signal-scheduler-caddy sh -c 'mkdir -p /data/updates/__updates'
docker cp "$PKG" signal-scheduler-caddy:/data/updates/__updates/v8.1.1.ssu >/dev/null

SITE="$(awk '/^[[:space:]]*[^#[:space:]][^ ]*[[:space:]]*\\{$/{print $1; exit}' "$PROJECT/Caddyfile.runtime")"
HASH="$(awk '/^[[:space:]]*admin[[:space:]]+/{print $2; exit}' "$PROJECT/Caddyfile.runtime")"
[ -n "$SITE" ] && [ -n "$HASH" ] || { echo "Could not read Caddy site/password hash"; exit 6; }
cat > "$PROJECT/Caddyfile.runtime" <<EOF
$SITE {
    encode zstd gzip
    handle /__updates/* {
        root * /data/updates
        file_server
    }
    handle {
        basic_auth {
            admin $HASH
        }
        reverse_proxy scheduler:8800
    }
}
EOF

docker exec signal-scheduler-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null
docker exec signal-scheduler-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null

echo "DONE"
echo "SSH_PASSWORD_AUTH=$(/usr/sbin/sshd -T | awk '/^passwordauthentication /{print $2;exit}')"
echo "SSH_ROOT_LOGIN=$(/usr/sbin/sshd -T | awk '/^permitrootlogin /{print $2;exit}')"
echo "UFW=$(ufw status | head -n 1)"
echo "FAIL2BAN=$(systemctl is-active fail2ban)"
echo "BACKUP_TIMER=$(systemctl is-enabled signal-scheduler-backup.timer)/$(systemctl is-active signal-scheduler-backup.timer)"
echo "FIRST_BACKUP=$LATEST"
echo "UPDATE_PACKAGE_URL=https://ms007.me/__updates/v8.1.1.ssu"
echo "UPDATE_PACKAGE_SHA256=$SHA"
 <<<"$SSH_EFFECTIVE" || { echo "SSH hardening verification failed: root key login policy is not correct"; exit 3; }
systemctl reload ssh

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ufw fail2ban >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH key only' >/dev/null
ufw allow 80/tcp comment 'HTTP redirect ACME' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw allow 443/udp comment 'HTTPS HTTP3' >/dev/null
ufw --force enable >/dev/null

cat > /etc/fail2ban/jail.d/signal-scheduler-sshd.local <<'JAIL'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
JAIL
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban

cat > "$BACKUP_WRAPPER" <<'BACKUP'
#!/usr/bin/env bash
set -euo pipefail
PROJECT="/opt/signal-scheduler-web"
exec 9>/run/lock/signal-scheduler-backup.lock
flock -n 9 || exit 0
umask 077
cd "$PROJECT"
bash ./backup.sh
LATEST="$(ls -1dt "$PROJECT"/backups/*/ 2>/dev/null | head -n 1 || true)"
if [ -n "$LATEST" ]; then
  install -m 600 "$PROJECT/updater/update_private.pem" "$LATEST/update_private.pem" 2>/dev/null || true
  printf 'created_at=%s\nserver=%s\n' "$(date -Is)" "$(hostname)" > "$LATEST/BACKUP_INFO.txt"
  chmod -R go-rwx "$LATEST"
fi
find "$PROJECT/backups" -mindepth 1 -maxdepth 1 -type d -mtime +7 -print -exec rm -rf -- {} +
BACKUP
chmod 700 "$BACKUP_WRAPPER"

cat > "$SERVICE" <<'UNIT'
[Unit]
Description=Signal Scheduler daily backup
Requires=docker.service
After=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/signal-scheduler-backup
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
UNIT

cat > "$TIMER" <<'TIMERUNIT'
[Unit]
Description=Run Signal Scheduler backup every day
[Timer]
OnCalendar=*-*-* 04:30:00
Persistent=true
RandomizedDelaySec=15m
Unit=signal-scheduler-backup.service
[Install]
WantedBy=timers.target
TIMERUNIT
systemctl daemon-reload
systemctl enable --now signal-scheduler-backup.timer >/dev/null
systemctl start signal-scheduler-backup.service
RESULT="$(systemctl show -p Result --value signal-scheduler-backup.service)"
[ "$RESULT" = "success" ] || { echo "Initial backup failed: $RESULT"; systemctl status --no-pager signal-scheduler-backup.service || true; exit 4; }
LATEST="$(ls -1dt "$PROJECT"/backups/*/ 2>/dev/null | head -n 1 || true)"
[ -n "$LATEST" ] && [ -s "${LATEST}scheduler_data.tar.gz" ] || { echo "Backup verification failed"; exit 5; }

# Stage a real V8.1.1 encrypted package locally so the web updater can be tested.
STAGING="$PROJECT/.staging_v811"
PKGDIR="$PROJECT/.update_packages"
rm -rf "$STAGING"
mkdir -p "$STAGING/app/static" "$PKGDIR"
cp "$PROJECT/app/main.py" "$STAGING/app/main.py"
cp "$PROJECT/app/static/index.html" "$STAGING/app/static/index.html"
sed -i 's/APP_BUILD = "8.1.0-web-20261007"/APP_BUILD = "8.1.1-web-20261007"/' "$STAGING/app/main.py"
sed -i 's/V8\.0\.1 Web · 云端账号隔离版/V8.1.1 Web · 安全备份收尾版/g' "$STAGING/app/static/index.html"
sed -i "s/8\.1\.0-web-20261007/8.1.1-web-20261007/g" "$STAGING/app/static/index.html"

docker exec signal-scheduler-updater python /project/scripts/build_update_package.py   --public-key /project/updater/update_public.pem   --source-dir /project/.staging_v811   --version 8.1.1   --build 8.1.1-web-20261007   --file app/main.py   --file app/static/index.html   --output /project/.update_packages/v8.1.1.ssu >/tmp/signal_update_build.json

PKG="$PKGDIR/v8.1.1.ssu"
SHA="$(sha256sum "$PKG" | awk '{print $1}')"
docker exec signal-scheduler-caddy sh -c 'mkdir -p /data/updates/__updates'
docker cp "$PKG" signal-scheduler-caddy:/data/updates/__updates/v8.1.1.ssu >/dev/null

SITE="$(awk '/^[[:space:]]*[^#[:space:]][^ ]*[[:space:]]*\\{$/{print $1; exit}' "$PROJECT/Caddyfile.runtime")"
HASH="$(awk '/^[[:space:]]*admin[[:space:]]+/{print $2; exit}' "$PROJECT/Caddyfile.runtime")"
[ -n "$SITE" ] && [ -n "$HASH" ] || { echo "Could not read Caddy site/password hash"; exit 6; }
cat > "$PROJECT/Caddyfile.runtime" <<EOF
$SITE {
    encode zstd gzip
    handle /__updates/* {
        root * /data/updates
        file_server
    }
    handle {
        basic_auth {
            admin $HASH
        }
        reverse_proxy scheduler:8800
    }
}
EOF

docker exec signal-scheduler-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null
docker exec signal-scheduler-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null

echo "DONE"
echo "SSH_PASSWORD_AUTH=$(/usr/sbin/sshd -T | awk '/^passwordauthentication /{print $2;exit}')"
echo "SSH_ROOT_LOGIN=$(/usr/sbin/sshd -T | awk '/^permitrootlogin /{print $2;exit}')"
echo "UFW=$(ufw status | head -n 1)"
echo "FAIL2BAN=$(systemctl is-active fail2ban)"
echo "BACKUP_TIMER=$(systemctl is-enabled signal-scheduler-backup.timer)/$(systemctl is-active signal-scheduler-backup.timer)"
echo "FIRST_BACKUP=$LATEST"
echo "UPDATE_PACKAGE_URL=https://ms007.me/__updates/v8.1.1.ssu"
echo "UPDATE_PACKAGE_SHA256=$SHA"
