# Rollback Plan

For MVP, rollback is a Git redeploy plus `data/db.json` backup restore. For production, snapshot the database before migrations and use forward fixes for data-shape changes that cannot be safely reversed.
