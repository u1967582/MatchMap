# Registro de cambios de la auditoría

Una entrada por cada cambio: PR mergeada, migración aplicada en prod, ajuste en un panel (Supabase, App Store Connect, Play Console, RevenueCat, Firebase, EAS) o decisión tomada. Lo más reciente arriba.

**Plantilla**

```markdown
### AAAA-MM-DD · Área NN · Título corto
- **Tipo:** código | migración prod | panel | decisión | build
- **Qué:** qué se cambió.
- **Por qué:** hallazgo que resuelve (p. ej. HALLAZGOS #2 o 01-H3).
- **Dónde:** PR #, commit, migración, panel.
- **Verificación:** cómo se comprobó (tests, consulta SQL, prueba en dispositivo).
- **Rollback:** cómo deshacerlo si algo falla.
- **Quién:** ☁️ nube / 💻 local / 👤 usuario.
```

---

### 2026-10-10 · General · Plan de auditoría creado
- **Tipo:** decisión
- **Qué:** plan maestro en `docs/audit/` con 13 áreas, criterios Go/No-Go y calendario de 2 semanas. Se copia la auditoría del 2026-10-10 como `HALLAZGOS_2026-10-10.md`.
- **Por qué:** salida a mercado en iOS y Android en 1–2 semanas, con modalidad «auditar y arreglar».
- **Dónde:** rama `docs/audit-plan`.
- **Verificación:** estado inicial comprobado en prod con `pg_policies`: los bloqueantes 1–4 siguen abiertos.
- **Rollback:** n/a.
- **Quién:** 💻 local.
