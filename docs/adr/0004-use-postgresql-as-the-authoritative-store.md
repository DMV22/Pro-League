# Use PostgreSQL as the authoritative store

PostgreSQL will be the single authoritative store for published and administrative ProLeague data. Redux Toolkit may hold UI state and an API cache, while local storage may hold only non-authoritative preferences; neither browser storage nor Redux persistence may act as the source of Official information.
