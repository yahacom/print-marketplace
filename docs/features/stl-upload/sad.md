---
status: Draft
owner: "Yakiv Vakoliuk"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-09-09"
feature_size: M
stage: "04-05"
ticket: "<TBD>"
---

# Software Architecture Document — stl-upload

<!-- Stages 04-05 → see sdlc/plugin/skills/architecture-design/SKILL.md -->
<!-- 12 Arc42 sections. Empty sections — <!-- N/A: <one-line reason> -->. -->
<!-- C4 Context (L1) lives inline in §3. C4 Container (L2) lives inline in §5. -->

## 1. Introduction and goals

**Intent.** stl-upload — це точка входу всього MVP-флоу маркетплейсу 3D-друку (upload → quote → confirm/decline). Користувач без досвіду в 3D-моделюванні завантажує STL-файл; система синхронно перевіряє, що файл читається і має watertight-геометрію (без дірок/самоперетинів), і або зберігає модель з унікальним ідентифікатором, готовим для quote-engine, або одразу пояснює зрозумілою мовою, чому файл відхилено (PRD §2 Goals, §1 Context).

**Top-3 quality goals (1-liners; full scenarios in §10):**

1. Точність валідації watertightness — валідатор має погоджуватись зі справжнім слайсером у ≥99% випадків (PRD §6 Accuracy), інакше ламається довіра до негайного pass/fail.
2. Безпека обробки недовірених бінарних файлів — sandboxed-парсинг, головний ризик idea-brief §10 і PRD §6.1 abuse case #1.
3. Продуктивність синхронної перевірки — p95 ≤10000 ms (PRD §6 Latency), щоб "негайна відповідь" залишалась негайною.

**Stakeholders.**

| Role | Interest | Sign-off owner? |
|---|---|---|
| User (uploader) | Отримує негайний yes/no без async-стану; довіряє, що модель приватна (US-01…US-05) | No |
| Tech Lead | Затверджує SAD перед stage 06 | Yes |
| Security Lead | Затверджує untrusted-parsing boundary (PRD §6.1 — security review Required) | Yes |

## 2. Constraints

<!-- N/A: filled after §4/§5 decisions to avoid re-litigating pinned stack before strategy is set -->

## 3. Context and scope

<!-- pending §3 draft -->

## 4. Solution strategy

<!-- pending §4 draft -->

## 5. Building block view

<!-- pending §5 draft -->

## 6. Runtime view

<!-- pending §6 draft -->

## 7. Deployment view

<!-- pending §7 draft -->

## 8. Crosscutting concepts

<!-- pending §8 draft -->

## 9. Architecture decisions

<!-- Auto-populated as ADRs spawn in §4-§8 (Step 6 draft-generation.md) -->

| # | Title | Status | Section |
|---|---|---|---|

ADR files live under `docs/features/stl-upload/adr/NNNN-<title>.md`.

## 10. Quality requirements

<!-- pending §10 draft -->

## 11. Risks and technical debt

<!-- pending §11 draft -->

## 12. Glossary

<!-- pending §12 draft -->
