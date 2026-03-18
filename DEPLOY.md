# Deploy - Don Papa Match Play

## Serwer

- **IP:** 151.115.61.252
- **User:** root
- **SSH key:** `.ssh/karolinkagolfpark` (ten sam co do GitHub)
- **Aplikacja:** http://151.115.61.252:3000

## Szybki deploy (po zmianach w kodzie)

```bash
# Z lokalnej maszyny:
ssh -i .ssh/karolinkagolfpark root@151.115.61.252 \
  'cd /root/Golf_app && git pull && docker compose up -d --build'
```

Cały proces (pull + build + restart) trwa ~1-2 minuty.

## Pełny deploy od zera

### 1. Wymagania na serwerze

Docker musi być zainstalowany:
```bash
ssh -i .ssh/karolinkagolfpark root@151.115.61.252
curl -fsSL https://get.docker.com | sh
```

### 2. Klucz SSH do GitHub

Skopiuj klucz deploy na serwer:
```bash
scp -i .ssh/karolinkagolfpark .ssh/karolinkagolfpark root@151.115.61.252:/root/.ssh/deploy_key

ssh -i .ssh/karolinkagolfpark root@151.115.61.252 'chmod 600 /root/.ssh/deploy_key && cat > /root/.ssh/config << EOF
Host github.com
  IdentityFile /root/.ssh/deploy_key
  StrictHostKeyChecking no
EOF
chmod 600 /root/.ssh/config'
```

### 3. Klonowanie repo

```bash
ssh -i .ssh/karolinkagolfpark root@151.115.61.252
cd /root
git clone git@github.com:tkalla79/Golf_app.git
```

### 4. Konfiguracja .env

```bash
cd /root/Golf_app
cat > .env << 'EOF'
DATABASE_URL=mysql://donpapa:DpMp2026!SecurePass@db:3306/donpapa
DB_ROOT_PASSWORD=RootPass2026!Secure
DB_PASSWORD=DpMp2026!SecurePass
NEXTAUTH_SECRET=WYGENERUJ_NOWY_SEKRET
NEXTAUTH_URL=http://151.115.61.252:3000
EOF
```

Wygeneruj NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### 5. Uruchomienie

```bash
# Budowanie i start kontenerów (app + MySQL)
docker compose up -d --build

# Poczekaj aż MySQL będzie zdrowy (~15 sek)
docker compose ps

# Migracja bazy + seed danych testowych
docker compose run --rm migrate
```

### 6. Weryfikacja

```bash
curl -s -o /dev/null -w "%{http_code}" http://151.115.61.252:3000/grupy
# Powinno zwrócić: 200
```

## Struktura Docker

| Serwis | Opis |
|--------|------|
| `app` | Next.js (port 3000) |
| `db` | MySQL 8.0 (port 3306, dane w volume `mysql_data`) |
| `migrate` | Jednorazowy kontener do migracji i seedowania (profil `tools`) |

**Volume `mysql_data`** jest persistent - dane przetrwają rebuild i restart kontenerów.

## Operacje na bazie

### Reset bazy i ponowne zaseedowanie
```bash
ssh -i .ssh/karolinkagolfpark root@151.115.61.252
cd /root/Golf_app
docker compose run --rm migrate sh -c "npx prisma db push --force-reset && npx tsx prisma/seed.ts"
```

### Tylko migracja (bez resetu danych)
```bash
docker compose run --rm migrate sh -c "npx prisma db push"
```

## Logi

```bash
# Logi aplikacji
docker compose logs app -f

# Logi MySQL
docker compose logs db -f

# Wszystko
docker compose logs -f
```

## Restart

```bash
# Restart aplikacji (bez rebuildu)
docker compose restart app

# Pełny restart
docker compose down && docker compose up -d
```

## Login admina

- **Email:** admin1@karolinkagolfpark.pl
- **Hasło:** admin123

(zmień hasło na produkcji przez panel admina!)
