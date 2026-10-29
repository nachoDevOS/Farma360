# components/ui

Piezas **básicas** de interfaz (botón, input, select, ventana modal, menú desplegable, sidebar…).

Vienen de la librería [shadcn/ui](https://ui.shadcn.com) y están copiadas aquí para que puedas
usarlas en cualquier pantalla. **No hace falta modificarlas**: para cambiar cómo se ven, pásales
clases con `className`.

```tsx
import { Button } from '@/components/ui/button';

<Button>Guardar</Button>
<Button variant="outline">Cancelar</Button>
<Button variant="destructive">Eliminar</Button>
<Button className="btn-brand">Botón con el estilo de la marca</Button>
```

Ejemplos de uso de cada una en este proyecto:

| Pieza | Dónde verla usada |
|---|---|
| `button`, `input`, `label`, `checkbox` | `pages/auth/login.tsx` |
| `dialog` (ventana modal) | `components/admin/users/user-form-dialog.tsx` |
| `select` | `components/admin/users/users-toolbar.tsx` |
| `dropdown-menu` | `components/admin/layout/nav-user.tsx` (menú del usuario) |
| `sidebar` | `components/admin/layout/admin-sidebar.tsx` |

Documentación de cada pieza: https://ui.shadcn.com/docs/components

Si necesitas una pieza que no está aquí (ej: `card`, `badge`, `alert`), agrégala con:

```bash
npx shadcn@latest add card
```
