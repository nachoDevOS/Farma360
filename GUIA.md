# Guía del proyecto (para empezar desde cero)

Esta guía explica **cómo está armado el panel**, **dónde está cada cosa** y **cómo agregar una pantalla nueva**.
Léela en orden la primera vez.

---

## 1. Las 4 piezas del proyecto

| Pieza | Qué hace | Dónde vive |
|---|---|---|
| **Laravel** (PHP) | El "cerebro": rutas, base de datos, login, permisos, validaciones. | `app/`, `routes/`, `database/` |
| **React** (TypeScript) | La "cara": lo que el usuario ve y toca en el navegador. | `resources/js/` |
| **Inertia** | El "puente": Laravel le pasa datos a React **sin que tengas que crear una API**. | (está en ambos lados) |
| **Tailwind CSS** | Los estilos. En vez de escribir CSS, pones clases como `p-4`, `rounded-xl`, `text-cyan-500`. | `resources/css/app.css` + `className="..."` |

> **TypeScript** = JavaScript con "tipos". Los archivos `.tsx` son componentes React escritos en TypeScript.
> Los tipos te avisan errores antes de abrir el navegador (ej: escribir `user.nmae` en vez de `user.name`).

---

## 2. Cómo viaja una página (lo más importante)

Cuando entras a `http://127.0.0.1:8000/dashboard` pasa esto:

```
 Navegador                 Laravel (PHP)                                  React (TSX)
 ─────────                 ─────────────                                  ───────────
 /dashboard  ──►  1. routes/admin.php
                     Route::get('dashboard', DashboardController::class)
                                │
                                ▼
                  2. app/Http/Controllers/Admin/DashboardController.php
                     consulta la base de datos y hace:
                     Inertia::render('admin/dashboard', [ 'stats' => ..., ... ])
                                │   "admin/dashboard" = ruta del archivo de la página
                                ▼
                                                              3. resources/js/pages/admin/dashboard.tsx
                                                                 recibe esos datos como "props":
                                                                 function Dashboard({ stats, ... })
                                                                 y dibuja la pantalla.
```

**Regla de oro:** `Inertia::render('admin/users/index', ...)` abre el archivo `resources/js/pages/admin/users/index.tsx`.

---

## 3. Mapa de carpetas

El proyecto está separado en **dos mundos**, en el backend y en el frontend:

- **admin** → el panel interno (con login): dashboard, usuarios, roles, ajustes.
- **public** → el sitio público (sin login). **Todavía no existe**: sus carpetas están listas para cuando se implemente.
- Lo que usan los dos (login, logo, avisos, botones…) va en carpetas **compartidas**, así nada se repite.

### Backend (Laravel)

```
app/
├── Http/
│   ├── Controllers/
│   │   ├── Admin/                           → 🔒 PANEL
│   │   │   ├── DashboardController.php      → datos del dashboard
│   │   │   ├── UserController.php           → listar / crear / editar / eliminar usuarios
│   │   │   ├── RoleController.php           → roles y permisos (crear, editar permisos, eliminar)
│   │   │   └── Settings/                    → perfil y contraseña del usuario logueado
│   │   ├── Auth/                            → login, registro, recuperar contraseña (compartido)
│   │   └── Public/                          → 🌐 SITIO PÚBLICO (crear cuando se implemente)
│   ├── Requests/                            → VALIDACIÓN de formularios (Form Requests)
│   │   ├── Admin/StoreUserRequest.php       → reglas de "Nuevo usuario"
│   │   ├── Admin/UpdateUserRequest.php      → reglas de "Editar usuario" (+ no quitarte tu rol)
│   │   ├── Admin/RoleRequest.php            → reglas del formulario de rol (solo permisos del catálogo)
│   │   ├── Admin/Settings/ProfileUpdateRequest.php → reglas de "Mi perfil"
│   │   └── Auth/LoginRequest.php            → login (bloquea inactivos y guarda el último acceso)
│   └── Middleware/HandleInertiaRequests.php → datos que reciben TODAS las páginas (usuario, permisos, avisos)
├── Policies/UserPolicy.php             → reglas sobre usuarios: permiso del rol + "no te elimines a ti mismo",
│                                         "solo un Super Admin toca a otro Super Admin"
├── Support/PermissionCatalog.php       → lee el catálogo de permisos de config/roles.php
├── Console/Commands/SyncPermissions.php → php artisan permissions:sync (catálogo → base de datos)
├── Models/
│   ├── Concerns/Auditable.php          → ⭐ REGLA: eliminación lógica + quién registró / quién eliminó
│   ├── User.php                        → usuario (rol con Spatie: $user->role, $user->can('usuarios.ver'))
│   └── Role.php / Permission.php       → roles y permisos de Spatie con la regla de eliminación lógica
└── Providers/AppServiceProvider.php    → Super Admin con acceso total (Gate::before) + $table->auditable()

bootstrap/app.php  → páginas de error con diseño (403, 404, 500) y sesión expirada (419)
config/inertia.php → dónde buscar las páginas de React (resources/js/pages)
config/roles.php   → ⭐ CATÁLOGO DE PERMISOS: módulos, acciones y roles iniciales (ver sección 8)
config/permission.php → configuración del paquete spatie/laravel-permission (casi nunca se toca)
lang/es/           → traducciones al español de Laravel (validación, login, contraseñas, paginación)

routes/
├── web.php        → 🌐 rutas del SITIO PÚBLICO (por ahora solo "/" → manda al panel) + carga las otras dos
├── admin.php      → 🔒 rutas del PANEL (dashboard, ajustes, /admin/users, /admin/roles)
│                     cada ruta pide su permiso: ->middleware('can:usuarios.ver')
└── auth.php       → rutas de login / registro / recuperar contraseña

database/
├── migrations/    → estructura de las tablas: una migración create_* por tabla, con todas sus columnas
└── seeders/DatabaseSeeder.php → admin@admin.com / password + 48 usuarios de ejemplo

tests/Feature/
├── Admin/         → pruebas del panel (usuarios, roles y permisos, ajustes)
└── Auth/          → pruebas de login / registro
```

### Frontend (React) — `resources/js/`

```
resources/js/
├── app.tsx                  → punto de entrada: arranca React. Casi nunca se toca.
│
├── pages/                   → 📄 PANTALLAS. Una por cada Inertia::render(...)
│   ├── admin/               → 🔒 PANEL
│   │   ├── dashboard.tsx
│   │   ├── users/index.tsx
│   │   ├── roles/           (index = lista de roles · form = crear / editar con la tabla de permisos)
│   │   └── settings/        (profile, password, appearance)
│   ├── auth/                → login, register, forgot-password… (compartido)
│   ├── public/              → 🌐 SITIO PÚBLICO (vacío, listo para cuando se implemente)
│   └── error.tsx            → página de error 403 / 404 / 500 (compartida)
│
├── components/              → 🧩 PIEZAS que se usan para armar las pantallas
│   ├── ui/                  → piezas básicas: Button, Input, Dialog, Select... (shadcn/ui, no se modifican)
│   ├── shared/              → piezas propias que usan admin Y público: logo, avisos, paginación,
│   │                          campo de contraseña, mensaje de error de un campo, enlace
│   ├── admin/               → 🔒 piezas SOLO del panel
│   │   ├── layout/          → menú lateral, barra superior, buscador Ctrl+K, menú del usuario
│   │   ├── common/          → título de página, barra de tablas (Mostrar N + buscador), insignias, avatar,
│   │   │                      botones de acción de tablas,
│   │   │                      color de cada rol en gráficos (role-colors.ts)
│   │   ├── dashboard/       → indicadores, gráficos, últimos usuarios
│   │   ├── users/           → tabla, buscador, modales de crear / editar / eliminar
│   │   ├── roles/           → tabla de casillas de permisos, modal de eliminar rol
│   │   └── settings/        → selector de tema
│   └── public/              → 🌐 piezas SOLO del sitio público (vacío por ahora)
│
├── layouts/                 → 🖼️ MARCOS que envuelven las páginas
│   ├── admin/admin-layout.tsx    → menú lateral + barra superior (todas las páginas del panel)
│   ├── admin/settings-layout.tsx → menú de "Ajustes" (Perfil, Contraseña, Apariencia)
│   └── auth/auth-layout.tsx      → login / registro (pantalla dividida)
│
├── hooks/                   → 🪝 funciones reutilizables con lógica (modo oscuro, detectar móvil, iniciales)
│   └── use-can.ts           → const can = useCan();  can('usuarios.crear') → true / false
├── lib/                     → 🔧 utilidades sin diseño (compartidas)
│   ├── utils.ts             → cn(): combina clases de Tailwind
│   └── format.ts            → formatDate(), relativeTime(), greeting()
└── types/                   → 🏷️ "formas" de los datos (qué campos tiene un User, etc.)
    ├── index.ts             → tipos generales (User, Paginated, SharedData...)
    └── admin/               → tipos del panel (dashboard, users, roles)
```

**¿Dónde pongo un archivo nuevo?** Pregúntate:

1. ¿Es del panel o del sitio público? → carpeta `admin/` o `public/`.
2. ¿Es una pantalla completa con URL propia? → `pages/admin/…` o `pages/public/…`
3. ¿Es una pieza que solo usa una sección? → `components/admin/<seccion>/`
4. ¿La usan el panel **y** el sitio público? → `components/shared/`
5. ¿Es una función sin diseño (cálculos, formatos)? → `lib/`

**Regla para no repetir código:** antes de crear una pieza, busca si ya existe en `components/shared/`
o `components/admin/common/`. Si vas a copiar y pegar algo, muévelo a una de esas carpetas y úsalo desde ahí.

---

## 4. Conceptos de React que vas a ver en el código

### Componente
Una función que devuelve "HTML" (se llama **JSX**). Su nombre empieza con mayúscula.

```tsx
export function Saludo() {
    return <h1 className="text-2xl font-bold">Hola</h1>;
}
```

Se usa como si fuera una etiqueta: `<Saludo />`.

### Props (datos que recibe un componente)
Como los parámetros de una función.

```tsx
export function Saludo({ nombre }: { nombre: string }) {
    return <h1>Hola, {nombre}</h1>;   // las llaves { } meten JavaScript dentro del JSX
}

<Saludo nombre="Ana" />   // → Hola, Ana
```

Ejemplo real: [`components/admin/dashboard/stat-card.tsx`](resources/js/components/admin/dashboard/stat-card.tsx) recibe una lista de indicadores (`label`, `value`, `hint`...)
y en [`pages/admin/dashboard.tsx`](resources/js/pages/admin/dashboard.tsx) se usa con 4 indicadores distintos.

### Estado (`useState`)
Datos que **cambian mientras usas la pantalla**. Cuando cambian, React vuelve a dibujar.

```tsx
const [abierto, setAbierto] = useState(false);   // valor inicial: false

<button onClick={() => setAbierto(true)}>Abrir</button>
{abierto && <p>¡Estoy abierto!</p>}             // solo se muestra si abierto es true
```

Ejemplo real: en [`pages/admin/users/index.tsx`](resources/js/pages/admin/users/index.tsx), `formOpen` controla si el modal "Nuevo usuario" está visible.

### `useEffect`
Código que se ejecuta **cuando algo cambia**. Ej: buscar 350 ms después de que dejas de escribir (está en la página de usuarios).

### Listas con `.map()`
Para repetir un elemento por cada dato:

```tsx
{users.map((user) => (
    <li key={user.id}>{user.name}</li>   // "key" es obligatorio y debe ser único
))}
```

### Hablar con Laravel desde React (Inertia)

| Quiero... | Uso |
|---|---|
| Ir a otra página | `<Link href={route('dashboard')}>Ir</Link>` |
| Enviar un formulario | `const { data, setData, post } = useForm({...}); post(route('admin.users.store'))` |
| Recargar con filtros | `router.get(route('admin.users.index'), { search: 'ana' })` |
| Leer el usuario logueado | `const { auth } = usePage<SharedData>().props;` |

`route('nombre')` usa los **nombres** de `routes/web.php` (`->name('dashboard')`), igual que en Laravel.

---

## 5. Receta: agregar una pantalla nueva (ejemplo "Reportes")

**Paso 0 — Permisos** en `config/roles.php` (sección `modules`), y luego `php artisan permissions:sync`:

```php
'reportes' => [
    'label' => 'Reportes',
    'description' => 'Resúmenes y estadísticas.',
    'actions' => ['ver', 'crear'],
],
```

**Paso 1 — Ruta** en `routes/admin.php`, dentro del grupo `auth`, pidiendo el permiso:

```php
Route::get('reportes', [ReporteController::class, 'index'])->name('reportes.index')->middleware('can:reportes.ver');
```

**Paso 2 — Controlador**: `php artisan make:controller Admin/ReporteController`

```php
public function index(): Response
{
    return Inertia::render('admin/reportes/index', [
        'total' => User::count(),
    ]);
}
```

**Paso 3 — Página** `resources/js/pages/admin/reportes/index.tsx`:

```tsx
import { PageHeader } from '@/components/admin/common/page-header';
import AdminLayout from '@/layouts/admin/admin-layout';
import { Head } from '@inertiajs/react';

export default function Reportes({ total }: { total: number }) {
    return (
        <AdminLayout breadcrumbs={[{ title: 'Reportes', href: '/reportes' }]}>
            <Head title="Reportes" />
            <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
                <PageHeader title="Reportes" description="Resumen general del sistema" />
                <div className="surface rounded-xl p-6">Total de usuarios: {total}</div>
            </div>
        </AdminLayout>
    );
}
```

Si la pantalla necesita piezas propias, créalas en `resources/js/components/admin/reportes/`.

**Paso 4 — Menú**: agrégala en `resources/js/components/admin/layout/admin-sidebar.tsx` (lista `mainNavItems`):

```tsx
// permission: la opción solo aparece para quien lo tiene. Íconos: https://lucide.dev/icons
{ title: 'Reportes', url: '/reportes', icon: BarChart3, permission: 'reportes.ver' },
```

**Paso 5 — Rol**: entra a **Administración → Roles y permisos** y marca "Reportes" en los roles que lo deben ver.

Listo. Si `npm run dev` está corriendo, el navegador se actualiza solo.

---

## 6. Estilos y colores

- **Colores de la marca y modo claro/oscuro**: `resources/css/app.css` (bloques `:root` = claro y `.dark` = oscuro).
- **Clases propias** (también en `app.css`):

| Clase | Efecto |
|---|---|
| `surface` | tarjeta / panel: fondo, borde fino y sombra suave (se adapta a claro y oscuro) |
| `btn-brand` | botón principal azul de la marca |
| `font-display` | tipografía Roboto apenas más apretada, para títulos |
| `num` | números alineados (tablas e indicadores) |
| `nav-item` | efectos de las opciones del menú lateral |
| `btn-icon` + `btn-icon-primary` / `-success` / `-warning` / `-danger` | botón de solo ícono con color; al pasar el mouse un fondo suave crece desde el centro (acciones de tablas) |

- **Imagen de fondo del menú lateral**: `public/images/sidebar-bg.svg` (se cambia en `app.css`).
- **Logo**: guarda tu imagen en `public/images/logo.png` (ver `components/shared/app-logo.tsx`).
- `dark:` delante de una clase = solo en modo oscuro. Ej: `text-blue-700 dark:text-blue-300`.

---

## 7. Cómo está hecho "profesional" (y cómo reutilizarlo)

### Validación → Form Requests
Las reglas de un formulario no van en el controlador sino en su propia clase (`app/Http/Requests/`).
Si los datos están mal, Laravel responde con los errores **antes** de entrar al controlador.

```bash
php artisan make:request Admin/StoreProductoRequest
```

### Permisos → roles (Spatie) + Policies
Hay dos niveles (todo explicado en la **sección 8**):

1. **Permisos del rol** (`usuarios.editar`, `roles.ver`…): se marcan en la pantalla de Roles.
2. **Reglas que valen para todos** en `app/Policies/`. Ej: nadie puede eliminarse a sí mismo.

```php
$request->user()->can('usuarios.editar');  // ¿su rol tiene ese permiso?
$request->user()->can('delete', $user);    // pregunta a UserPolicy (permiso + reglas)
Gate::inspect('delete', $user)->message(); // el motivo si no puede
```

### REGLA DEL SISTEMA: nada se borra → eliminación lógica + quién registró / quién eliminó
En Farma360 **ningún dato se borra de la base de datos**. "Eliminar" solo marca el registro con `deleted_at`.
Además, **toda tabla** tiene estas columnas, que se llenan solas:

| Columna | Qué guarda |
|---|---|
| `registerUser_id` | id del usuario que registró el dato (null = sistema / seeder / autoregistro) |
| `registerRole` | rol que tenía ese usuario al registrarlo |
| `deleteUser_id` | id del usuario que lo eliminó |
| `deleteRole` | rol que tenía ese usuario al eliminarlo |
| `deleted_at` | fecha de eliminación (null = vigente) |

Para una tabla nueva (ej: productos) solo hay que hacer dos cosas — `php artisan make:model Producto -m` ya las trae puestas (ver `stubs/`):

```php
// 1. En la migración
Schema::create('productos', function (Blueprint $table) {
    $table->id();
    // ...columnas...
    $table->timestamps();
    $table->auditable(); // registerUser_id, registerRole, deleteUser_id, deleteRole, deleted_at
});

// 2. En el modelo
class Producto extends Model
{
    use Auditable; // App\Models\Concerns\Auditable
}
```

Y se usa normal:

```php
Producto::create([...]);      // guarda quién lo registró
$producto->delete();          // NO borra: guarda deleted_at y quién lo eliminó
$producto->restore();         // lo recupera
Producto::all();              // solo los vigentes · withTrashed() = todos · onlyTrashed() = solo eliminados
$producto->forceDelete();     // PROHIBIDO: lanza una excepción
```

**Prohibido:** `forceDelete()`, `DB::table(...)->delete()`, `truncate()` o SQL `DELETE`.
Elimina siempre registro por registro (`$modelo->delete()`): el borrado masivo `Producto::where(...)->delete()`
también es lógico pero **no** guarda quién lo eliminó.
**Ojo con los `unique`** (ej: email): un registro eliminado sigue ocupando su valor, así que no se puede volver a crear igual.
El test `tests/Feature/SoftDeleteRuleTest.php` falla si alguna tabla o modelo no cumple la regla.

### Tablas con paginación del servidor
Las tablas **nunca traen todos los registros**: Laravel devuelve solo la página que se ve
(`->paginate($this->perPage($request))`), y la búsqueda y los filtros también se hacen en la base de datos.
Así el sistema va igual de rápido con 50 registros o con 500.000.

- **"Mostrar N registros"** (10, 15, 25, 50, 100): `perPage()` en `app/Http/Controllers/Controller.php`.
  Solo acepta esos valores, así nadie puede pedir `?per_page=100000`.
- **Buscador**: busca al presionar **Enter** o tras **3 segundos** sin escribir (no con cada letra). Se cambia en `SEARCH_DELAY`.
- **Barra de arriba de la tabla** (Mostrar + filtros a la izquierda, buscador a la derecha):
  `components/admin/common/table-toolbar.tsx`. Para una tabla nueva, úsala igual que en `users-toolbar.tsx`.
- **Paginación de abajo** (1, 2, 3…): `components/shared/pagination.tsx`.


### Mensajes en español
`lang/es/` tiene las traducciones oficiales (paquete `laravel-lang`). Para traducir el nombre de un campo
propio en un Form Request usa `attributes()` (ej: `'role' => 'rol'`).

### Páginas de error
`resources/js/pages/error.tsx`. En **local** los errores 500 muestran el detalle técnico de Laravel (para poder arreglarlos);
en **producción** (`APP_DEBUG=false`) se muestra la página con diseño.

---

## 7b. La farmacia: cómo funciona por dentro

### Las 3 ideas clave
1. **El stock vive en los LOTES** (`batches`): cada lote es un producto en una sucursal, con número de lote, vencimiento,
   costo por unidad y cantidad. El stock de un producto = la suma de sus lotes.
2. **El stock se cuenta en la UNIDAD BASE** (tableta, cápsula, frasco). Las **presentaciones** (Unidad, Blíster x10, Caja x100)
   solo dicen cuántas unidades base traen y a qué precio se venden.
3. **El stock nunca se edita a mano**: todo cambio pasa por `App\Services\InventoryService` y deja un movimiento en el
   **kardex** (`stock_movements`): compra, venta, ajuste, baja, transferencia, anulación.

### Dónde está la lógica (`app/Services/`)
| Servicio | Qué hace |
|---|---|
| `InventoryService` | sumar / restar stock de un lote (con kardex) y **FEFO**: elegir los lotes que vencen primero |
| `PurchaseService` | registrar una compra (cada ítem crea un lote) y anularla |
| `SaleService` | vender: FEFO + precio de promoción del lote + pagos combinados + receta para controlados; anular |
| `CashService` | caja: apertura y cierre con **corte de billetes**, ingresos / egresos / retiros, aprobación de diferencias |
| `TransferService` | enviar, recibir (mismo lote y vencimiento en el destino) y anular transferencias |
| `PromotionService` | **promociones por vencimiento**: reglas (90/60/30 días), sugeridas, aplicar, control "bajo el costo" |

Cuando una regla del negocio impide algo (stock insuficiente, caja cerrada…) el servicio lanza
`App\Exceptions\BusinessException`: se deshace todo y el usuario ve el aviso rojo con el motivo.

### Sucursales
Cada usuario puede tener una **sucursal** (Usuarios → editar). Con sucursal solo opera en ella (caja, ventas, compras, inventario);
sin sucursal opera en todas. Ver `User::allowedBranchIds()`.

### Nada se borra
Ventas, compras y transferencias **se anulan** (con motivo, quién y cuándo) y el stock vuelve. Una venta solo se anula
mientras su turno de caja esté abierto.

### Configuración (`config/farmacia.php`)
Moneda, formas de pago, días de alerta de vencimiento y la diferencia de caja que necesita aprobación.

### Catálogos simples
Sucursales, proveedores, clientes, categorías, laboratorios, principios activos, cajas y billetes usan **una sola pantalla**
(`pages/admin/resources/index.tsx`). Cada uno es una clase chica en `app/Http/Controllers/Admin/` que hereda de
`ResourceController` y dice sus campos, columnas y validación.

### Datos de prueba
`php artisan migrate:fresh --seed` crea la farmacia de ejemplo (`database/seeders/PharmacySeeder.php`): 3 sucursales,
11 productos, compras, lotes por vencer y uno vencido, promociones, una transferencia en camino y una caja abierta con ventas.
Usuarios (contraseña `password`): `admin@admin.com` (Super Admin), `regente@farma360.test`, `cajero@farma360.test`, `almacenero@farma360.test`.

---

## 8. Roles y permisos

Se usa el paquete [spatie/laravel-permission](https://spatie.be/docs/laravel-permission). La idea:

```
USUARIO ──tiene UN──► ROL ──tiene VARIOS──► PERMISOS
Ana                   Supervisor            usuarios.ver
```

### Los permisos salen de un catálogo: `config/roles.php`

Cada permiso es **módulo.acción**. El catálogo dice qué módulos existen y qué acciones tiene cada uno:

| Módulo | Ver | Crear | Editar | Eliminar |
|---|:-:|:-:|:-:|:-:|
| `usuarios` | ✔ | ✔ | ✔ (incluye activar/desactivar) | ✔ |
| `roles` | ✔ | ✔ | ✔ | ✔ |

El **Dashboard** y **Mis ajustes** no piden permiso: los ve cualquiera que inicie sesión.

Después de cambiar el catálogo corre:

```bash
php artisan permissions:sync   # crea los permisos nuevos y elimina (lógicamente) los que quitaste
```

### Roles iniciales

| Rol | Qué puede hacer |
|---|---|
| **Super Admin** | TODO, siempre. No se puede editar ni eliminar. Solo otro Super Admin puede tocar su cuenta o dar este rol. |
| **Administrador** | Todos los permisos (pero se pueden quitar desde la pantalla de Roles). |
| **Supervisor** | Ver usuarios. |
| **Operador** | Solo dashboard y sus ajustes. Es el rol de quien se registra solo (`default_role`). |
| **Regente** | Productos, compras, inventario (con ajustes), transferencias, promociones, ver ventas y reportes. |
| **Cajero** | Punto de venta, su caja (abrir, movimientos, cerrar), ver productos y registrar clientes. |
| **Almacenero** | Compras, inventario (con ajustes) y transferencias. |

Se crean una sola vez (`permissions:sync`). Después se cambian desde **Administración → Roles y permisos**:
crear roles nuevos (ej: "Cajero"), marcar sus permisos en la tabla de casillas, y eliminar los que no tengan usuarios.

### Dónde se revisan los permisos

| Capa | Archivo | Qué hace |
|---|---|---|
| **Rutas** (seguridad real) | `routes/admin.php` | `->middleware('can:usuarios.ver')`: sin permiso → página 403 |
| **Reglas extra** | `app/Policies/UserPolicy.php` | no eliminarse a sí mismo, proteger al Super Admin |
| **Formularios** | `app/Http/Requests/Admin/*` | no cambiarse el propio rol, solo roles que existen |
| **Super Admin** | `app/Providers/AppServiceProvider.php` | `Gate::before`: le da todos los permisos del catálogo |
| **React** (solo esconder) | `hooks/use-can.ts` | `can('usuarios.crear')` oculta botones y opciones del menú |

> ⚠️ **Esconder un botón en React NO es seguridad.** La seguridad la ponen las rutas de Laravel.
> Siempre que agregues una ruta, ponle su `->middleware('can:...')`.

### En React

```tsx
import { useCan } from '@/hooks/use-can';

const can = useCan();
{can('usuarios.crear') && <Button>Nuevo usuario</Button>}
```

En el menú lateral y en el buscador (Ctrl+K) basta con poner `permission: 'modulo.accion'` en la opción.

### En Laravel

```php
$user->role;                         // "Supervisor"
$user->can('usuarios.editar');       // true / false
$user->syncRoles(['Operador']);      // cambiarle el rol (cada usuario tiene uno solo)
$user->isSuperAdmin();               // true / false
User::factory()->withRole('Supervisor')->create();   // en pruebas
```

---

## 9. Cómo leer los comentarios del código

Todos los archivos propios del proyecto están comentados en español con el mismo formato:

```tsx
/**
 * Arriba de cada archivo: QUÉ es y DÓNDE se usa.
 */

/** Arriba de cada función o componente: qué hace (y a veces un ejemplo de uso). */
export function RoleBadge({ role }) { ... }

// Dentro del código: POR QUÉ una línea está así.
const isEdit = user !== null;

{/* Dentro del JSX (el "HTML" de React) los comentarios van entre llaves */}
```

En PHP es igual: `/** ... */` arriba de cada clase o método y `// ...` en las líneas importantes.
Cada método de controlador dice su **ruta** (ej: `GET /admin/users`) y qué página de React abre.

**Recorrido recomendado** para entender un módulo completo (ej: usuarios):

1. `routes/admin.php` → qué URLs existen
2. `app/Http/Controllers/Admin/UserController.php` → qué datos se preparan
3. `resources/js/pages/admin/users/index.tsx` → cómo se arma la pantalla
4. `resources/js/components/admin/users/*` → cada pieza por separado

> `components/ui/` no está comentado porque es una librería (shadcn/ui). Lee su [README](resources/js/components/ui/README.md).

---

## 10. Comandos del día a día

```bash
composer dev               # levanta TODO (Laravel + Vite + logs) → http://127.0.0.1:8000
                           # ⚠️ en tu PC el 8000 lo usa otra app (SIAT): usa en su lugar
                           #    php artisan serve --port=8077   y en otra terminal   npm run dev
npm run build              # compila el frontend para producción
php artisan test           # corre las pruebas
php artisan migrate --seed # crea tablas + roles + admin@admin.com / password (Super Admin)
php artisan permissions:sync # después de cambiar config/roles.php (módulos y acciones)
npx tsc --noEmit           # revisa errores de TypeScript
npm run format             # ordena el formato del código (Prettier)
```

> ⚠️ Antes de subir a producción cambia la contraseña de `admin@admin.com`.
