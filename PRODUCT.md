# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Funcionarios y personal de oficina, no técnicos, que cargan y consultan datos muchas horas al día desde PCs de escritorio. Un administrador gestiona usuarios y roles.

## Product Purpose
Plantilla base (Laravel 12 + Inertia + React + Tailwind v4) desde la que se arranca cada sistema administrativo nuevo para clientes (gobierno, empresas; p. ej. Jichi). Trae resuelto lo común: login/registro, dashboard con métricas, gestión de usuarios con roles y activación, eliminación lógica con registro de quién creó / eliminó, ajustes de perfil/contraseña/apariencia. Éxito: que cada sistema derivado arranque viéndose profesional y que agregar módulos nuevos sea copiar patrones existentes.

## Positioning
Base propia del desarrollador para entregar sistemas administrativos a clientes con una primera impresión de software moderno tipo SaaS, sin perder legibilidad para uso de oficina diario.

## Operating Context
- Uso prolongado en jornada de oficina; tablas, filtros, formularios y exportación CSV son el trabajo diario.
- Interfaz en español.
- Modo claro y oscuro con selector (claro / oscuro / sistema).
- Roles y permisos con spatie/laravel-permission: un rol por usuario, permisos `modulo.accion` desde el catálogo config/roles.php. Roles iniciales: Super Admin (todo, protegido), Administrador, Supervisor, Operador. Se gestionan en /admin/roles.

## Capabilities and Constraints
- Rutas: /dashboard, /admin/users (CRUD, toggle), /admin/roles (roles y matriz de permisos), /settings/*, auth completo.
- Datos de demo vía `php artisan db:seed` (admin@admin.com / password, 48 usuarios).
- Componentes UI estilo shadcn en `resources/js/components/ui`.

## Brand Commitments
- Tipografía: Roboto (pedida por el usuario 2026-10-29, estilo de sus otros sistemas). Binding.
- Paleta: corporativo azul (elegida por el usuario 2026-10-28). Menú lateral azul marino #0B1B33 también en modo claro, primario azul #0D6EFD, fondo gris perla #F4F6F9 con tarjetas blancas. Modo oscuro negro neutro (sin tinte azul), azul solo como acento. Sin degradados ni brillos decorativos. Tokens en `resources/css/app.css`.
- Nombre genérico "Panel Admin": cada cliente lo reemplaza.

## Evidence on Hand
Solo datos de demo generados por seeder. No hay clientes, testimonios ni métricas reales; no inventarlos.

## Product Principles
1. Legible antes que llamativo: funcionarios lo usan horas; el contraste y la densidad sirven al trabajo.
2. Primera impresión de producto moderno: el cliente debe ver software serio, no una plantilla.
3. Patrones repetibles: cada pantalla nueva debe poder copiar la estructura de usuarios/roles.
4. Neutral de marca: el estilo debe aceptar el logo y nombre de cualquier cliente.
