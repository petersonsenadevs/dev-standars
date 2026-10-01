# Archivos y media: uploads seguros, S3/R2, imágenes y descargas

Índice: 1 Upload seguro (checklist) · 2 Dónde guardar (disco vs S3/R2) · 3 Imágenes en servidor ·
4 Servir y descargar (URLs firmadas, streaming) · 5 Por stack · 6 Errores típicos

## 1. Upload seguro — checklist innegociable
- **Lista blanca de tipos** por CONTENIDO real (magic bytes / librería del framework), no por extensión ni
  por el `Content-Type` que declara el cliente (miente).
- Límite de tamaño en DOS capas: servidor web (nginx `client_max_body_size`, PHP `upload_max_filesize`)
  y validación de la app (mensaje claro al usuario).
- **Renombra SIEMPRE**: nombre aleatorio (uuid) + extensión derivada del tipo real; el nombre original solo
  como metadato en BD. Nada de rutas construidas con input del usuario (path traversal).
- Guardar FUERA del webroot (o en bucket): un `.php`/`.svg` subido no debe poder ejecutarse/servirse como tal.
  SVG de usuarios: sanitizar (scripts dentro) o convertir a PNG.
- Antivirus (clamav) solo si el negocio lo exige (archivos que otros usuarios descargan).

## 2. Dónde guardar: disco local vs S3/R2
- **Disco local**: OK para 1 servidor, poco volumen y backups que lo incluyan. Deja de valer con: 2+
  instancias, contenedores efímeros, o gigas que engordan el VPS.
- **S3/R2 (o compatible: MinIO en dev)**: por defecto en cuanto hay producción seria. R2 (Cloudflare) sin
  coste de egreso = ideal para media pública. Config por entorno (local en dev, bucket en prod) vía el
  sistema de discos/storage del framework — el código no sabe dónde vive el archivo.
- La ruta/key en BD, nunca la URL completa hardcodeada (el dominio del bucket cambia).
- Borrado: al eliminar el registro, job que borra el archivo (o soft-delete + limpieza programada). Huérfanos
  = dinero y RGPD.

## 3. Imágenes en servidor
- Al subir: genera los tamaños que la web usa (thumb/medium/large) en un JOB (no en el request), a WebP/AVIF
  + original. Herramientas: Intervention/Glide (PHP), sharp (Node), Pillow (Python).
- O delega: transformaciones on-the-fly con caché (Cloudflare Images, imgproxy, Glide server) cuando hay
  muchos tamaños o diseño cambiante.
- Guarda width/height en BD (evita CLS al pintar), y quita metadatos EXIF (GPS = dato personal).

## 4. Servir y descargar
- Público (media de la web): URL directa del bucket/CDN con caché larga e inmutable (nombre con hash).
- **Privado (facturas, adjuntos): URL firmada temporal** (S3 presigned / rutas firmadas del framework,
  15 min) tras comprobar autorización — NUNCA un endpoint que lee cualquier ruta por parámetro.
- Subida grande: presigned upload DIRECTO del navegador al bucket (el servidor solo firma y registra) —
  no pases 500 MB por tu app.
- Descarga desde la app solo si añade valor (contador, zip al vuelo): entonces streaming
  (`streamDownload`, `StreamingResponse`), jamás cargar el archivo entero en memoria.

## 5. Por stack (el camino idiomático)
- **Laravel**: `Storage` disks + `store()`/`putFileAs`, validación `File::types()->max()`, `temporaryUrl()`,
  Media Library (spatie) si hay conversiones/colecciones.
- **Node/Nest**: multer con `fileFilter`+`limits` (o presigned directo), sharp en worker, `@aws-sdk/s3-request-presigner`.
- **Next**: nada de archivos al filesystem de Vercel (efímero) — presigned a S3/R2 o UploadThing.
- **FastAPI**: `UploadFile` (spooled), validar con `python-magic`, boto3 presigned.
- **WordPress**: `wp_handle_upload` + offload a S3 con plugin si hay volumen.

## 6. Errores típicos del agente
- Validar por extensión/mime del cliente · conservar el nombre original como ruta · subir dentro de `public/`.
- Redimensionar en el request (timeout con 10 fotos) · sin límite de tamaño en nginx (413 misterioso o DoS).
- Endpoint `download?path=...` que sirve cualquier archivo · URLs firmadas sin comprobar autorización antes.
- Archivos en el contenedor/instancia efímera y "desaparecen al desplegar".
- Olvidar la limpieza de huérfanos y el borrado en cascada (RGPD: "borra mi cuenta" incluye sus archivos).
