# 💾 Step 3: Database & Data Transfer Guide

This guide ensures that all your existing database records (users, drivers, deliveries, tracking data, payments) are safely dumped from your old database (Neon / Render Postgres) and restored into the new PostgreSQL database on DigitalOcean without data loss.

---

## 🛠️ Step 1: Export Database Dump from Old Host (Neon / Render)

You can run `pg_dump` from your local terminal or Git Bash.

### Command to Dump Data:
```bash
# Set your OLD database connection string from Render/Neon
export OLD_DATABASE_URL="postgresql://user:password@ep-sample-12345.eu-central-1.aws.neon.tech/logistics_db?sslmode=require"

# Execute pg_dump
pg_dump --clean --if-exists --no-owner --no-privileges -d "$OLD_DATABASE_URL" -f logistel_backup.sql
```

> [!TIP]
> If you don't have `pg_dump` installed locally on Windows, you can also execute this command inside the DigitalOcean Droplet directly!

---

## 📤 Step 2: Upload Dump to DigitalOcean Server

If you dumped the database on your local computer, transfer `logistel_backup.sql` to your Droplet via `scp`:

```bash
scp logistel_backup.sql root@YOUR_DROPLET_IP:/var/www/logistel/
```

---

## 📥 Step 3: Restore Dump into New DigitalOcean PostgreSQL Container

SSH into your DigitalOcean Droplet:
```bash
ssh root@YOUR_DROPLET_IP
cd /var/www/logistel
```

Import the SQL file into the `logistel_db` container:
```bash
# Copy backup file into postgres container
docker cp logistel_backup.sql logistel_db:/logistel_backup.sql

# Execute SQL restore inside postgres container
docker compose exec -T postgres psql -U logistel_user -d logistel_prod -f /logistel_backup.sql
```

---

## 🔍 Step 4: Verify Data Integrity

Check that all tables and records exist inside the new database:

```bash
docker compose exec postgres psql -U logistel_user -d logistel_prod -c "\dt"
```

Verify count of users, drivers, and orders:
```bash
docker compose exec postgres psql -U logistel_user -d logistel_prod -c "SELECT count(*) FROM \"User\";"
docker compose exec postgres psql -U logistel_user -d logistel_prod -c "SELECT count(*) FROM \"Delivery\";"
```

If row counts match your old platform, data migration is 100% successful!

---

## 🔄 Step 5: Automated Daily Backups Setup (Cron Job)

To prevent data loss in the future, set up a daily automated backup script on your DigitalOcean droplet.

1. Create backup script at `/var/www/logistel/backup.sh`:
```bash
chmod +x migration/scripts/backup.sh
```

2. Add a daily Cron Job (runs every midnight at 00:00):
```bash
crontab -e
```
Add the following line:
```text
0 0 * * * /var/www/logistel/migration/scripts/backup.sh >> /var/log/logistel_backup.log 2>&1
```
