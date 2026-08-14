# PRO-LEAGUE

A professional football manager simulator built with React, TypeScript, and Redux Toolkit.

---

## State Management Architecture

The application implements a highly scalable and robust state management architecture using **Redux Toolkit (RTK)**, adhering to modern software engineering principles and a strict unidirectional data flow.

* **Normalized State Structure:** The global store is strategically split into two specialized slices:
  * `league slice`: Acts as the canonical single source of truth for raw domain data (`teams`, `matches`, `standings`, `transfers`).
  * `ui slice`: Manages short-lived presentation states such as selected entities, current round view, active filters, and active table sorting.
* **On-the-Fly Computing (Derived State):** To avoid data redundancy and desynchronization, complex structures like the computed league standings or filtered transfer markets are not stored in the state. Instead, they are calculated dynamically via memoized derived selectors built with `createSelector`.
* **State Persistence & Rehydration:** The store integrates `redux-persist` along with a custom asynchronous compatibility adapter for Vite. This configuration serializes both slices to the browser's `localStorage` and smoothly rehydrates them on application startup, serving as a reliable client-side game save.
* **Clean Architectural Separation:** React components are kept strictly "dumb" and presentational. They have zero awareness of the global state's internal layout. Components consume data via decoupled selectors and delegate state-mutation requests by dispatching high-level use-case actions. All pure domain business logic is fully isolated within reducers and selectors.

---

## Feature-Based Structure

The codebase moves away from traditional flat technical layering (like grouping all components or reducers together) and embraces a modular, scalable **feature-driven folder architecture**:

```text
src/
├── features/
│   ├── league/               # Domain-specific feature module
│   │   ├── components/       # Presentational UI views (TeamsList, RoundMatches, DebugPanel)
│   │   ├── selectors/        # Memoized selectors handling business computations
│   │   └── slices/           # Reducers and action creators managing league state
│   └── ui/                   # Interface orchestration module
│       ├── selectors/        # Selectors for UI state fields
│       └── slices/           # State management for sorting, selections, and filters
├── shared/
│   └── types/                # Core TypeScript structural interfaces (Team, Player, Match)
└── store/                    # Core infrastructure layer
    ├── hooks.ts              # Pre-typed Redux React hooks (useAppSelector, useAppDispatch)
    └── index.ts              # Redux store configuration and persistence middleware hub
```

### Key Architectural Benefits:
* **High Encapsulation:** Modifying or extending a feature requires changes only within its local folder boundary.
* **Flawless Scale:** New slices and visual screens (e.g., *Match Simulator*, *Transfer Market Hub*) can be attached seamlessly without breaking existing layouts.
* **High Testability:** Isolating business logic within pure functions enables comprehensive unit testing of slices and derived state selectors using `Vitest` without mock-rendering React elements.