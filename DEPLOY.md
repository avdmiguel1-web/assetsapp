# FleetCore — Guía de Despliegue Completa

## Resumen del stack
- **Base de datos + Archivos**: Supabase (Postgres + Storage)
- **Web**: Vercel (deploy automático desde GitHub)
- **Android + iOS**: Capacitor

---

## PASO 1 — Supabase

### 1.1 Crear proyecto
1. Ve a https://supabase.com → **New project**
2. Nombre: `fleetcore` · Región: la más cercana (ej: `us-east-1`)
3. Anota: **Project URL** y **anon public key** (Settings → API)

### 1.2 Crear las tablas
1. Supabase → **SQL Editor** → **New query**
2. Pega el contenido de `supabase-schema.sql` y ejecuta (**Run**)
3. Verifica en **Table Editor** que aparecen: `assets`, `locations`, `transfers`

### 1.3 Crear el bucket de Storage
El SQL ya crea el bucket `fleetcore-files`. Verifica en:
**Storage** → debes ver `fleetcore-files` con acceso **Public**

### 1.4 Configura las variables de entorno locales
Copia `.env.example` a `.env`:
```bash
cp .env.example .env
```
Edita `.env` y pon tus valores reales:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_FLESPI_TOKEN=OWuoCjZ6...
VITE_FLESPI_DEVICE_ID=7813187
```

### 1.5 Prueba local
```bash
npm install
npm run dev
```
Abre http://localhost:5174 — registra un activo y verifica que aparece en Supabase Table Editor.

---

## PASO 2 — Vercel (web pública)

### 2.1 Subir el código a GitHub
```bash
# Dentro de la carpeta fleet-app:
git init
git add .
git commit -m "FleetCore v1.0"
# Crea un repo en github.com y luego:
git remote add origin https://github.com/trime25/gestionactivosgps.git
git push -u origin main
```


Solución al error de carga
1
Renombrar la rama local
Cambiar de 'master' a 'main'
GitHub utiliza main por defecto, pero las versiones locales de Git a veces inician con master. Ejecuta este comando para renombrarla:

Bash
git branch -M main
2
Vincular y subir los archivos
Empujar los cambios al repositorio remoto
Ahora que tu rama local coincide con el nombre que espera GitHub, intenta subir de nuevo:

Bash
git push -u origin main


### 2.2 Conectar con Vercel
1. Ve a https://vercel.com → **Add New Project**
2. Importa el repo de GitHub que acabas de crear
3. Framework: **Vite** (Vercel lo detecta automático)
4. Build command: `npm run build`
5. Output directory: `dist`

### 2.3 Variables de entorno en Vercel
En Vercel → proyecto → **Settings** → **Environment Variables**, agrega:
```
VITE_SUPABASE_URL        = https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY   = eyJhbG...
VITE_FLESPI_TOKEN        = OWuoCjZ6...
VITE_FLESPI_DEVICE_ID    = 7813187
```
Marca todas como **Production + Preview + Development**.

### 2.4 Deploy
Click **Deploy** — Vercel te da una URL como `https://fleetcore-abc123.vercel.app`

Cada vez que hagas `git push`, Vercel re-deploya automáticamente.

### 2.5 Dominio personalizado (opcional)
Vercel → Settings → Domains → agrega tu dominio (ej: `app.tgsiat.com`)

---

## PASO 3 — Capacitor (Android + iOS)

### Requisitos previos
- **Android**: Android Studio instalado (https://developer.android.com/studio)
- **iOS**: Mac con Xcode instalado (solo en macOS)
- **Node.js** 18+

### 3.1 Instalar dependencias y inicializar Capacitor
```bash
npm install
npx cap init FleetCore com.tgsiat.fleetcore --web-dir dist
```

### 3.2 Build de la app web
```bash
npm run build
```

### 3.3 Android
```bash
npm install @capacitor/android
npx cap add android
npx cap sync android
npx cap open android
```
En Android Studio:
- Espera que Gradle sincronice (~2 min la primera vez)
- **Run** → selecciona emulador o dispositivo físico
- Para generar APK de producción: **Build → Generate Signed Bundle/APK**

### 3.4 iOS (solo en Mac)
```bash
npm install @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios
```
En Xcode:
- Selecciona tu dispositivo o simulador
- **Product → Run**
- Para publicar en App Store: necesitas cuenta de Apple Developer ($99/año)

### 3.5 Actualizar la app (cada cambio)
```bash
npm run cap:sync
# Luego en Android Studio o Xcode: Run
```

### 3.6 Nota sobre Flespi en móvil
En la app nativa, el proxy de Vite no está disponible.  
El `flespiService.js` ya detecta esto automáticamente (`import.meta.env.DEV`)  
y hace las llamadas directamente a `flespi.io` con el token en el header.

---

## Flujo de trabajo recomendado

```
Cambio de código
    │
    ├─► git push ──► Vercel re-deploya automáticamente (web)
    │
    └─► npm run cap:sync ──► Abrir Android Studio / Xcode ──► Probar en dispositivo
```

## Estructura de archivos clave

```
fleet-app/
├── .env                    ← tus credenciales (NO subir a git)
├── .env.example            ← plantilla para el equipo
├── .gitignore              ← excluye .env, node_modules, android/, ios/
├── vercel.json             ← config de rutas para Vercel
├── capacitor.config.ts     ← config de la app nativa
├── supabase-schema.sql     ← ejecutar una sola vez en Supabase
└── src/
    ├── lib/
    │   ├── supabase.js     ← cliente Supabase (lee env vars)
    │   ├── db.js           ← CRUD completo (assets, locations, transfers)
    │   └── storage.js      ← upload/download de archivos
    └── stores/
        └── AppContext.jsx  ← estado global con sync a Supabase
```
