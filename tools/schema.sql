-- Base de datos del panel de Cuadros Finos (Cloudflare D1 / SQLite)
-- Aplicar:  npx wrangler d1 execute cuadrosfinos --remote --file tools/schema.sql

CREATE TABLE IF NOT EXISTS pedidos (
  codigo        TEXT PRIMARY KEY,            -- CF-XXXX (el mismo del mensaje de WhatsApp)
  creado        TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado   TEXT NOT NULL DEFAULT (datetime('now')),
  estado        TEXT NOT NULL DEFAULT 'nuevo', -- nuevo, confirmado, pagado, produccion, listo, enviado, entregado, cancelado
  via           TEXT,                        -- seleccion | ficha | cotizar | panel
  items         TEXT NOT NULL,               -- JSON [{s, n, qty, precio, f:[[campo, valor]]}]
  piezas        INTEGER NOT NULL DEFAULT 1,
  total         REAL NOT NULL DEFAULT 0,     -- S/ estimado al enviar
  total_final   REAL,                        -- S/ cobrado (lo pone el panel)
  lugar         TEXT,                        -- distrito / ciudad que escribió el cliente
  pago          TEXT,
  regalo        INTEGER NOT NULL DEFAULT 0,
  fuente        TEXT, medio TEXT, campana TEXT, origen TEXT,   -- atribución (UTM / referencia)
  region        TEXT,                        -- región aproximada de la visita (Cloudflare)
  cliente       TEXT, telefono TEXT, direccion TEXT, notas TEXT,
  envio_tipo    TEXT,                        -- lima | provincia | recojo
  agencia       TEXT, guia TEXT, costo_envio REAL,
  fecha_prometida TEXT, fecha_envio TEXT, fecha_entrega TEXT
);
CREATE INDEX IF NOT EXISTS pedidos_estado ON pedidos(estado, creado);
CREATE INDEX IF NOT EXISTS pedidos_creado ON pedidos(creado);

CREATE TABLE IF NOT EXISTS pedido_historial (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo  TEXT NOT NULL,
  fecha   TEXT NOT NULL DEFAULT (datetime('now')),
  usuario TEXT,
  accion  TEXT NOT NULL                       -- texto legible: «Estado: nuevo → pagado»
);
CREATE INDEX IF NOT EXISTS historial_codigo ON pedido_historial(codigo, fecha);

-- Eventos de la web (medición propia, sin cookies ni IP)
CREATE TABLE IF NOT EXISTS eventos (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha   TEXT NOT NULL DEFAULT (datetime('now')),
  nombre  TEXT NOT NULL,                      -- page_view, view_item, add_to_cart, generate_lead…
  slug    TEXT, valor REAL, termino TEXT,
  sesion  TEXT,                               -- id aleatorio por pestaña/día
  pagina  TEXT, fuente TEXT, medio TEXT, campana TEXT,
  disp    TEXT, region TEXT
);
CREATE INDEX IF NOT EXISTS eventos_fecha ON eventos(fecha, nombre);
CREATE INDEX IF NOT EXISTS eventos_slug ON eventos(slug, nombre);

CREATE TABLE IF NOT EXISTS usuarios (
  email   TEXT PRIMARY KEY,
  nombre  TEXT,
  hash    TEXT NOT NULL,                      -- PBKDF2-SHA256
  sal     TEXT NOT NULL,
  rol     TEXT NOT NULL DEFAULT 'admin',      -- admin | equipo
  creado  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS intentos (
  clave TEXT NOT NULL,                        -- ip+email (hash) para limitar intentos de ingreso
  fecha TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS intentos_clave ON intentos(clave, fecha);

-- Cuadros creados o modificados desde el panel (se suman al catálogo de la web)
CREATE TABLE IF NOT EXISTS productos (
  slug        TEXT PRIMARY KEY,
  datos       TEXT NOT NULL,                 -- JSON con el mismo formato del catálogo (s, c, u, n, f, a, o, t, nw, p, k…)
  estado      TEXT NOT NULL DEFAULT 'borrador', -- borrador | publicado | oculto
  base        INTEGER NOT NULL DEFAULT 0,    -- 1 = cambio sobre un cuadro que ya existe en la web
  creado      TEXT NOT NULL DEFAULT (datetime('now')),
  actualizado TEXT NOT NULL DEFAULT (datetime('now')),
  autor       TEXT
);
-- Imágenes subidas o generadas en el panel (servidas en /media/...)
CREATE TABLE IF NOT EXISTS media (
  clave   TEXT PRIMARY KEY,                  -- p. ej. puma-andino/obra.webp
  tipo    TEXT NOT NULL,                     -- image/webp | image/jpeg
  datos   BLOB NOT NULL,
  creado  TEXT NOT NULL DEFAULT (datetime('now'))
);
