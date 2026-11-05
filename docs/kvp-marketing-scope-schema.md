# KVP Marketing scoped schema

`kvp-marketing-scope-schema.sql` is a record of the schema loaded into this project's Lovable Cloud database on 2026-11-05. It was extracted read-only from the staging database "Application test - Stage" and covers Leads, Communication Center and User Management only (57 tables, 196 policies, 28 triggers, 13 functions, no data).

It is already applied. Do not run it again; it is kept here as documentation and is intentionally not in a migrations folder.

Left out on purpose: foreign keys to tables outside this scope (retailers, orders, visits, distributors, ...) and the audit triggers that write to out-of-scope audit tables. The file also omits `hash_hint_answer(text)`, which was applied separately.
