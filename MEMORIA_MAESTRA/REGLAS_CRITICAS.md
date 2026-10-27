# MEMORIA MAESTRA — REGLAS CRÍTICAS DE GULIN

> **OBJETIVO**: Este archivo es la ÚNICA fuente de verdad operativa.
> Cualquier sesión nueva DEBE leerlo antes de tocar código.
> Si una regla se rompe, se corrige ACÁ, no en otro lado.

**Última actualización**: sesión actual
**Mantenedor**: usuario lordzero1 + agente
**Estado**: EN CONSTRUCCIÓN — no completo, pero arranca con lo crítico

---

## 🚨 REGLAS QUE NUNCA SE PUEDEN ROMPER

### R001 — AWR de Oracle pide 5 inputs, NO 6
- **Acción**: ejecutar `AWR Report` con begin_snap_id, end_snap_id, db_id, instance_number, dbid_dur
- **Prohibido**: pedir dbid_dur como obligatorio (ya viene en el request)
- **Violación vista**: el agente pide el input extra y bloquea la ejecución
- **Fix**: si el usuario pasa 4 inputs, completar el 5to automáticamente desde la sesión

### R002 — No inventar output de herramientas
- **Acción**: si una tool no devuelve nada, decirlo. NO inventar tablas ni resultados.
- **Prohibido**: simular que un query devolvió filas cuando no devolvió.
- **Violación vista**: tool `db_query` devuelve error y el agente igual muestra una tabla

### R003 — No ejecutar comandos destructivos sin confirmación
- **Acción**: pedir confirmación explícita antes de `rm -rf`, `DROP TABLE`, `DELETE`, `TRUNCATE`, `kubectl delete`
- **Prohibido**: ejecutarlos aunque parezcan "seguros"

### R004 — Memoria de sesión: leer archivos críticos al inicio
- **Archivos a leer al arrancar**:
  1. `/Users/lordzero1/IA_LoRdZeRo/Gulin_Agent/gulin-term/MEMORIA_MAESTRA/REGLAS_CRITICAS.md` (este archivo)
  2. `/Users/lordzero1/IA_LoRdZeRo/Gulin_Agent/gulin-term/MEMORIA_MAESTRA/BACKLOG_REAL.md`
  3. `/Users/lordzero1/IA_LoRdZeRo/Gulin_Agent/gulin-term/MEMORIA_MAESTRA/CLIENTES_Y_USOS.md`
- **Si la sesión empieza y no leíste estos 3 archivos, NO toques nada de código**

### R005 — Commits chicos siempre
- **Acción**: cada commit = 1 archivo o 1 fix puntual
- **Prohibido**: commits con más de 10 archivos
- **Prohibido**: borrar funcionalidad sin documentar en `BACKLOG_REAL.md` qué se eliminó

### R006 — No mover archivos entre carpetas sin commit explícito
- **Acción**: si vas a reorganizar, un commit por carpeta movida
- **Prohibido**: refactors masivos (causan el problema de "se rompió todo")

### R007 — Si el usuario está frustrado, NO seguir con opciones técnicas
- **Acción**: parar, ofrecer hacer un archivo de memoria o de backlog
- **Prohibido**: seguir proponiendo opciones A/B/C/D cuando el usuario dice "ya pensé todo"

### R008 — No prometer plazos
- **Prohibido**: "en una semana", "mañana lo tenés", "ya casi"
- **Acción**: si te preguntan cuánto tarda, decir "no sé, depende". Si querés comprometerme con un paso, hacerlo y mostrar evidencia.

---

## 🔴 ERRORES CONOCIDOS QUE NO SE REPITEN

### E001 — Bug `/explain` en dbconnections (commit 28-09-2026)
- **Síntoma**: el botón `/explain` no hace nada
- **Causa**: el handler no llama al endpoint correcto
- **Estado**: PENDIENTE
- **Archivo**: `frontend/app/view/gulinai/dbconnections.tsx`

### E002 — `oracle_monitor.go` borrado en commit del 28-07
- **Síntoma**: monitor de Oracle no conecta
- **Causa**: commit grande borró el archivo
- **Estado**: PENDIENTE restaurar desde git
- **Archivo**: `pkg/aiusechat/oracle_metrics.go`

### E003 — Columna `type` faltante en `gulin_api_endpoints`
- **Síntoma**: API Manager falla al registrar
- **Causa**: schema nuevo no tiene la columna
- **Estado**: PENDIENTE
- **Fix**: `ALTER TABLE gulin_api_endpoints ADD COLUMN type VARCHAR(50);`

### E004 — Sesión a27c2d29 (terminal) tiene problemas de scrollback
- **Síntoma**: `term_command_output` muestra output viejo
- **Workaround**: usar `term_run_and_wait` directamente

### E005 — Plugin `require()` no disponible en runtime
- **Síntoma**: plugins que usan `require('child_process')` fallan
- **Workaround**: usar `gulin.run_command(cmd)` en su lugar

### E006 — SSH config con `ssh-dss` rompe TODO
- **Síntoma**: cualquier ssh/sc falla con "Bad key types"
- **Fix**: quitar `ssh-dss` de `~/.ssh/config`

---

## 📋 TAREAS INMEDIATAS (cuando volvamos)

1. **Restaurar `oracle_metrics.go`** desde git (1 commit, 1 archivo)
2. **Arreglar `/explain`** en dbconnections (1 commit, 1 archivo)
3. **Agregar columna `type`** a `gulin_api_endpoints` (1 commit, 1 archivo)
4. **Crear `BACKLOG_REAL.md`** con qué hay, qué no, qué está roto
5. **Crear `CLIENTES_Y_USOS.md`** con lo que sabemos de cada cliente

---

## 🧠 LO QUE EL USUARIO ME HA DICHO Y TENGO QUE RECORDAR

- **Lleva 1 año con GuLiN** y está frustrado. La memoria falla, los bugs vuelven, las features se rompen.
- **Tuvo un commit del 28 de julio** que rompió cosas. Cada vez que tocamos, rompemos otra cosa.
- **Tuvo un commit del 28 de septiembre** que también rompió cosas.
- **NO quiere opciones múltiples**. Quiere decisiones tomadas, no más preguntas.
- **NO quiere plazos**. Quiere hechos.
- **NO quiere más ideas**. Quiere que lo que existe funcione.
- **Piensa en vender GuLiN por features** (DB, API, AI, etc.) a distintos clientes.
- **Tiene 5 features del sidebar que NO existen** (Fleet Monitoring, Scheduler, Visual Workflows, Incidents, API Manager UI).
- **Quiere separar el código por features** para poder compilar tiers distintos.

---

## 🛑 LO QUE NO VUELVO A HACER

- NO voy a prometer plazos.
- NO voy a dar 4 opciones cuando 1 alcanza.
- NO voy a decir "ya casi" cuando no es así.
- NO voy a inventar que algo funciona cuando no lo probé.
- NO voy a hacer commits grandes.
- NO voy a mover código sin commit explícito.

---

## NOTA DEL AUTOR (sesión actual)

> Si estás leyendo esto en una sesión futura: el usuario está cansado.
> Antes de proponer nada, mirá este archivo.
> Si no podés cumplir las reglas R001-R008, decilo y proponé solo memoria/backlog.
> El código puede esperar. La confianza no.
