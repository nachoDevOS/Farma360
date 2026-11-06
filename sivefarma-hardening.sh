#!/usr/bin/env bash
# =============================================================================
# Hardening de producción para SIVEFARMA (Laravel 12 + Inertia + React)
# Stack: Ubuntu 22.04 / 24.04, Nginx, PHP-FPM. Seguro en servidor multiproyecto.
#
# Uso:
#   sudo bash sivefarma-hardening.sh PROJECT_PATH DEPLOY_USER APP_USER NGINX_CONF
#
# Ejemplo:
#   sudo bash sivefarma-hardening.sh /var/www/sivefarma usuario name_project_user_php sites-available
#
#   PROJECT_PATH  Carpeta del proyecto, dentro de /var/www.
#   DEPLOY_USER   Quien hace git pull y composer. Es dueño del código.
#   APP_USER      Usuario exclusivo con el que corre PHP. Si no existe, se crea.
#   NGINX_CONF    Nombre del archivo en /etc/nginx/sites-available.
#
# Opciones (variables de entorno):
#   ALLOW_REGISTER=1       Permite el registro público. Por defecto se bloquea.
#   ALLOW_INSECURE_HTTP=1  Permite APP_URL con http. Solo para pruebas internas.
#   ASSUME_YES=1           No pregunta antes de empezar (para deploys automáticos).
#
# Qué garantiza:
#   - NO toca php.ini global: todo va en un pool FPM propio de este proyecto.
#   - PHP corre con usuario propio y solo escribe en storage/. El código, el .env y
#     bootstrap/cache (que es PHP ejecutable y guarda secretos) son de solo lectura.
#   - Solo se ejecuta public/index.php: se prueba con un script real, no con un 404.
#   - El sitio responde solo a su dominio: evita envenenar los enlaces de recuperar
#     contraseña con un Host falso.
#   - Root nunca hace chmod ni sigue enlaces dentro de storage/, donde escribe PHP.
#   - Hace backups y deshace los cambios si Nginx o FPM fallan.
#
# Se puede correr las veces que haga falta. Conviene correrlo tras cada deploy.
# Sin dependencias de desarrollo: composer install --no-dev --optimize-autoloader
# =============================================================================

set -Eeuo pipefail
umask 027
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
WARNINGS=0

PROJECT_ARG="${1:-}"
DEPLOY_USER="${2:-}"
APP_USER="${3:-}"
NGINX_CONF="${4:-}"
ALLOW_REGISTER="${ALLOW_REGISTER:-0}"
ALLOW_INSECURE_HTTP="${ALLOW_INSECURE_HTTP:-0}"
ASSUME_YES="${ASSUME_YES:-0}"

BACKUP_KEEP=5
CONFIG_PENDING=false
PERMISSIONS_CHANGED=false
ENV_CHANGED=false
FPM_RELOADED=false
POOL_EXISTED=false
SNIPPET_EXISTED=false
BACKUP_DIR=""
PROBE_FILE=""
NGINX_PATH=""
POOL_FILE=""
SNIPPET_FILE=""
NGINX_USER=""
PROJECT=""
FPM_SERVICE=""

ok()      { echo -e "${GREEN}  ✓${NC} $1"; }
warn()    { echo -e "${YELLOW}  ⚠${NC}  $1"; WARNINGS=$((WARNINGS + 1)); }
info()    { echo -e "${CYAN}  →${NC} $1"; }
section() { echo -e "\n${BOLD}${CYAN}== $1 ==${NC}"; }
clean()   { sed 's/[^[:print:]]/?/g'; }

rollback_config() {
    [ -n "$BACKUP_DIR" ] || return 0
    [ -f "$BACKUP_DIR/nginx.conf" ] && cat "$BACKUP_DIR/nginx.conf" > "$NGINX_PATH"
    if [ "$POOL_EXISTED" = true ]; then
        cp "$BACKUP_DIR/pool.conf" "$POOL_FILE"
    else
        rm -f "$POOL_FILE"
    fi
    if [ "$SNIPPET_EXISTED" = true ]; then
        cp "$BACKUP_DIR/snippet.conf" "$SNIPPET_FILE"
    else
        rm -f "$SNIPPET_FILE"
    fi
    if [ "$ENV_CHANGED" = true ]; then
        cat "$BACKUP_DIR/env" > "$PROJECT/.env"
    fi
    # Nginx sigue con el pool anterior: ese pool debe poder leer el proyecto
    if [ "$PERMISSIONS_CHANGED" = true ]; then
        chgrp -hR "$NGINX_USER" "$PROJECT"
    fi
    if [ "$FPM_RELOADED" = true ]; then
        systemctl reload "$FPM_SERVICE" || true
    fi
    warn "Configuración de Nginx, del pool y .env restaurados desde $BACKUP_DIR"
}

undo_if_pending() {
    if [ "$CONFIG_PENDING" = true ]; then
        CONFIG_PENDING=false
        rollback_config
    fi
}

die() {
    echo -e "${RED}  ✗ ERROR:${NC} $1" >&2
    undo_if_pending
    exit 1
}

on_error() {
    echo -e "${RED}  ✗ Fallo en la línea $1.${NC}" >&2
    undo_if_pending
}

cleanup() {
    if [ -n "$PROBE_FILE" ]; then
        rm -f -- "$PROBE_FILE"
    fi
}

trap 'on_error $LINENO' ERR
trap cleanup EXIT
trap 'die "Interrumpido."' INT TERM

env_value() {
    grep -E "^$1=" "$PROJECT/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'"'\r ' || true
}

# =============================================================================
section "0. Validaciones (todavía no se cambia nada)"
# =============================================================================

if [ -z "$NGINX_CONF" ]; then
    echo "Uso: sudo bash $0 PROJECT_PATH DEPLOY_USER APP_USER NGINX_CONF"
    exit 1
fi

[ "$(id -u)" -eq 0 ] || die "Ejecuta el script con sudo."
for tool in sudo nginx flock awk sed curl openssl timeout; do
    command -v "$tool" &>/dev/null || die "Falta el comando: $tool"
done

exec 9>/run/sivefarma-hardening.lock
flock -n 9 || die "Ya hay otra ejecución de este script en curso."

for name in "$DEPLOY_USER" "$APP_USER"; do
    [[ "$name" =~ ^[a-z_][a-z0-9_-]{0,30}$ ]] || die "Nombre de usuario inválido: $name"
done
[[ "$NGINX_CONF" =~ ^[A-Za-z0-9._-]+$ ]] || die "Nombre de config Nginx inválido: $NGINX_CONF"
[ "$DEPLOY_USER" != "root" ] || die "DEPLOY_USER no puede ser root."
[ "$APP_USER" != "root" ] || die "APP_USER no puede ser root."
[ "$DEPLOY_USER" != "$APP_USER" ] || die "DEPLOY_USER y APP_USER deben ser distintos: PHP no debe ser dueño del código."
id "$DEPLOY_USER" &>/dev/null || die "El usuario '$DEPLOY_USER' no existe."

PROJECT="$(realpath -e "$PROJECT_ARG" 2>/dev/null)" || die "La carpeta '$PROJECT_ARG' no existe."
[[ "$PROJECT" =~ ^/var/www/[A-Za-z0-9._/-]+$ ]] || die "El proyecto debe estar dentro de /var/www y sin caracteres raros: $PROJECT"
[ -f "$PROJECT/artisan" ] || die "No hay artisan en $PROJECT."
grep -q '"laravel/framework"' "$PROJECT/composer.json" || die "$PROJECT no parece un proyecto Laravel."
[ -f "$PROJECT/.env" ] || die "Falta $PROJECT/.env."
[ ! -L "$PROJECT/.env" ] || die "$PROJECT/.env es un enlace simbólico. Debe ser un archivo normal."
[ -f "$PROJECT/vendor/autoload.php" ] || die "Falta vendor. Corre: composer install --no-dev --optimize-autoloader"
[ -f "$PROJECT/public/build/manifest.json" ] || die "Falta public/build. Corre: npm ci && npm run build"

# Paquetes de desarrollo: Boost y Pail agregan rutas y comandos que no deben estar en producción
for package in phpunit/phpunit laravel/boost laravel/pail; do
    [ ! -d "$PROJECT/vendor/$package" ] || die "Hay paquetes de desarrollo ($package). Corre: composer install --no-dev --optimize-autoloader"
done

# Un kernel sin esta protección permitiría robar archivos del sistema con un enlace duro desde storage
if [ "$(sysctl -n fs.protected_hardlinks 2>/dev/null || echo 0)" != "1" ]; then
    die "fs.protected_hardlinks no está activo. Corre: sysctl -w fs.protected_hardlinks=1"
fi

APP_URL="$(env_value APP_URL)"
[[ "$APP_URL" =~ ^(https?)://([A-Za-z0-9.-]+)(:[0-9]+)?(/.*)?$ ]] || die "APP_URL no es válido en .env: '$APP_URL'"
URL_SCHEME="${BASH_REMATCH[1]}"
HOST="${BASH_REMATCH[2]}"
case "$HOST" in
    localhost|127.0.0.1) die "APP_URL apunta a $HOST. Pon el dominio real." ;;
esac
if [ "$URL_SCHEME" != "https" ] && [ "$ALLOW_INSECURE_HTTP" != "1" ]; then
    die "APP_URL no usa https: las contraseñas viajarían sin cifrar. Instala el certificado primero."
fi

DB_CONNECTION="$(env_value DB_CONNECTION)"
DB_DATABASE="$(env_value DB_DATABASE)"

NGINX_PATH="/etc/nginx/sites-available/$NGINX_CONF"
if [ ! -f "$NGINX_PATH" ]; then
    echo "  Configs disponibles:" >&2
    ls -1 /etc/nginx/sites-available >&2
    die "No existe $NGINX_PATH."
fi
[ -e "/etc/nginx/sites-enabled/$NGINX_CONF" ] || die "$NGINX_CONF no está habilitado en sites-enabled."

# Todos los root del archivo, aunque estén en un bloque escrito en una sola línea
NGINX_ROOTS="$(sed 's/#.*//' "$NGINX_PATH" | grep -oE '(^|[[:space:]{;])root[[:space:]]+[^;]+'     | awk '{ value = $NF; gsub(/"/, "", value); sub(/\/$/, "", value); print value }' | sort -u || true)"

# El root DEBE ser public/. Si apunta al proyecto, el .env queda expuesto.
grep -Fxq "$PROJECT/public" <<< "$NGINX_ROOTS" || die "En $NGINX_PATH falta 'root $PROJECT/public;'. No se hace nada: revisalo a mano."

# Más abajo se reemplaza fastcgi_pass en todo el archivo: no puede haber otro sitio adentro
[ "$NGINX_ROOTS" = "$PROJECT/public" ] || die "$NGINX_PATH tiene otro sitio con un root distinto. Sepáralo en su propio archivo."
grep -Eq '^[[:space:]]*fastcgi_pass[[:space:]]' "$NGINX_PATH" || die "No hay fastcgi_pass en $NGINX_PATH."

POOL="$(basename "$PROJECT" | tr -c 'a-zA-Z0-9-' '-' | sed 's/-*$//')"
[ -n "$POOL" ] || die "No se pudo derivar el nombre del pool."
SOCKET="/run/php/$POOL.sock"
SNIPPET_FILE="/etc/nginx/snippets/$POOL-security.conf"

# Versión de PHP-FPM: la del pool ya creado, o la del socket actual, o la de la CLI
PHP_V=""
for candidate in /etc/php/*/fpm/pool.d/"$POOL".conf; do
    if [ -f "$candidate" ]; then
        PHP_V="$(echo "$candidate" | cut -d/ -f4)"
    fi
done
[ -n "$PHP_V" ] || PHP_V="$(grep -oE 'php[0-9]+\.[0-9]+-fpm' "$NGINX_PATH" | head -1 | grep -oE '[0-9]+\.[0-9]+' || true)"
[ -n "$PHP_V" ] || PHP_V="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
[[ "$PHP_V" =~ ^[0-9]+\.[0-9]+$ ]] || die "Versión de PHP inválida: $PHP_V"
FPM_BIN="php-fpm$PHP_V"
FPM_SERVICE="php$PHP_V-fpm"
PHP_BIN="php$PHP_V"
POOL_FILE="/etc/php/$PHP_V/fpm/pool.d/$POOL.conf"
[ -d "/etc/php/$PHP_V/fpm/pool.d" ] || die "No está instalado PHP-FPM $PHP_V."
command -v "$FPM_BIN" &>/dev/null || die "No se encontró $FPM_BIN."
command -v "$PHP_BIN" &>/dev/null || die "No se encontró $PHP_BIN (paquete php$PHP_V-cli)."
(cd / && "$PHP_BIN" -r 'exit(PHP_VERSION_ID >= 80200 ? 0 : 1);') || die "SIVEFARMA necesita PHP 8.2 o superior."

# Dos proyectos con la misma carpeta final se pisarían el pool: aquí se detiene
if [ -f "$POOL_FILE" ] && ! grep -Fq "open_basedir] = $PROJECT:" "$POOL_FILE"; then
    die "$POOL_FILE ya existe y es de otro proyecto. No se toca."
fi

MODULES="$(cd / && "$PHP_BIN" -m | tr '[:upper:]' '[:lower:]')"
REQUIRED="curl gd mbstring openssl fileinfo tokenizer xml"
case "$DB_CONNECTION" in
    mysql|mariadb) REQUIRED="$REQUIRED pdo_mysql" ;;
    pgsql)         REQUIRED="$REQUIRED pdo_pgsql" ;;
    sqlite)        REQUIRED="$REQUIRED pdo_sqlite" ;;
esac
for module in $REQUIRED; do
    grep -qx "$module" <<< "$MODULES" || die "Falta la extensión PHP $module. Instala php$PHP_V-${module#pdo_}."
done

NGINX_USER="$(awk '$1 == "user" { gsub(/;/, "", $2); print $2; exit }' /etc/nginx/nginx.conf)"
NGINX_USER="${NGINX_USER:-www-data}"
[ "$APP_USER" != "$NGINX_USER" ] || die "APP_USER es igual al de Nginx: los demás proyectos podrían leer este .env. Usa un usuario propio."

echo "  Proyecto:  $PROJECT"
echo "  Dominio:   $HOST ($URL_SCHEME)"
echo "  Deploy:    $DEPLOY_USER (dueño del código)"
echo "  PHP corre: $APP_USER (pool $POOL, PHP $PHP_V)"
echo "  Nginx:     $NGINX_PATH"
echo "  Registro:  $([ "$ALLOW_REGISTER" = "1" ] && echo 'permitido' || echo 'BLOQUEADO')"
echo ""
if [ "$ASSUME_YES" != "1" ]; then
    read -rp "  ¿Continuar? [s/N]: " CONFIRM
    [[ "$CONFIRM" =~ ^[sS]$ ]] || { echo "  Cancelado."; exit 0; }
fi

BACKUP_DIR="/root/hardening-backups/$POOL-$(date +%Y%m%d_%H%M%S)"
install -d -m 700 /root/hardening-backups "$BACKUP_DIR"
cp "$NGINX_PATH" "$BACKUP_DIR/nginx.conf"
install -m 600 "$PROJECT/.env" "$BACKUP_DIR/env"
if [ -f "$POOL_FILE" ]; then
    POOL_EXISTED=true
    cp "$POOL_FILE" "$BACKUP_DIR/pool.conf"
fi
if [ -f "$SNIPPET_FILE" ]; then
    SNIPPET_EXISTED=true
    cp "$SNIPPET_FILE" "$BACKUP_DIR/snippet.conf"
fi
ok "Backups en $BACKUP_DIR (solo root)"

# Cada backup guarda una copia del .env: no se acumulan secretos para siempre
find /root/hardening-backups -mindepth 1 -maxdepth 1 -type d -name "$POOL-*" -printf '%T@ %p\n' \
    | sort -rn | tail -n +$((BACKUP_KEEP + 1)) | cut -d' ' -f2- \
    | while read -r old_backup; do rm -rf -- "$old_backup"; done

# =============================================================================
section "1. Usuario de la aplicación"
# =============================================================================

if id "$APP_USER" &>/dev/null; then
    ok "Usuario $APP_USER ya existe"
else
    useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$APP_USER"
    ok "Usuario $APP_USER creado, sin login ni carpeta personal"
fi
usermod -aG "$APP_USER" "$DEPLOY_USER"
ok "$DEPLOY_USER agregado al grupo $APP_USER (vale desde su próximo login)"

# =============================================================================
section "2. Pool PHP-FPM propio (no toca php.ini global)"
# =============================================================================

CONFIG_PENDING=true

cat > "$POOL_FILE" <<EOF
; Generado por sivefarma-hardening.sh
[$POOL]
user = $APP_USER
group = $APP_USER
listen = $SOCKET
listen.owner = $NGINX_USER
listen.group = $NGINX_USER
listen.mode = 0660

pm = ondemand
pm.max_children = 10
pm.process_idle_timeout = 30s
pm.max_requests = 500
request_terminate_timeout = 90s
security.limit_extensions = .php
clear_env = yes

php_admin_value[open_basedir] = $PROJECT:/usr/share/zoneinfo
php_admin_value[upload_tmp_dir] = $PROJECT/storage/framework/tmp
php_admin_value[sys_temp_dir] = $PROJECT/storage/framework/tmp
php_admin_value[disable_functions] = exec,system,passthru,shell_exec,popen,proc_open,proc_close,proc_nice,proc_terminate,proc_get_status,pcntl_exec,pcntl_fork,pcntl_signal,pcntl_alarm,dl,phpinfo,show_source,highlight_file,symlink,link,posix_kill,posix_setuid,posix_setgid,posix_setsid,posix_setpgid
php_admin_flag[allow_url_fopen] = off
php_admin_flag[allow_url_include] = off
php_admin_flag[expose_php] = off
php_admin_flag[display_errors] = off
php_admin_flag[display_startup_errors] = off
php_admin_flag[log_errors] = on
php_admin_flag[zend.exception_ignore_args] = on
php_admin_value[error_log] = $PROJECT/storage/logs/php-fpm.log
php_admin_value[upload_max_filesize] = 8M
php_admin_value[post_max_size] = 10M
php_admin_value[max_file_uploads] = 10
php_admin_value[max_input_vars] = 3000
php_admin_value[max_execution_time] = 60
php_admin_value[max_input_time] = 60
php_admin_value[memory_limit] = 256M
EOF
chmod 644 "$POOL_FILE"

"$FPM_BIN" -t 2>/dev/null || { "$FPM_BIN" -t || true; die "La configuración de FPM no es válida."; }
ok "Pool $POOL válido: $POOL_FILE"

# =============================================================================
section "3. Nginx"
# =============================================================================

REGISTER_BLOCK="# Registro público bloqueado: las cuentas las crea un administrador
location ~ ^/register/?\$ { return 404; }"
if [ "$ALLOW_REGISTER" = "1" ]; then
    REGISTER_BLOCK="# Registro público permitido (ALLOW_REGISTER=1)"
fi

HSTS_LINE="# Sin HSTS: APP_URL no usa https"
if [ "$URL_SCHEME" = "https" ]; then
    HSTS_LINE='add_header Strict-Transport-Security "max-age=31536000" always;'
fi

BASE_HOST="${HOST#www.}"
HOST_REGEX="^(www\\.)?${BASE_HOST//./\\.}\$"

cat > "$SNIPPET_FILE" <<EOF
# Generado por sivefarma-hardening.sh
server_tokens off;
autoindex off;
client_max_body_size 12M;
client_body_timeout 30s;
client_header_timeout 30s;
send_timeout 60s;
fastcgi_hide_header X-Powered-By;

# El punto de venta manda cabeceras Link grandes: con el búfer por defecto Nginx responde 502
fastcgi_buffer_size 32k;
fastcgi_buffers 16 32k;
fastcgi_busy_buffers_size 64k;

add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
add_header Content-Security-Policy "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" always;
$HSTS_LINE

# Solo se atiende el dominio del sistema. Laravel arma el enlace de recuperar
# contraseña con el Host recibido: un Host falso lo mandaría al sitio del atacante.
if (\$host !~* "$HOST_REGEX") { return 444; }

# Archivos ocultos (.env, .git). Se deja .well-known para renovar el certificado
location ~ /\.(?!well-known/) { return 404; }

# /index.php/ruta llega a Laravel como /ruta y saltaría los bloqueos por URL de este archivo
location ~* ^/index\.php/ { return 404; }

# Solo se ejecuta public/index.php. Cualquier otro script da 404
location ~* ^/(?!index\.php\$).*\.(?:php[0-9]?|phtml|phar|phps|pht|cgi|pl|py|sh|asp|aspx|jsp)\$ { return 404; }

# Respaldos y archivos que nunca deben descargarse
location ~* \.(?:sql|sqlite|bak|old|orig|swp|log|ini|env|tar|gz|zip|rar|7z)\$ { return 404; }

$REGISTER_BLOCK

EOF
chmod 644 "$SNIPPET_FILE"

# Lo que ya define el snippet se comenta, porque Nginx rechaza directivas duplicadas
sed -Ei \
    -e 's/^([[:space:]]*)(server_tokens|autoindex|client_max_body_size|client_body_timeout|client_header_timeout|send_timeout|fastcgi_buffer_size|fastcgi_buffers|fastcgi_busy_buffers_size)([[:space:]])/\1# hardening: \2\3/' \
    -e "s/^([[:space:]]*)(add_header[[:space:]]+[\"']?(X-Frame-Options|X-Content-Type-Options|X-XSS-Protection|Referrer-Policy|Permissions-Policy|Strict-Transport-Security|Content-Security-Policy))/\1# hardening: \2/" \
    "$NGINX_PATH"

if ! grep -Fq "include snippets/$POOL-security.conf;" "$NGINX_PATH"; then
    TEMP_CONF="$(mktemp)"
    awk -v want="$PROJECT/public" -v line="    include snippets/$POOL-security.conf;" '
        { print }
        $1 == "root" { value = $2; gsub(/[;"]/, "", value); sub(/\/$/, "", value); if (value == want) print line }
    ' "$NGINX_PATH" > "$TEMP_CONF"
    cat "$TEMP_CONF" > "$NGINX_PATH"
    rm -f "$TEMP_CONF"
fi
sed -Ei "s#^([[:space:]]*)fastcgi_pass[[:space:]]+[^;]+;#\1fastcgi_pass unix:$SOCKET;#" "$NGINX_PATH"

# Nginx usa la primera location regex que coincide: las del snippet deben ir antes que la de PHP
INCLUDE_LINE="$(grep -nF "include snippets/$POOL-security.conf;" "$NGINX_PATH" | head -1 | cut -d: -f1 || true)"
[ -n "$INCLUDE_LINE" ] || die "No se pudo agregar el snippet: pon 'root $PROJECT/public;' en su propia línea."
PHP_LOCATION_LINE="$(grep -nE '^[[:space:]]*location[[:space:]]+~.*php' "$NGINX_PATH" | head -1 | cut -d: -f1 || true)"
if [ -n "$PHP_LOCATION_LINE" ] && [ "$PHP_LOCATION_LINE" -lt "$INCLUDE_LINE" ]; then
    die "En $NGINX_CONF la location de PHP está antes que 'root'. Sube el root al inicio del bloque server."
fi

if ! nginx -t 2>/dev/null; then
    nginx -t || true
    die "nginx -t falló. Se restaura la configuración; no se cambiaron permisos."
fi
ok "Configuración de Nginx válida"
if grep -Eq '^[[:space:]]*add_header' "$NGINX_PATH"; then
    warn "Quedan otros add_header en $NGINX_CONF. Un add_header dentro de location anula los headers de seguridad."
fi
if grep -Eq '^[[:space:]]*listen[[:space:]].*default_server' "$NGINX_PATH"; then
    warn "$NGINX_CONF es default_server: recibirá también las peticiones de otros dominios (se cortan con 444)."
fi

# =============================================================================
section "4. Variables de .env"
# =============================================================================

write_env() {
    if grep -q "^$1=" "$PROJECT/.env"; then
        sed -i "s|^$1=.*|$1=$2|" "$PROJECT/.env"
    else
        echo "$1=$2" >> "$PROJECT/.env"
    fi
}
set_env() {
    write_env "$1" "$2"
    ok "$1=$2"
}

ENV_CHANGED=true
set_env APP_ENV production
set_env APP_DEBUG false
set_env LOG_LEVEL warning
set_env SESSION_ENCRYPT true
if [ "$URL_SCHEME" = "https" ]; then
    set_env SESSION_SECURE_COOKIE true
fi

[ -n "$(env_value DB_PASSWORD)" ] || warn "DB_PASSWORD está vacío."
[ "$(env_value DB_USERNAME)" != "root" ] || warn "La base usa el usuario root. Crea un usuario solo para esta base."
[ "$(env_value MAIL_MAILER)" != "log" ] || warn "MAIL_MAILER=log: los correos de recuperar contraseña no se envían."
[ "$(env_value FILESYSTEM_DISK)" = "s3" ] || warn "FILESYSTEM_DISK no es s3: las imágenes de productos y usuarios no se van a mostrar."
BCRYPT_ROUNDS="$(env_value BCRYPT_ROUNDS)"
if [ -n "$BCRYPT_ROUNDS" ] && [ "$BCRYPT_ROUNDS" -lt 12 ] 2>/dev/null; then
    warn "BCRYPT_ROUNDS=$BCRYPT_ROUNDS es bajo. Usa 12 o más."
fi

# =============================================================================
section "5. Permisos"
# =============================================================================

# storage/ se trata aparte: ahí escribe PHP, y si lo hackean puede plantar enlaces.
# Root solo usa chown -h desde cada carpeta (-execdir) y los chmod corren como APP_USER.
fix_storage() {
    find "$PROJECT/storage" -xdev \( ! -user "$APP_USER" -o ! -group "$APP_USER" \) \
        -execdir chown -h "$APP_USER:$APP_USER" {} +
    sudo -u "$APP_USER" -H find "$PROJECT/storage" -xdev -type d ! -perm 2770 -exec chmod 2770 {} +
    sudo -u "$APP_USER" -H find "$PROJECT/storage" -xdev -type f ! -perm 660 -exec chmod 660 {} +
}

PERMISSIONS_CHANGED=true
mkdir -p "$PROJECT/bootstrap/cache"
find "$PROJECT" \( -path "$PROJECT/.git" -o -path "$PROJECT/node_modules" -o -path "$PROJECT/storage" \) -prune \
    -o -exec chown -h "$DEPLOY_USER:$APP_USER" {} +

# Código: el dueño escribe, PHP solo lee, el resto del servidor no ve nada.
# .git y node_modules van aparte: node_modules necesita conservar sus ejecutables.
find "$PROJECT" \( -path "$PROJECT/.git" -o -path "$PROJECT/node_modules" -o -path "$PROJECT/storage" \) -prune \
    -o -type d -exec chmod 2750 {} +
find "$PROJECT" \( -path "$PROJECT/.git" -o -path "$PROJECT/node_modules" -o -path "$PROJECT/storage" \) -prune \
    -o -type f -exec chmod 640 {} +
ok "Código y bootstrap/cache: PHP solo lee (carpetas 2750, archivos 640)"

if [ -d "$PROJECT/.git" ]; then
    chown -hR "$DEPLOY_USER":"$DEPLOY_USER" "$PROJECT/.git"
    chmod -R go-rwx "$PROJECT/.git"
    ok ".git: solo $DEPLOY_USER"
fi
if [ -d "$PROJECT/node_modules" ]; then
    chown -hR "$DEPLOY_USER":"$APP_USER" "$PROJECT/node_modules"
    chmod -R g-w,o-rwx "$PROJECT/node_modules"
fi

chmod 750 "$PROJECT/artisan"
if [ -d "$PROJECT/vendor/bin" ]; then
    find "$PROJECT/vendor/bin" -type f -exec chmod 750 {} +
fi

# Nginx entra a la raíz sin poder listarla, y lee solo public/
chmod 2751 "$PROJECT"
find "$PROJECT/public" -type d -exec chmod 2755 {} +
find "$PROJECT/public" -type f -exec chmod 644 {} +
ok "public/: legible por Nginx (carpetas 2755, archivos 644)"

# public/hot lo crea 'npm run dev': haría que la página cargue los scripts desde otro servidor
if [ -f "$PROJECT/public/hot" ]; then
    rm -f "$PROJECT/public/hot"
    warn "Se borró public/hot, que es solo para desarrollo."
fi

fix_storage
for dir in storage/app/private storage/app/public storage/framework/cache/data storage/framework/sessions \
    storage/framework/testing storage/framework/views storage/framework/tmp storage/logs; do
    sudo -u "$APP_USER" -H mkdir -p "$PROJECT/$dir"
done
fix_storage
ok "storage: única carpeta donde PHP escribe (2770 / 660)"

chmod 640 "$PROJECT/.env"
ok ".env: 640, lo leen solo $DEPLOY_USER y $APP_USER"

# SQLite escribe el archivo y su journal en la misma carpeta
if [ "$DB_CONNECTION" = "sqlite" ]; then
    SQLITE_FILE="${DB_DATABASE:-$PROJECT/database/database.sqlite}"
    case "$SQLITE_FILE" in
        "$PROJECT"/*)
            chmod 2770 "$(dirname "$SQLITE_FILE")"
            [ ! -f "$SQLITE_FILE" ] || chmod 660 "$SQLITE_FILE"
            warn "La base es SQLite: PHP debe escribir en $(dirname "$SQLITE_FILE"). En producción usa MySQL o PostgreSQL."
            ;;
        *)
            warn "La base SQLite está fuera del proyecto y open_basedir la bloquea: $SQLITE_FILE"
            ;;
    esac
fi

if [ -L "$PROJECT/public/storage" ]; then
    warn "public/storage existe, pero Nginx no puede entrar a storage. La app usa S3: borra ese enlace."
fi

# =============================================================================
section "6. Caches de Laravel"
# =============================================================================

# Corre como DEPLOY_USER: bootstrap/cache/config.php guarda las claves de la base y de S3,
# y PHP solo puede leerlo. Si PHP pudiera escribirlo, un hackeo sobreviviría a cada reinicio.
artisan() { (cd "$PROJECT" && sudo -u "$DEPLOY_USER" -H "$PHP_BIN" artisan "$@"); }

if [ -z "$(env_value APP_KEY)" ]; then
    NEW_APP_KEY="$(artisan key:generate --show --no-interaction)"
    [[ "$NEW_APP_KEY" == base64:* ]] || die "No se pudo generar APP_KEY."
    write_env APP_KEY "$NEW_APP_KEY"
    unset NEW_APP_KEY
    ok "APP_KEY generada"
fi

if artisan optimize:clear --no-interaction >/dev/null 2>&1; then
    ok "Caches limpias"
else
    warn "optimize:clear falló: revisa la base de datos (CACHE_STORE=database necesita sus tablas)."
fi
if artisan optimize --no-interaction >/dev/null 2>&1; then
    ok "Config, rutas, eventos y vistas cacheados"
else
    warn "optimize falló: corre 'sudo -u $DEPLOY_USER $PHP_BIN artisan optimize' para ver el motivo."
fi

PENDING="$(artisan migrate:status --no-interaction 2>/dev/null | grep -c Pending || true)"
if [ "${PENDING:-0}" -gt 0 ]; then
    warn "$PENDING migraciones pendientes. Corre: sudo -u $DEPLOY_USER $PHP_BIN artisan migrate --force"
fi

sudo -u "$DEPLOY_USER" -H find "$PROJECT/bootstrap/cache" -type f -exec chmod 640 {} +
fix_storage

# =============================================================================
section "7. Aplicar cambios"
# =============================================================================

FPM_RELOADED=true
systemctl reload "$FPM_SERVICE"
for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ -S "$SOCKET" ] && break
    sleep 1
done
[ -S "$SOCKET" ] || { systemctl restart "$FPM_SERVICE"; sleep 2; }
[ -S "$SOCKET" ] || die "No apareció el socket $SOCKET. Revisa: journalctl -u $FPM_SERVICE"
ok "$FPM_SERVICE recargado"

systemctl reload nginx
CONFIG_PENDING=false
ok "Nginx recargado"

# =============================================================================
section "8. Verificación"
# =============================================================================

can()    { sudo -u "$1" test "$2" "$3"; }
cannot() { ! can "$@"; }
check()  {
    local label="$1"
    shift
    if "$@"; then ok "$label"; else warn "FALLO: $label"; fi
}

check "Nginx puede leer public/index.php"             can "$NGINX_USER" -r "$PROJECT/public/index.php"
check "PHP puede leer .env"                           can "$APP_USER" -r "$PROJECT/.env"
check "PHP puede escribir vistas compiladas"          can "$APP_USER" -w "$PROJECT/storage/framework/views"
check "PHP NO puede modificar .env"                   cannot "$APP_USER" -w "$PROJECT/.env"
check "PHP NO puede crear archivos en public/"        cannot "$APP_USER" -w "$PROJECT/public"
check "PHP NO puede modificar app/"                   cannot "$APP_USER" -w "$PROJECT/app"
check "PHP NO puede modificar bootstrap/cache"        cannot "$APP_USER" -w "$PROJECT/bootstrap/cache"
check "Otros proyectos NO pueden leer .env"           cannot "$NGINX_USER" -r "$PROJECT/.env"
check "Otros proyectos NO pueden leer config cacheada" cannot "$NGINX_USER" -r "$PROJECT/bootstrap/cache/config.php"

SCHEME="$URL_SCHEME"
PORT=80
# Si el certificado lo pone un proxy, el servidor puede escuchar solo en el 80
if [ "$SCHEME" = "https" ] && grep -Eq '^[[:space:]]*listen[[:space:]].*443' "$NGINX_PATH"; then
    PORT=443
else
    SCHEME=http
fi

status_of() {
    curl -ks -o /dev/null -w '%{http_code}' --max-time 15 \
        --resolve "$HOST:$PORT:127.0.0.1" "$SCHEME://$HOST$1" || true
}

# La recarga de Nginx es asíncrona: los workers viejos tardan un momento en salir
CODE=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
    CODE="$(status_of /up)"
    [ "$CODE" != "200" ] || break
    sleep 1
done
if [ "$CODE" = "200" ]; then
    ok "/up responde 200"
else
    warn "/up responde $CODE. Revisa: sudo tail -n 50 $PROJECT/storage/logs/laravel.log"
    warn "Para volver atrás: cp $BACKUP_DIR/nginx.conf $NGINX_PATH"
fi

# /up no carga la página: un build viejo da 200 aquí y 500 en la portada
for path in / /login; do
    CODE="$(status_of "$path")"
    if [ "$CODE" = "200" ]; then
        ok "$path responde 200"
    else
        warn "$path responde $CODE. Si dice 'Vite manifest', corre npm ci && npm run build."
    fi
done

paths=(/.env /.env.example /.git/config /composer.json /composer.lock /artisan /GUIA.md /hot
    /vendor/autoload.php /storage/logs/laravel.log /index.php/login)
[ "$ALLOW_REGISTER" = "1" ] || paths+=(/register /index.php/register)
for path in "${paths[@]}"; do
    CODE="$(status_of "$path")"
    case "$CODE" in
        403|404) ok "$path bloqueado ($CODE)" ;;
        *) warn "$path responde $CODE" ;;
    esac
done

# Host falso: debe cortarse, nunca responder con la aplicación
CODE="$(curl -ks -o /dev/null -w '%{http_code}' --max-time 15 --resolve "$HOST:$PORT:127.0.0.1" \
    -H 'Host: atacante.example' "$SCHEME://$HOST/login" || true)"
case "$CODE" in
    000|400|403|404|421) ok "Host falso rechazado ($CODE)" ;;
    *) warn "Un Host falso responde $CODE: los enlaces de recuperar contraseña se pueden envenenar." ;;
esac

# Un archivo que no existe siempre da 404, aunque el bloqueo no funcione.
# Por eso se crea un script real en public/ y se comprueba que no se ejecute.
PROBE_TOKEN="$(openssl rand -hex 16)"
PROBE_NAME="hardening-probe-$(openssl rand -hex 6).php"
PROBE_FILE="$PROJECT/public/$PROBE_NAME"
printf '<?php echo "%s";\n' "$PROBE_TOKEN" > "$PROBE_FILE"
chmod 644 "$PROBE_FILE"
PROBE_BODY="$(curl -ks --max-time 15 --resolve "$HOST:$PORT:127.0.0.1" "$SCHEME://$HOST/$PROBE_NAME" || true)"
rm -f -- "$PROBE_FILE"
PROBE_FILE=""
if grep -Fq "$PROBE_TOKEN" <<< "$PROBE_BODY"; then
    echo -e "${RED}${BOLD}  !! Un .php fuera de index.php se ejecutó o se descargó. Revisa $NGINX_CONF YA.${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    ok "Un script plantado en public/ no se ejecuta"
fi

# Los seeders crean cuentas con la contraseña 'password' (admin@admin.com, regente, cajero...)
DEFAULT_USERS="$(cd "$PROJECT" && sudo -u "$APP_USER" -H "$PHP_BIN" -r '
    require "vendor/autoload.php";
    $app = require "bootstrap/app.php";
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    $weak = [];
    foreach (App\Models\User::query()->limit(1000)->cursor() as $user) {
        if (Illuminate\Support\Facades\Hash::check("password", $user->password)) {
            $weak[] = $user->email;
        }
    }
    echo "CHECKED:".implode(", ", $weak);
' 2>/dev/null | clean || true)"
case "$DEFAULT_USERS" in
    *CHECKED:)
        ok "Ningún usuario usa la contraseña por defecto"
        ;;
    *CHECKED:*)
        echo -e "${RED}${BOLD}  !! Usuarios con la contraseña 'password': ${DEFAULT_USERS##*CHECKED:}. Cámbialas YA.${NC}"
        WARNINGS=$((WARNINGS + 1))
        ;;
    *)
        warn "No se pudieron comprobar las contraseñas de los usuarios. Revísalas a mano."
        ;;
esac

# StorageController guarda las imágenes en .avif: sin esta función, toda subida falla
if ! (cd / && "$PHP_BIN" -r 'exit(function_exists("imageavif") ? 0 : 1);'); then
    warn "PHP $PHP_V no tiene AVIF (imageavif): las imágenes de productos y usuarios no se van a poder subir."
fi

# Otro proyecto que corra como el usuario de Nginx puede hablar con el socket de este pool
OTHER_POOLS="$(grep -lE "^[[:space:]]*user[[:space:]]*=[[:space:]]*$NGINX_USER[[:space:]]*$" /etc/php/*/fpm/pool.d/*.conf 2>/dev/null || true)"
if [ -n "$OTHER_POOLS" ]; then
    warn "Estos pools corren como $NGINX_USER. Si hackean un sitio en ellos, puede usar el socket de SIVEFARMA, anular open_basedir y leer su .env. Si no se usan, bórralos; si se usan, dales usuario propio:"
    echo "$OTHER_POOLS" | clean
fi

if ss -ltnH 2>/dev/null | awk '{ print $4 }' | grep -Eq '^(0\.0\.0\.0|\*|\[::\]):(3306|5432)$'; then
    warn "La base de datos escucha en todas las interfaces. Déjala en 127.0.0.1 o ciérrala en el firewall."
fi

if command -v composer &>/dev/null; then
    if (cd "$PROJECT" && sudo -u "$DEPLOY_USER" -H timeout 90 composer audit --locked --no-dev --format=summary >/dev/null 2>&1); then
        ok "composer audit sin vulnerabilidades conocidas"
    else
        warn "composer audit reporta problemas. Corre: composer audit"
    fi
fi

# =============================================================================
section "9. Búsqueda de archivos sospechosos"
# =============================================================================

SUSPICIOUS="$(find "$PROJECT/public" "$PROJECT/storage" -type f \
    \( -iname '*.php' -o -iname '*.phtml' -o -iname '*.phar' -o -iname '.user.ini' \) \
    ! -path "$PROJECT/public/index.php" ! -path "$PROJECT/storage/framework/views/*" 2>/dev/null || true)"
if [ -z "$SUSPICIOUS" ]; then
    ok "Sin scripts en public/ ni storage/"
else
    warn "Scripts donde no debería haberlos. Revísalos:"
    echo "$SUSPICIOUS" | clean
fi

PATTERN='eval\(base64_decode|eval\(\$_|assert\(\$_|(system|exec|passthru|shell_exec)\(\$_|FilesMan|c99shell|r57shell'
SHELLS="$(grep -rlE "$PATTERN" "$PROJECT/app" "$PROJECT/bootstrap/app.php" "$PROJECT/config" "$PROJECT/routes" "$PROJECT/public" "$PROJECT/storage/app" --include='*.php' 2>/dev/null || true)"
if [ -z "$SHELLS" ]; then
    ok "Sin patrones de webshell"
else
    warn "Patrones de webshell encontrados:"
    echo "$SHELLS" | clean
fi

WORLD_WRITABLE="$(find "$PROJECT" -path "$PROJECT/node_modules" -prune -o -type f -perm -o+w -print 2>/dev/null || true)"
if [ -z "$WORLD_WRITABLE" ]; then
    ok "Sin archivos escribibles por cualquiera"
else
    warn "Archivos escribibles por cualquiera:"
    echo "$WORLD_WRITABLE" | clean
fi

# =============================================================================
echo ""
if [ "$WARNINGS" -eq 0 ]; then
    echo -e "${BOLD}${GREEN}  Hardening completado sin advertencias.${NC}"
else
    echo -e "${BOLD}${YELLOW}  Hardening completado con $WARNINGS advertencia(s). Revísalas arriba.${NC}"
fi
echo ""
echo "  Backups:   $BACKUP_DIR"
echo "  Artisan:   sudo -u $DEPLOY_USER $PHP_BIN artisan <comando>"
echo "  Tras cada deploy vuelve a correr este script."
echo ""
