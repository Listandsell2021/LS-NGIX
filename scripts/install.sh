#!/bin/bash
set -euo pipefail

echo "========================================="
echo "  LS-NGIX Panel Installer (Hardened)"
echo "========================================="
echo ""

# ─── CHECKS ────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (sudo)"
  exit 1
fi

if ! grep -q "Ubuntu" /etc/os-release 2>/dev/null; then
  echo "Warning: Tested on Ubuntu 22.04/24.04 only. Continue? (y/n)"
  read -r confirm
  [ "$confirm" != "y" ] && exit 1
fi

# ─── 1. SYSTEM UPDATES ─────────────────────────────
echo "[1/9] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ─── 2. CREATE NON-ROOT USER ───────────────────────
echo "[2/9] Creating ls-ngix system user..."
if ! id "ls-ngix" &>/dev/null; then
  useradd --system --create-home --shell /bin/bash ls-ngix
fi

# ─── 3. INSTALL NODE.JS ────────────────────────────
echo "[3/9] Installing Node.js 20 LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  Node.js $(node --version)"

# Install build tools (needed for bcrypt, better-sqlite3 native modules)
apt-get install -y build-essential python3

# ─── 4. INSTALL PM2 ────────────────────────────────
echo "[4/9] Installing PM2..."
npm install -g pm2
env PATH=$PATH:/usr/bin pm2 startup systemd -u ls-ngix --hp /home/ls-ngix
su - ls-ngix -c "pm2 save" 2>/dev/null || true

# ─── 5. INSTALL NGINX + CERTBOT ────────────────────
echo "[5/9] Installing Nginx and Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable nginx
systemctl start nginx

# ─── 6. FIREWALL (UFW) ─────────────────────────────
echo "[6/9] Configuring firewall (UFW)..."
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "  Firewall: only ports 22, 80, 443 open"

# ─── 7. FAIL2BAN ───────────────────────────────────
echo "[7/9] Installing Fail2ban..."
apt-get install -y fail2ban

cat > /etc/fail2ban/jail.local <<'F2B'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
F2B

systemctl enable fail2ban
systemctl restart fail2ban
echo "  Fail2ban: blocks IP after 3 failed SSH / 5 failed login attempts"

# ─── 8. INSTALL LS-NGIX PANEL ──────────────────────
echo "[8/9] Installing LS-NGIX Panel..."
INSTALL_DIR="/opt/ls-ngix"
mkdir -p "$INSTALL_DIR/apps"

if [ -d "$INSTALL_DIR/panel/.git" ]; then
  echo "  Updating existing installation..."
  git config --global --add safe.directory "$INSTALL_DIR/panel"
  cd "$INSTALL_DIR/panel" && git pull
else
  rm -rf "$INSTALL_DIR/panel"
  git clone https://github.com/Listandsell2021/LS-NGIX.git "$INSTALL_DIR/panel"
fi

chown -R ls-ngix:ls-ngix "$INSTALL_DIR"

cd "$INSTALL_DIR/panel"
su - ls-ngix -c "cd $INSTALL_DIR/panel/client && npm install && npm run build"
su - ls-ngix -c "cd $INSTALL_DIR/panel/server && npm install && npx nest build"

mkdir -p "$INSTALL_DIR/panel/server/data"
chown ls-ngix:ls-ngix "$INSTALL_DIR/panel/server/data"
chmod 700 "$INSTALL_DIR/panel/server/data"

# ─── SUDOERS: Limited privileges for ls-ngix ────────
cat > /etc/sudoers.d/ls-ngix <<'SUDOERS'
# LS-NGIX panel: limited sudo for nginx and certbot only
ls-ngix ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
ls-ngix ALL=(ALL) NOPASSWD: /usr/sbin/nginx -s reload
ls-ngix ALL=(ALL) NOPASSWD: /usr/bin/certbot *
ls-ngix ALL=(ALL) NOPASSWD: /bin/ln -sf /etc/nginx/sites-available/ls-ngix-* /etc/nginx/sites-enabled/*
ls-ngix ALL=(ALL) NOPASSWD: /bin/rm /etc/nginx/sites-enabled/ls-ngix-*
SUDOERS
chmod 440 /etc/sudoers.d/ls-ngix

# ─── 9. START PANEL ────────────────────────────────
echo "[9/9] Starting LS-NGIX Panel..."
su - ls-ngix -c "cd $INSTALL_DIR/panel && NODE_ENV=production pm2 delete ls-ngix-panel 2>/dev/null || true"
su - ls-ngix -c "cd $INSTALL_DIR/panel && NODE_ENV=production pm2 start server/dist/main.js --name ls-ngix-panel"
su - ls-ngix -c "pm2 save"

cat > /etc/nginx/sites-available/ls-ngix-panel <<'NGINX'
server {
    listen 80 default_server;
    server_name _;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:3500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/ls-ngix-panel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && nginx -s reload

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "========================================="
echo "  LS-NGIX Panel Installed!"
echo "========================================="
echo ""
echo "  Panel:   http://$SERVER_IP"
echo "  Create your admin account on first visit."
echo ""
echo "  Security:"
echo "    - Firewall (UFW): ports 22, 80, 443 only"
echo "    - Fail2ban: active on SSH"
echo "    - Panel runs as 'ls-ngix' user (non-root)"
echo "    - Data encrypted at rest"
echo ""
echo "  IMPORTANT: Set up SSL immediately!"
echo "    sudo certbot --nginx -d panel.yourdomain.com"
echo ""
echo "  Commands:"
echo "    pm2 status                 # Check panel status"
echo "    pm2 logs ls-ngix-panel     # View panel logs"
echo "    sudo ufw status            # Firewall status"
echo "    sudo fail2ban-client status # Fail2ban status"
echo "========================================="
