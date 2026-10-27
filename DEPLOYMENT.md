# Deploy to Hostinger VPS

This project runs as a React/Vite frontend and Express API behind Nginx in
Docker Compose. It uses the existing PostgreSQL database configured in
`backend/.env`; it does not create a replacement database.

## Confirm the Hostinger plan

These Docker instructions require a **VPS** with Ubuntu and SSH access. A
shared Web Hosting plan does not provide the Docker/Compose environment used
here. In hPanel, open **VPS** and check that the server shows an IP address and
an Ubuntu operating system. Do not reinstall an existing VPS just to change
the OS without confirming that no data needs preserving.

## Prepare the VPS

In hPanel, check **VPS → Manage** for the public IP and SSH information.
Connect from Windows Terminal:

```powershell
ssh root@YOUR_VPS_IP
```

On the VPS, install Docker Engine and its Compose plugin if they are not
already installed:

```sh
apt update
apt install -y git
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

Allow inbound TCP port 80 in the Hostinger firewall and the VPS firewall.
If another site already uses port 80, keep its existing Nginx service running;
this app binds only to `127.0.0.1:8080` and uses a separate Nginx virtual host.

## Deploy the application

Clone this repository on the VPS:

```sh
git clone https://github.com/Patchalada/spflim.git
cd spflim
```

Create `backend/.env` on the VPS using the existing database configuration and
secrets. Do not commit the file or send it in chat. Required settings:

```dotenv
DB_HOST=...
DB_PORT=5432
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
JWT_SECRET=...
ALLOWED_ORIGINS=http://spflim.nualjan.tech
SLIPOK_MODE=manual
```

Restrict access to the environment file and start the application:

```sh
chmod 600 backend/.env
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 backend
```

The backend runs schema migrations at startup. Back up the existing database
first and confirm the VPS can connect to it. Do not run SQL or copy database
credentials from deployment instructions for another project.

## Route a subdomain through existing Nginx

Create an A record for `spflim.nualjan.tech` pointing to the VPS IPv4 address.
Do not change existing records for the root domain, `www`, or other sites.
Install only this app's additional virtual host:

```sh
cp deploy/nginx/spflim.conf /etc/nginx/conf.d/spflim.conf
nginx -t && systemctl reload nginx
```

Then open `http://spflim.nualjan.tech` to test the app and
`http://spflim.nualjan.tech/api-docs` for the API docs. The frontend proxies
API and Socket.IO through this same origin. Keep the existing Nginx sites
running. Configure HTTPS for the new subdomain before sending identity
documents or other sensitive data.

## Updating

After a change is pushed to `main`:

```sh
git pull
docker compose -f docker-compose.production.yml up -d --build
```
