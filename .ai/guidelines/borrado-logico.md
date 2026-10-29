# Farma360 — Regla del sistema: eliminación lógica y auditoría de registro

Nothing is ever physically deleted from the Farma360 database. Every delete is a soft delete (`deleted_at`).

## Required on every table
- Every new business table MUST call `$table->auditable();` in its `Schema::create` migration. The macro (defined in `App\Providers\AppServiceProvider::registerAuditableColumns`) adds:
  - `registerUser_id` — id of the user who created the record (nullable FK to `users`)
  - `registerRole` — role name of that user at creation time
  - `deleteUser_id` — id of the user who deleted the record (nullable FK to `users`)
  - `deleteRole` — role name of that user at deletion time
  - `deleted_at` — soft delete timestamp
- Keep these exact column names (camelCase with `_id`); do not rename them to snake_case.
- In a `down()` that removes them from an existing table, use `$table->dropAuditable();`.
- Only Laravel internal tables (cache, jobs, sessions, password_reset_tokens, migrations…) and pivot tables are exempt.

## Required on every model
- Every Eloquent model in `app/Models` MUST `use App\Models\Concerns\Auditable;` (it includes `SoftDeletes`). It fills `registerUser_id`/`registerRole` on create, `deleteUser_id`/`deleteRole` on delete, and clears them on restore.
- `php artisan make:model` and `make:migration --create` already include both via `stubs/`.
- Roles and permissions use `App\Models\Role` / `App\Models\Permission` (Spatie models extended with `Auditable`). Never import `Spatie\Permission\Models\*` directly.

## Forbidden
- `forceDelete()` (the trait throws `LogicException`), `DB::table(...)->delete()`, `truncate()`, raw SQL `DELETE`, or `cascadeOnDelete()` foreign keys that would remove business data.
- Mass deletes (`Model::where(...)->delete()`) skip the "who deleted" columns: delete record by record with `$model->delete()`.

## Keep in mind
- Soft-deleted rows still occupy `unique` values (e.g. `users.email`): keep `unique` validation rules counting trashed rows so the user gets a validation error instead of a DB error.
- Relations that must show history (e.g. who registered a record) should use `->withTrashed()`.
- `tests/Feature/SoftDeleteRuleTest.php` fails if a table lacks the columns or a model lacks the trait. Use `assertSoftDeleted()` in tests, never `assertModelMissing()` / `assertDatabaseMissing()` for deletes.
