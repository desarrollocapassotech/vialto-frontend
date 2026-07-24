# Reglas multi-tenant (frontend)

> **Este es el ÚNICO archivo fuente de estas reglas en el frontend.**
> `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/multitenant.mdc` y
> `.github/copilot-instructions.md` apuntan acá. Si hay que cambiar algo, se cambia
> SOLO en este archivo.
>
> El aislamiento entre empresas se garantiza en el **backend** (filtrando toda consulta
> por `tenantId`). El frontend no consulta la base directamente, así que acá las reglas
> son de **higiene**: no confiar en datos de empresa del lado del cliente y no filtrar
> por empresa "a mano".

---

## Por qué existe esto

Vialto es multi-tenant: muchas empresas usan la misma app. El backend es el que decide,
a partir del token de sesión (Clerk), qué datos ve cada empresa. El frontend solo pide
datos a la API con el token; **no** es el responsable de la seguridad del aislamiento.
Por eso la regla de oro acá es simple:

> **El frontend nunca decide de qué empresa son los datos. Eso lo hace el backend con el
> token. El frontend solo manda el token y muestra lo que recibe.**

---

## Las reglas

1. **Toda llamada a la API va con el token de Clerk.** Se obtiene con `getToken()` y se
   manda en el header `Authorization`. El backend saca de ahí la empresa. Sin token, no
   hay contexto de empresa.

2. **Nunca mandes `tenantId` desde el cliente para seguridad.** En las pantallas de
   **usuario normal**, no agregues `?tenantId=...` ni lo pongas en el body. El backend lo
   ignora en esas rutas y solo confunde (y tienta a alguien a "conectarlo" mal después).

3. **El `tenantId` en la URL SOLO existe en las pantallas de superadmin.** Las rutas
   `/api/platform/...` son el panel cross-empresa del superadmin: ahí sí se elige la
   empresa por query param, porque el backend lo valida contra el rol superadmin. Si estás
   en una pantalla de empresa normal y sentís que necesitás mandar el `tenantId`, está mal.

4. **No filtres datos por empresa en el frontend.** No traigas "todo" y filtres por
   `tenantId` en el cliente: eso significa que el backend te devolvió de más. Los listados
   ya vienen alcanzados por empresa desde la API.

5. **No leas campos `metadata` crudos del backend.** El backend expone los campos tipados
   que correspondan a cada empresa; el frontend no interpreta `metadata` por su cuenta.

---

## Antes de dar por buena una llamada a la API, chequear:

- [ ] ¿Manda el token de Clerk (`getToken()`)?
- [ ] Si NO es pantalla de superadmin: ¿está libre de `tenantId` en URL o body?
- [ ] Si ES pantalla de superadmin: ¿usa una ruta `/api/platform/...`?
- [ ] ¿Muestra directamente lo que devuelve la API, sin filtrar por empresa a mano?

---

## Deuda conocida a limpiar

- El autocompletado de lotes de stock (`LoteDatalistInput` / `buildUrl`) agrega
  `?tenantId=...` al pegarle a `lotes/historico`, que es una ruta de usuario normal. El
  backend **ignora** ese parámetro (usa el token), así que es un parámetro muerto. Sacarlo
  para que nadie lo "conecte" mal en el futuro.
