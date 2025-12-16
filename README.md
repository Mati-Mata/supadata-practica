# SupaData Demo (supadata-practica)

Pequeña app web que consume la API de **SupaData** para:
- Transcribir videos (endpoint `/transcript`)
- Leer contenido de páginas web en Markdown (endpoint `/web/scrape`)

## Estructura
- `server/` → proxy en Node/Express (guarda la API key aquí)
- `app-web/` → frontend con Vite + React

## API elegida: SupaData
- Base URL: `https://api.supadata.ai/v1`
- Auth: header `x-api-key: TU_API_KEY`
- Endpoints usados: `/transcript`, `/web/scrape`
- **No expongo la API key en el navegador**: va en `server/.env`

## Variables de entorno
En `server/.env`:
SUPADATA_API_KEY=tu_api_key_aqui
PORT=3000

En `app-web/.env`:
VITE_SERVER_URL=http://localhost:3000


## Cómo correr en dev
1) Backend (proxy):
```cd server
npm install
npm start```
2) Frontend:
cd app-web
npm install
npm run dev

markdown
Copy code
- Frontend: http://localhost:5173
- Proxy: http://localhost:3000

## Rutas del proxy
- `GET /api/transcript?url=...&mode=native&text=true`
- `GET /api/scrape?url=...`

## Demo
- Transcripción: pega una URL de YouTube/TikTok/Instagram/X.
- Leer Web: pega la URL de una página y muestra el Markdown.

## Notas
- No subir `server/.env` al repositorio.
- La clave puede cambiarse/regenerarse si es necesario.