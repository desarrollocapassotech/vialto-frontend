# Instrucciones para GitHub Copilot — Vialto frontend

## Multi-tenant (obligatorio)

Este frontend es multi-tenant. El aislamiento entre empresas lo garantiza el **backend**
a partir del token de Clerk; el frontend solo manda el token y muestra lo que recibe.

Las reglas completas están en un **único archivo fuente**:

**`docs/reglas-multitenant.md`** — leelo y seguilo antes de crear llamadas a la API o
manejar datos de empresa.

> Nota: Copilot no importa archivos automáticamente. Este archivo apunta al fuente a
> propósito para no duplicar contenido. No copies las reglas acá: se mantienen en un solo
> lugar.

Resumen mínimo (el detalle está en el fuente):
- Toda llamada a la API va con el token de Clerk (`getToken()`).
- Nunca mandes `tenantId` desde el cliente para seguridad; en rutas normales el backend lo ignora.
- El `tenantId` en la URL solo existe en pantallas de superadmin (rutas `/api/platform/...`).
- No filtres por empresa en el cliente ni leas campos `metadata` crudos.
