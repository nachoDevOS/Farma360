# Propuesta: SIVEFARMA multiempresa

> **Estado:** pospuesta. No está implementada ni en curso.
> **Decisión:** 2026-11-06, **nachoDev**. Por ahora, una instalación por farmacia.
> **Medido sobre:** commit `7dd49c7` más los cambios de esa fecha. Repite la sección 5 antes de empezar: el código habrá cambiado.

## 1. Idea

Que el mismo sistema atienda a muchas farmacias, cada una con sus propios datos:

```
Farmacia (empresa)
 ├─ Dueño y usuarios
 ├─ Sucursales
 │   └─ Cajas
 └─ Productos, clientes, proveedores, compras, ventas...
```

- **Quien ya tiene cuenta** entra con su correo y contraseña, y ve solo su farmacia.
- **Una empresa nueva** registra el nombre del negocio y los datos del dueño: nombre, correo y contraseña. Después crea sus sucursales y cajas desde adentro.

## 2. Por qué se pospuso

- Todavía no hay farmacias clientes. Construirlo ahora es apostar semanas de trabajo a una suposición.
- El sistema ya sirve para vender con una instalación por cliente.
- Con una base por farmacia, los datos quedan separados de verdad: un error de programación no puede mostrar las ventas de una farmacia a otra.
- Los primeros clientes dirán qué necesitan de verdad.

## 3. Cuándo retomarla

Cuando se cumpla **al menos una**:

- Hay unas 5 farmacias o más, y actualizar cada instalación quita demasiado tiempo.
- Varias farmacias quieren registrarse solas, sin que nadie instale nada.
- Se decide cobrar un plan mensual a muchas farmacias pequeñas.

Mientras tanto, cada cliente lleva su instalación, su base y `DEMO_MODE=false`, y se publica con `sivefarma-hardening.sh`.

## 4. Comparación

| | Una instalación por farmacia (hoy) | Multiempresa |
|---|---|---|
| Alta de un cliente | La hace el desarrollador | Se registra sola o con aprobación |
| Separación de datos | Total: cada una tiene su base | Por código, en la misma base |
| Actualizar | Cada instalación | Una sola vez |
| Costo de servidor | Crece con cada cliente | Se comparte |
| Si falla un filtro | No expone a nadie | Puede exponer datos entre farmacias |
| Trabajo inicial | Ninguno | Grande |

## 5. Qué hay que cambiar

Hoy el sistema asume una sola farmacia: no existe el concepto de empresa. Son 28 modelos y 35 tablas, incluidas las internas de Laravel. La sucursal se filtra a mano en 18 controladores y servicios, y no hay ningún filtro global.

### Tablas

| Grupo | Tablas | Qué necesitan |
|---|---|---|
| Nueva | `companies` | Nombre, datos del negocio, estado y las columnas de `$table->auditable()` |
| Propias de cada empresa | `users`, `branches`, `categories`, `laboratories`, `indications`, `products`, `suppliers`, `customers`, `denominations`, `expiry_promotion_rules` | `company_id` |
| Operación | `purchases`, `transfers`, `sales`, `cash_registers`, `cash_sessions`, `batches`, `stock_movements`, `batch_promotions`, `cash_movements` | `company_id` directo, aunque ya lleguen por sucursal: el filtro global queda igual en todas |
| Detalle | `sale_items`, `sale_payments`, `purchase_items`, `transfer_items`, `product_presentations`, `product_price_histories`, `cash_session_counts`, `batch_promotion_presentation`, `indication_product` | Heredan de su tabla principal. Revisar una por una |
| Compartidas | `permissions` y tablas internas de Laravel | Sin cambios |
| Roles | `roles` y sus tablas de relación | Ver sección 7 |

### Únicos que hoy son globales

Dos farmacias chocarían con el mismo valor. Deben pasar a ser únicos **por empresa**, con índice `['company_id', 'campo']`:

- `branches.code`
- `categories.name`
- `laboratories.name`
- `indications.name`
- `products.barcode`
- `product_presentations.barcode`
- `denominations.value`
- `expiry_promotion_rules.days_before`
- `purchases.number`
- `transfers.number`
- `sales.number`

La numeración de ventas, compras y transferencias también debe correr por empresa, para que cada farmacia empiece en la suya.

**Reglas del sistema que siguen vigentes:** los registros eliminados conservan sus valores únicos, así que las validaciones deben contar los eliminados y filtrar por empresa. Nada se borra físicamente, y toda tabla nueva lleva `auditable()`.

`users.email` se mantiene único en todo el sistema: el correo identifica a la persona al iniciar sesión, así que un correo pertenece a una sola farmacia.

## 6. Separación de datos

Es el mayor riesgo del proyecto: que una farmacia vea datos de otra.

- **Filtro automático:** un trait `BelongsToCompany` con un global scope en cada modelo de empresa, que además llene `company_id` al crear. No debe depender de acordarse de filtrar en cada pantalla.
- **Empresa activa:** un middleware la toma del usuario autenticado y la fija para toda la petición.
- **Consultas directas:** revisar cada `DB::table`, reporte y consulta cruda, porque un global scope no las cubre.
- **Validaciones:** cada `exists` y `unique` debe filtrar por empresa. Si no, se podría enlazar un registro de otra farmacia enviando su id.
- **Archivos:** las imágenes en S3 van en una carpeta por empresa.
- **Tests:** una prueba por módulo donde la empresa A intenta ver, editar y eliminar datos de la empresa B, y recibe 404. Sin estas pruebas no se publica.

## 7. Usuarios y roles

- La migración de roles de Spatie ya contempla equipos (`team_foreign_key`). Hay que evaluar activarlos, con la empresa como equipo, para que cada farmacia tenga sus roles.
- Hoy `Super Admin` tiene acceso total. Hay que separar dos niveles:
  - **Dueño de la farmacia:** administra todo dentro de su empresa.
  - **Dueño del sistema:** administra empresas, sin entrar a sus datos salvo soporte, y dejando registro.
- Permisos como `sucursales.crear` siguen iguales, pero siempre dentro de la empresa.

## 8. Registro de empresa

1. Formulario nuevo, separado de `/register`: nombre del negocio, datos del dueño, correo y contraseña.
2. Crear en una transacción la empresa, su dueño, sus roles y sus datos iniciales, como los billetes.
3. Verificar el correo.
4. Guiar al dueño para crear su primera sucursal y su primera caja.
5. Protegerlo contra abuso con límite de intentos.

Hoy `/register` está bloqueado en Nginx por `sivefarma-hardening.sh`, y ese bloqueo no debe abrirse para esto. Conviene cerrar además la ruta en Laravel.

## 9. Pasar de instalaciones separadas a una sola

Cuando llegue el momento, ya existirán clientes con su propia base.

1. Crear una empresa por cada instalación.
2. Copiar sus datos asignando `company_id` y traduciendo todos los ids, porque se repetirán entre bases.
3. Conservar archivos, auditoría y registros eliminados.
4. Avisar a cada cliente: si dos usuarios comparten correo, uno deberá cambiarlo.
5. Probar con una copia, comparar totales de ventas y stock, y recién entonces cambiar.

Esto se hace farmacia por farmacia, y se conserva la base original hasta confirmar que todo coincide.

## 10. Etapas sugeridas

| Etapa | Trabajo | Listo cuando |
|---|---|---|
| 1 | Tabla `companies`, `company_id`, una empresa inicial con los datos actuales | El sistema funciona igual que hoy |
| 2 | Filtro automático, empresa activa y pruebas entre empresas | Ninguna prueba cruza datos |
| 3 | Únicos y numeración por empresa | Dos empresas repiten códigos sin error |
| 4 | Roles por empresa y dueño del sistema | Cada farmacia maneja sus roles |
| 5 | Registro de empresa y primeros pasos | Una farmacia nueva vende sin ayuda |
| 6 | Planes y pagos, si se decide cobrar | Falta de pago bloquea sin borrar datos |
| 7 | Migrar instalaciones existentes | Totales coinciden con cada base original |

## 11. Decisiones pendientes

Se deben resolver antes de la etapa 1:

1. **¿Registro libre, o aprobado?** Sugerencia: aprobación al inicio, para evitar cuentas falsas.
2. **¿Habrá plan mensual?** Define bloqueos y límites de sucursales.
3. **¿Catálogo propio por farmacia?** Sugerencia: sí, para no mezclar productos ni precios.
4. **¿Un usuario puede trabajar en dos farmacias?** Sugerencia: no al inicio. Hoy un correo equivale a una farmacia.
5. **¿La demo será una empresa más?** Sugerencia: sí, separada de las reales.
6. **¿Una base compartida o una base por empresa con el mismo sistema?** La segunda separa más, y es más compleja de operar. Evaluarla según cuántas farmacias haya.
