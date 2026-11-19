# Engineering Audit: principal engineer code audit

Periodic reviews of the codebase live in this folder, each with its findings and the decisions taken on them.

**When:** after each phase is complete. Each phase closes with its own audit, so problems are caught while they are still small.

**Goal:** a comprehensive architectural and code quality review, approached as a principal engineer would. Identify overengineering, unnecessary complexity, and opportunities to improve maintainability, performance and resource use, without compromising existing functionality.

**The audit evaluates:**

- **Architectural simplicity:** overengineered solutions, unnecessary abstractions, areas where a simpler implementation works better.
- **Code quality:** clean, consistent, readable; no spaghetti code, duplicated logic or unnecessary complexity.
- **Function and utility usage:** overused, overly generic, redundant or excessively large functions to simplify, consolidate or refactor.
- **Object-oriented design:** where better encapsulation, separation of responsibilities or appropriate patterns would help.
- **Separation of concerns:** code to decouple, extract into dedicated modules, or reorganise into clearer boundaries.
- **State management:** implicit state machines, hidden transitions, side effects and tightly coupled state. Transitions should be explicit, predictable and easy to reason about.
- **Resource and usage optimisation:** unnecessary computation, redundant operations, inefficient resource use.
- **Maintainability and scalability:** structure that supports future development without unnecessary technical debt.

**Guiding principle:** think like a principal engineer. Challenge every unnecessary abstraction, find every avoidable complexity, and require a clear justification for every architectural decision.

**Rules for the work:**

- Do not refactor for its own sake. Preserve what is already well designed.
- Prioritise changes that deliver measurable improvements.
- Favour the simplest maintainable solution over engineering complexity.
- Start read-only: the first pass produces a findings report here, and changes follow only after the owner agrees to them.

**Skills:** use `andrej-karpathy-skills:karpathy-guidelines` to judge every change for surgical scope and checkable success, and `jony-ive` to judge the UI and component design against purpose, restraint and consistent spacing and type.

Use `mattpocock-skills:improve-codebase-architecture` for the architecture review: find shallow modules and seams that should be deepened, and propose the change before making it. That skill is user-only, so the owner triggers it and the audit works from its output. Use `mattpocock-skills:codebase-design` for the shared vocabulary (deep modules, seams, adapters) when judging the findings.

**Output:** one file per audit, named `YYYY-MM-DD-principal-audit.md`, with findings ranked by impact, the evidence for each, the proposed change, and the decision (accepted, deferred or rejected).
