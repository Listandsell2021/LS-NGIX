# LS-NGIX

Self-hosted, security-hardened VPS management panel for deploying and managing Node.js applications.

## Quick Install (Ubuntu 22.04/24.04)

```bash
curl -fsSL https://raw.githubusercontent.com/Listandsell2021/LS-NGIX/main/scripts/install.sh | sudo bash
```

## Development

```bash
cd server && npm install
cd ../client && npm install

npm run dev:server   # Backend on :3500
npm run dev:client   # Frontend on :5173
```

## Security

- HTTPS mandatory (Let's Encrypt)
- Non-root execution with limited sudo
- UFW firewall + Fail2ban
- Rate limiting on auth endpoints
- AES-256-GCM encryption for secrets
- Audit logging for all actions
- httpOnly cookies for JWT (no XSS token theft)
- Command injection prevention via execFile
