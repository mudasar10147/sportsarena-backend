# Database Documentation

Database schema, relationships, and design documentation.

## Files

- **DATABASE_ERD.md** - Entity Relationship Diagram
  - Visual representation of database structure
  - Table relationships
  - Key constraints

- **DATABASE_RELATIONSHIPS.md** - Database relationships documentation
  - Detailed relationship explanations
  - Foreign key constraints
  - Relationship types (one-to-many, many-to-many)

## Related Documentation

- **Architecture/RULE_BASED_SCHEMA_QUICK_REFERENCE.md** - Quick reference for rule-based schema
- **MODELS/** - Individual model documentation

## Database Migrations

Database migrations are located in `src/db/migrations/`:
- See migration files for schema changes
- Migrations are numbered sequentially
- Run migrations using `src/db/runMigrations.js`

