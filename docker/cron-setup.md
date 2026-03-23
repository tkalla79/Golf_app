# Automatyczne przypomnienia email

## Opcja 1: Crontab na serwerze
```bash
# Edytuj crontab roota:
crontab -e

# Dodaj (codziennie o 8:00):
0 8 * * * curl -s -H "Authorization: Bearer TWOJ_CRON_SECRET" https://donpapagolf.pl/api/cron/reminders >> /var/log/dpmp-reminders.log 2>&1
```

## Opcja 2: Zewnętrzny cron (cron-job.org, EasyCron)
- URL: `https://donpapagolf.pl/api/cron/reminders`
- Metoda: GET
- Header: `Authorization: Bearer TWOJ_CRON_SECRET`
- Częstotliwość: Codziennie o 8:00 CET

## Opcja 3: Docker cron container
Dodaj do docker-compose.yml:
```yaml
cron:
  image: alpine:3
  command: sh -c "echo '0 8 * * * wget -qO- --header=\"Authorization: Bearer $$CRON_SECRET\" http://app:3000/api/cron/reminders' | crontab - && crond -f"
  environment:
    CRON_SECRET: ${CRON_SECRET}
  depends_on:
    - app
  restart: unless-stopped
```
