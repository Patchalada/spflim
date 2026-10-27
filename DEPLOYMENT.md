# Deploy to a VPS

The production setup builds the React app into Nginx and proxies `/api`,
`/api-docs`, and `/socket.io` to Express. It uses the existing PostgreSQL
database configured in `backend/.env`; it does not create or migrate data to a
new database.

## Before starting

- Have the VPS public IP and SSH access.
- Install Docker Engine and the Docker Compose plugin on the VPS.
- Confirm the VPS can connect to the existing database host.
- Back up the existing database before the first start. The backend applies
  schema migrations when it starts.
- Keep `backend/.env` private. It is ignored by Git and excluded from the
  backend image.

## Deploy

From the VPS, clone the repository and enter its root directory. Create
`backend/.env` using the existing database settings and secrets; do not commit
or paste the file into chat. Ensure it contains:

```dotenv
DB_HOST=...
DB_PORT=5432
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
JWT_SECRET=...
SLIPOK_MODE=manual
ALLOWED_ORIGINS=http://YOUR_VPS_IP
```

Set `ALLOWED_ORIGINS` to the exact public origin, without a trailing slash.
Keep optional SlipOK and LINE credentials in this file if those integrations
are needed. Restrict its permissions:

```sh
chmod 600 backend/.env
```

Then start the stack:

```sh
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 backend
```

Open TCP port 80 in the VPS firewall and visit `http://YOUR_VPS_IP`. The API
documentation is at `http://YOUR_VPS_IP/api-docs`. Socket.IO is proxied through
the same origin, so the browser does not need a separate backend URL.

## HTTPS and updates

An IP-only deployment uses HTTP. Do not use it to transmit real identity
documents or other sensitive data. Point a domain to the VPS and configure
HTTPS before using real tenant data.

For an update, pull the intended commit and rebuild:

```sh
git pull
docker compose -f docker-compose.production.yml up -d --build
```
