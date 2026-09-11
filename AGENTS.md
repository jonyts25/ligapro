<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Server Actions (`"use server"` files)

Files with `"use server"` may **only export async function declarations**. Do not export `const` aliases, re-exports, objects, or other non-function values — Next.js treats that as a contract violation and can break the entire Server Actions chunk (including unrelated actions in other modules).
<!-- END:nextjs-agent-rules -->
