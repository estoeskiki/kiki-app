# plans/

Plans for the payments work. Start here.

## The five documents

| # | Document | What it is | When to read it | Who edits it |
|---|---|---|---|---|
| 1 | `payments-phase-2.md` | **The task.** Ordered implementation steps S0–S16 for phase 2, with rules, environment, contracts, checks, rollback, deploy order and an implementation log. | First, sections 0–2. Then one step at a time. | The implementing agent fills §6 (log) and ticks §4 (acceptance). |
| 2 | `payments-architecture.md` | **The design (the "what" and "why").** Concepts (provider, merchant, owner, `payment_mode`), rules per food court / restaurant / kiosk, security model, data model, phases, decisions log. | Sections 1–7 and 10 before writing code. Look things up here when a step's reason is unclear. | Edgar / design changes only. |
| 3 | `payments-test-matrix.md` | **The proof.** Fixture world (food courts, restaurants, kiosks, merchants) and every combination as a test cell (A-…, B-…, H-…). | Before S15 (tests) and whenever a step cites a cell id. | Add cells if a new rule appears. |
| 4 | `payments-onboarding.md` | **Admin-web onboarding spec (phase 3 UI).** Pagos card, merchant form, credential test, checkout preview. Its **backend** pieces are already built into phase 2 (S1, S4, S5). | During S1/S4/S5 (to know why those pieces exist). Fully in phase 3. | — |
| 5 | `yappy-test-plan.md` | **Yappy reference + evidence.** How Yappy Botón de Pago works (API, IPN, hash, UAT hours, errors), UAT test cases T1–T11, results of the 2026-10-30 UAT (§8), go-live checklist (§9). | When touching the Yappy adapter, and to rerun T1–T5 at the end of phase 2. | Results of reruns go in §8. |

## Precedence when they disagree
1. `payments-architecture.md` (design, decisions log) wins over everything.
2. `payments-phase-2.md` wins over `payments-onboarding.md` for anything built in phase 2.
3. `payments-test-matrix.md` defines expected behaviour per case; if code and matrix disagree, the matrix is right
   unless the architecture says otherwise.
4. Any real contradiction → **stop and ask Edgar**, don't pick one.

## How they connect
```
architecture (what/why) ──► phase-2 (how, step by step) ──► test-matrix (proof per case)
        │                          ▲
        └──► onboarding (phase 3 UI; backend parts folded into phase 2)
yappy-test-plan: provider reference + UAT evidence, used by phase-2 S4/S9 and the final UAT rerun
```

## Handover prompt (paste to the implementing agent)

> You are implementing payments phase 2 for the kiki repo. Start with `plans/README.md`, then follow
> `plans/payments-phase-2.md` exactly, step by step from S0. Read its section 0 rules before anything else: the
> Supabase project is production, never handle secret values, add-before-remove, COS smoke test after risky
> deploys, and the list of situations where you must stop and ask Edgar. Use `plans/payments-architecture.md` for
> the reasons behind each step, `plans/payments-test-matrix.md` for test cells, `plans/payments-onboarding.md` for
> why S1/S4/S5 include onboarding pieces, and `plans/yappy-test-plan.md` for Yappy API details. Log every step in
> phase-2 §6. Do one step per commit and report after each step.
