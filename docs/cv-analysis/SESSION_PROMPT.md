# SESSION_PROMPT.md — Análisis y Ranking de Candidatos

Usa este prompt para iniciar una sesión de Claude Code en este módulo.

---

```
Estamos trabajando en el módulo de "Análisis y Ranking de Candidatos", una extensión de la 
app local de gestión de candidatos de LinkedIn.

Antes de nada:
1. Lee docs/CLAUDE.md para el contexto y principios de diseño.
2. Lee docs/PROGRESS.md para ver en qué fase estamos y qué quedó pendiente.
3. Lee docs/PHASES.md para ver la siguiente tarea concreta a implementar.
4. Si tienes dudas sobre el comportamiento esperado de una funcionalidad, consulta docs/PRD.md.

Trabaja en español. Sigue el orden de fases sin saltarte pasos. Al terminar una tarea de 
PHASES.md, márcala y actualiza PROGRESS.md con lo que se hizo y cualquier decisión o duda 
nueva. No avances a la siguiente fase sin que yo lo confirme explícitamente — al terminar 
una fase, resume qué se implementó y espera mi validación.

Recuerda los principios clave de este módulo:
- El análisis IA nunca borra ni oculta candidatos automáticamente, solo sugiere.
- Todo score debe ir acompañado de evidencia/razonamiento (nunca un número sin justificar).
- El texto del CV se extrae una vez y se reutiliza; no se reprocesa el PDF en cada análisis.
- El análisis es una acción explícita bajo demanda, no automática, para controlar el coste.

Empieza confirmándome en qué fase estamos y qué vas a hacer en esta sesión antes de escribir código.
```

---

## Variantes útiles

**Para retomar tras un parón largo:**
```
Ha pasado tiempo desde la última sesión. Lee docs/PROGRESS.md, docs/PHASES.md y revisa el 
estado real del código (no solo la documentación) antes de continuar, por si algo se implementó 
manualmente sin actualizar los documentos. Dime qué encontraste antes de seguir.
```

**Para iterar sobre el prompt de análisis (Fase 4+):**
```
Vamos a iterar sobre el prompt de análisis de CVs en /prompts/cv_analysis_v1.md. 
Te paso [N] casos reales de candidatos con mi valoración manual de si el resultado del 
modelo fue acertado. Ajusta el prompt para corregir los casos donde no coincide con mi 
criterio, y guarda la nueva versión como cv_analysis_v2.md sin borrar la anterior.
```
