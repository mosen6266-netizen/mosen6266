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
/usr/sbin/sshd -T | grep -q '^passwordauthentication no$' || { echo "SSH hardening verification failed"; exit 3; }
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

echo "DONE"
echo "SSH_PASSWORD_AUTH=$(/usr/sbin/sshd -T | awk '/^passwordauthentication /{print $2;exit}')"
echo "SSH_ROOT_LOGIN=$(/usr/sbin/sshd -T | awk '/^permitrootlogin /{print $2;exit}')"
echo "UFW=$(ufw status | head -n 1)"
echo "FAIL2BAN=$(systemctl is-active fail2ban)"
echo "BACKUP_TIMER=$(systemctl is-enabled signal-scheduler-backup.timer)/$(systemctl is-active signal-scheduler-backup.timer)"
echo "FIRST_BACKUP=$LATEST"
