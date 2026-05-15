# Backup and Restore Notes

## Local Backup

```bash
docker compose exec postgres pg_dump -U neara -d neara -Fc -f /tmp/neara.dump
docker compose cp postgres:/tmp/neara.dump ./neara.dump
```

## Local Restore

```bash
docker compose cp ./neara.dump postgres:/tmp/neara.dump
docker compose exec postgres pg_restore -U neara -d neara --clean --if-exists /tmp/neara.dump
```

## Production Expectations

- Use managed PostgreSQL automated daily backups.
- Enable point-in-time recovery where supported.
- Test restore before production launch and periodically afterward.
- Keep application secrets outside backups unless using the managed provider's encrypted secret store.
