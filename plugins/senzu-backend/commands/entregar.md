---
description: Entrega al cliente — manual de uso, servicios y accesos, mantenimiento, cómo pedir cambios y formación
---

Uso: `/entregar [proyecto o cliente]` — el argumento es opcional.

Aplica `deploy-ops §references/entrega-cliente.md` al proyecto actual:

1. Comprueba lo previo: `/lanzar` en APTA, último deploy verificado y backups con un restore probado.
   Si falta algo, dilo y para.
2. Pregunta al usuario las tareas que hará el cliente en el panel (publicar, cambiar precios, ver
   formularios…) y quién gestiona cada servicio.
3. Escribe en `docs/entrega/`: manual de uso (solo sus tareas, paso a paso), servicios y accesos (tabla
   con proveedor, titular, renovación y coste; nunca contraseñas, solo dónde están), mantenimiento
   (actualizaciones, renovaciones, backups y garantía) y cómo pedir cambios.
4. Resume en una página lo que recibe el cliente y lo que queda pendiente, y apúntalo en el devlog.
