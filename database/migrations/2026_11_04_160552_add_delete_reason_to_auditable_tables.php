<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Motivo de eliminación en todas las tablas de negocio.
 * Las tablas nuevas ya lo traen por $table->auditable(); por eso solo se agrega donde falta.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach ($this->auditableTables() as $name) {
            if (! Schema::hasColumn($name, 'deleteReason')) {
                Schema::table($name, function (Blueprint $table) {
                    $table->string('deleteReason')->nullable()->after('deleteRole');
                });
            }
        }
    }

    public function down(): void
    {
        foreach ($this->auditableTables() as $name) {
            if (Schema::hasColumn($name, 'deleteReason')) {
                Schema::table($name, function (Blueprint $table) {
                    $table->dropColumn('deleteReason');
                });
            }
        }
    }

    /**
     * @return list<string>
     */
    private function auditableTables(): array
    {
        return collect(Schema::getTableListing(schema: Schema::getCurrentSchemaName(), schemaQualified: false))
            ->filter(fn (string $name) => Schema::hasColumn($name, 'deleteRole'))
            ->values()
            ->all();
    }
};
