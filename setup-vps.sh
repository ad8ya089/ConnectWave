#!/bin/bash
# setup-vps.sh — run once on fresh Ubuntu 22.04 VPS as root

set -e

echo "=== Installing Docker ==="
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "=== Installing Docker Compose v2 ==="
apt-get install -y docker-compose-plugin
echo 'alias docker-compose="docker compose"' >> /root/.bashrc

echo "=== Creating deploy user ==="
useradd -m -s /bin/bash deploy || true
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
# Add your public key before running:
# echo "ssh-ed25519 AAAA... your-public-key" >> /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true
chown -R deploy:deploy /home/deploy/.ssh

echo "=== Creating app directory ==="
mkdir -p /opt/connectwave
chown deploy:deploy /opt/connectwave

echo "=== Opening firewall ports ==="
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw allow 3478/udp
ufw allow 3478/tcp
ufw allow 5349/tcp
ufw allow 49152:65535/udp
ufw --force enable

echo "=== Installing certbot ==="
apt-get install -y certbot

echo "=== Done! ==="
echo "Next: clone your repo to /opt/connectwave and run docker-compose up"
