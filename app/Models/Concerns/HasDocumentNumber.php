<?php

namespace App\Models\Concerns;

/**
 * Número de documento legible (ej: V-000123) que se genera solo al crear el registro,
 * a partir del id. El modelo define la constante PREFIX ('V' ventas, 'C' compras, 'T' transferencias).
 */
trait HasDocumentNumber
{
    public static function bootHasDocumentNumber(): void
    {
        static::created(function (self $model) {
            $model->number = static::PREFIX.'-'.str_pad((string) $model->getKey(), 6, '0', STR_PAD_LEFT);
            $model->saveQuietly();
        });
    }
}
