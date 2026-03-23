# Deploy - Don Papa Match Play

## Serwer produkcyjny

- **Domena:** https://donpapagolf.pl
- **IP:** 209.38.211.80
- **User:** root
- **SSH key:** `.ssh/karolinkagolfpark` (w katalogu projektu, ten sam co do GitHub)
- **Repo:** git@github.com:tkalla79/Golf_app.git

## Szybki deploy (po zmianach w kodzie)

**UWAGA: Serwer ma za mało RAM na budowanie obrazów. Budujemy lokalnie i wrzucamy gotowe.**

```bash
# 1. Commit i push
git add -A && git commit -m "opis zmian" && git push

# 2. Build lokalnie (linux/amd64 bo serwer to x86)
docker build --platform linux/amd64 -t donpapa-app:latest .
docker save donpapa-app:latest | gzip > /tmp/donpapa-app.tar.gz

# 3. Upload na serwer
scp -i .ssh/karolinkagolfpark /tmp/donpapa-app.tar.gz root@209.38.211.80:/tmp/

# 4. Na serwerze: załaduj obraz i zrestartuj
ssh -i .ssh/karolinkagolfpark root@209.38.211.80 \
  'gunzip -c /tmp/donpapa-app.tar.gz | docker load && rm /tmp/donpapa-app.tar.gz && \
   cd /root/Golf_app && git pull && \
   docker compose -f /root/Golf_app/docker-compose.yml --env-file /root/Golf_app/.env up -d'
```

Jeśli zmieniłeś schemat bazy (prisma/schema.prisma), po restarcie uruchom migrację:
```bash
# Rebuild migrate image też
docker build --platform linux/amd64 --target builder -t donpapa-migrate:latest .
docker save donpapa-migrate:latest | gzip > /tmp/donpapa-migrate.tar.gz
scp -i .ssh/karolinkagolfpark /tmp/donpapa-migrate.tar.gz root@209.38.211.80:/tmp/

ssh -i .ssh/karolinkagolfpark root@209.38.211.80 \
  'gunzip -c /tmp/donpapa-migrate.tar.gz | docker load && rm /tmp/donpapa-migrate.tar.gz && \
   docker compose -f /root/Golf_app/docker-compose.yml --env-file /root/Golf_app/.env run --rm migrate'
```

## Struktura Docker na serwerze

| Serwis | Image | Opis |
|--------|-------|------|
| `caddy` | caddy:2-alpine | Reverse proxy + auto SSL (Let's Encrypt) |
| `app` | donpapa-app:latest | Next.js (port 3000, wewnętrzny) |
| `db` | mysql:8.0 | Baza danych (volume `mysql_data`) |
| `migrate` | donpapa-migrate:latest | Migracja schematu (profil `tools`) |
| `seed` | donpapa-migrate:latest | Reset bazy + seed (profil `tools`) |

**WAŻNE:** Na serwerze `docker-compose.yml` jest zmodyfikowany - używa `image:` zamiast `build:` bo budujemy lokalnie. Nie edytuj go na serwerze - tylko pull z repo + nadpisz image.

## .env na serwerze (/root/Golf_app/.env)

```
DATABASE_URL=mysql://donpapa:<HASLO_DB>@db:3306/donpapa
DB_ROOT_PASSWORD=<HASLO_ROOT>
DB_PASSWORD=<HASLO_DB>
NEXTAUTH_SECRET=<wygenerowany: openssl rand -base64 32>
NEXTAUTH_URL=https://donpapagolf.pl
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<login Brevo>
SMTP_PASS=<klucz SMTP Brevo>
SMTP_FROM=Don Papa Match Play <noreply@donpapagolf.pl>
```
Prawdziwe wartości na serwerze w `/root/Golf_app/.env` - nie wrzucaj do repo!

## Operacje na bazie

### Migracja schematu (bezpieczne - NIE kasuje danych)
```bash
ssh -i .ssh/karolinkagolfpark root@209.38.211.80 \
  'docker compose -f /root/Golf_app/docker-compose.yml --env-file /root/Golf_app/.env run --rm migrate'
```

### UWAGA: Reset bazy + seed (KASUJE WSZYSTKIE DANE!)
```bash
ssh -i .ssh/karolinkagolfpark root@209.38.211.80 \
  'docker compose -f /root/Golf_app/docker-compose.yml --env-file /root/Golf_app/.env run --rm seed'
```
**Nigdy nie uruchamiaj `seed` na produkcji jeśli użytkownicy już wprowadzili dane!**

## Logi

```bash
SSH="ssh -i .ssh/karolinkagolfpark root@209.38.211.80"

# Logi aplikacji
$SSH 'docker compose -f /root/Golf_app/docker-compose.yml logs app -f'

# Logi Caddy (SSL, requesty)
$SSH 'docker compose -f /root/Golf_app/docker-compose.yml logs caddy -f'

# Wszystko
$SSH 'docker compose -f /root/Golf_app/docker-compose.yml logs -f'
```

## Login admina

| Email | Imię |
|-------|------|
| slawomir.olszynski@codelabs.pl | Sławomir Olszyński |
| m.kucia@hardbeans.com | Marcin Kucia |
| t.kalla@k2biznes.pl | Tomasz Kalla |

Hasła przekazane osobno (nie w repo).

## Lokalne dev

```bash
# Wymagania: Docker (dla MySQL), Node.js
git clone git@github.com:tkalla79/Golf_app.git
cd Golf_app
npm install

# Uruchom MySQL
docker compose up db -d

# Skopiuj .env.example do .env i uzupełnij
cp .env.example .env

# Push schematu i seed
npx prisma db push
npx tsx prisma/seed.ts

# Dev server
npm run dev
# -> http://localhost:3000
```

## Znane ograniczenia

- Avatary graczy: upload zapisuje do `/app/public/avatars/` w kontenerze, serwowane przez API route `/api/avatars/[filename]`. Przy recreate kontenera avatary się kasują - TODO: Docker volume dla avatarów.
- Email override na localhost: `SMTP_DEV_OVERRIDE=twoj@email.pl` w `.env` - wszystkie maile logowania idą na ten adres (tylko gdy `NODE_ENV !== 'production'`).
