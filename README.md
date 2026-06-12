# Mundial Predictor 2026 ⚽📊

Herramienta **de uso personal** que, durante el Mundial 2026 (11 jun – 19 jul),
analiza los partidos de cada día y calcula con un modelo estadístico la
probabilidad de cada mercado (1X2, más córners, más disparos), destacando **el de
mayor probabilidad** de cada partido.

> No es un producto comercial: sin login, sin pagos, despliegue local. El modelo
> da **estimaciones, no certezas** — el fútbol (y más un torneo de selecciones)
> tiene mucha varianza. **Nada de dinero real** (ver [Aviso legal](#aviso-legal)).

---

## Stack

- **Next.js 16** (App Router) + React + TypeScript
- **Tailwind CSS v4**
- **Supabase** (Postgres) — RLS con lectura pública; escritura solo desde backend
- Fuente de datos (configurable con `DATA_SOURCE`): **openfootball** o **API-Football**
- Tests con **Vitest**

## Fuentes de datos

| Fuente | `DATA_SOURCE` | Coste | Mundial 2026 | Mercados |
| --- | --- | --- | --- | --- |
| **openfootball** (worldcup.json) | `openfootball` | Gratis, sin clave ni límites | ✅ | Solo **1X2** (no hay córners/disparos) |
| **API-Football** (api-sports.io) | `apifootball` | Free 100 req/día; **2026 de pago** | ⚠️ pago | 1X2 + **córners** + **disparos** |

Cuando la fuente no trae córners/disparos, esos mercados **se desactivan solos** y
el modelo predice únicamente el 1X2. Con API-Football y plan de pago tendrías los
tres mercados completos.

---

## Requisitos previos

1. **Node.js 20 o superior** (incluye npm). Descárgalo de
   [nodejs.org](https://nodejs.org) o `winget install OpenJS.NodeJS.LTS`.
2. Una cuenta de **Supabase** (gratuita) con un proyecto creado.
3. Una clave de **API-Football** (plan gratuito: 100 req/día).

---

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
#   y rellena: API_FOOTBALL_KEY, SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY

# 3. Crear las tablas en Supabase
#   Abre el SQL Editor de tu proyecto y pega el contenido de supabase/schema.sql

# 4. Comprobar que el modelo funciona
npm test          # debe pasar la verificación de que 1X2 suma ~100%

# 5. Arrancar en local
npm run dev       # http://localhost:3000
```

El dashboard arranca con **datos de ejemplo** (mock). Para consumir el endpoint
real cambia `USE_MOCK = false` en [`app/page.tsx`](app/page.tsx).

### Consultarlo desde el móvil (misma red local)

Arranca con `npm run dev -- -H 0.0.0.0` y entra desde el móvil a
`http://<IP-de-tu-PC>:3000` (mira tu IP con `ipconfig`).

---

## Procedimiento del 11 de junio (día del primer partido)

Antes de la jornada 1 ningún equipo ha jugado en el torneo, así que el modelo se
apoya en el **seeding pre-torneo** (Elo + datos de clasificación). Pasos:

1. **Ingesta inicial** (equipos + calendario):
   ```bash
   npm run ingest
   ```

2. **Rellena los ratings.** Edita [`lib/teamRatings.ts`](lib/teamRatings.ts):
   - El `name` debe coincidir **exactamente** con `teams.name` ya ingestado (el
     seeding los cruza por nombre; no hace falta id manual).
   - Actualiza el `elo` desde [eloratings.net](https://eloratings.net) (los
     valores incluidos son orientativos).
   - Opcional: añade en `qual` las medias de goles a favor/en contra de la
     clasificación. Si lo dejas en `null`, se usa solo el Elo.

3. **Siembra la fuerza inicial:**
   ```bash
   npm run seed       # cruza ratings↔equipos por nombre y escribe seed_attack/seed_defense
   ```
   Si alguna selección no cruza, el script avisa con su nombre para que lo ajustes.

4. **Arranca la app** (`npm run dev`) y abre el dashboard del día. Ya tienes
   predicciones para los primeros partidos basadas en el seeding.

A medida que se juegan partidos, el peso del seeding **decae linealmente** y a los
~3 partidos por selección el modelo vive de datos reales del torneo
(ver `seedWeight` en [`lib/strength.ts`](lib/strength.ts)).

---

## Día a día durante el torneo

Ejecuta la ingesta periódicamente (idealmente con un cron, p. ej. cada pocas
horas) para traer resultados y estadísticas de los partidos finalizados:

```bash
npm run ingest
```

Esto descarga córners/disparos/posesión de los partidos `FT` y recalcula
`team_stats`. Como la cuota gratuita es de 100 req/día, el script solo pide
estadísticas de los partidos que aún no tiene. Para el torneo completo quizá
necesites el tier de pago de API-Football.

---

## Endpoints

| Endpoint | Descripción |
| --- | --- |
| `GET /api/predict?fixture=<id>` | Predicción de un partido concreto. |
| `GET /api/predict/day?date=YYYY-MM-DD` | Todos los partidos del día (por defecto hoy), ordenados de mayor a menor confianza, con `bestBetOfDay`. |

Toda respuesta incluye un `disclaimer` recordando que son estimaciones de alta
varianza.

---

## El modelo (resumen)

**Poisson ajustado.** Cada equipo tiene una fuerza de ataque y defensa relativas
a la media de la competición:

```
fuerza_ataque  = media_goles_a_favor_equipo  / media_goles_competición
fuerza_defensa = media_goles_en_contra_rival / media_goles_competición
lambda         = fuerza_ataque · fuerza_defensa · media_goles_competición
```

Con las lambdas de ambos equipos se construye la matriz de marcadores (producto
de dos Poisson, truncada a 10 goles) y de ahí salen P(victoria local), P(empate),
P(victoria visitante). El mismo procedimiento se aplica a **córners** y
**disparos**. Se elige el mercado de mayor probabilidad como "apuesta más sólida".
Detalle en [`lib/poissonModel.ts`](lib/poissonModel.ts).

**Ajustes para mejorar la precisión:**

- **Elo reales** de [eloratings.net](https://eloratings.net) ([`lib/teamRatings.ts`](lib/teamRatings.ts)):
  en la fase de grupos, con pocos partidos jugados, la predicción depende casi por
  completo del Elo, así que su calidad es la palanca principal.
- **Ventaja de campo solo para los anfitriones** (USA, Canadá, México). El resto
  de partidos del Mundial son en campo neutral; aplicar ventaja a todos sesgaría
  las predicciones. Ver `HOST_TEAMS` en [`lib/predict.ts`](lib/predict.ts).
- **Corrección de Dixon-Coles** (`DEFAULT_RHO`): el Poisson independiente
  infravalora los empates de pocos goles (0-0, 1-1), frecuentes en selecciones; la
  corrección los ajusta y mejora la calibración del 1X2.

### Capa ML (no implementada, a propósito)

Una capa **XGBoost** sobre el baseline Poisson *podría* mejorar las predicciones
**cuando haya histórico real acumulado** (features: forma reciente, descanso,
viaje, xG, etc.). No se construye ahora porque para uso personal el Poisson
sembrado es suficiente y un modelo de ML con pocos datos rinde **peor** que un
baseline bien calibrado. Queda como mejora futura si se acumulan varias ediciones.

---

## Tests

```bash
npm test          # ejecución única
npm run test:watch
```

Incluye la verificación obligatoria de que las probabilidades de 1X2 suman ~100%,
además de simetría, monotonía y rangos.

---

## Solución de problemas

- **`npm install` falla con `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.** Tu red o antivirus
  inspecciona el tráfico TLS. Solución usada en este proyecto: que Node use el
  almacén de certificados de Windows. Los scripts de `package.json` ya incluyen
  `NODE_OPTIONS=--use-system-ca` (vía `cross-env`). Para `npm install` en sí,
  ejecútalo una vez así:
  ```powershell
  $env:NODE_OPTIONS = "--use-system-ca"; npm install
  ```

- **Aviso "multiple lockfiles / inferred workspace root".** Hay un
  `package-lock.json` suelto en tu carpeta de usuario. Ya lo neutralizamos fijando
  `turbopack.root` en [`next.config.ts`](next.config.ts); si quieres, borra ese
  fichero suelto.

- **`node` no se reconoce en la terminal.** Está instalado en
  `C:\Program Files\nodejs`. Abre una terminal nueva tras instalar Node, o añade
  esa ruta al PATH.

## Aviso legal

Esta app es una **herramienta de análisis**, no de apuestas. Convertir estas
estimaciones en apuestas con dinero real entraría en la regulación de juego
(DGOJ en España). Mantenla como lo que es: un experimento estadístico personal.
