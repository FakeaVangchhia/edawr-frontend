# Next.js 16

This is not the Next.js you may know. Consult
`node_modules/next/dist/docs/` before writing framework code: middleware is
`src/proxy.ts`, `params` and `searchParams` are Promises, Turbopack is the
default, and `await connection()` in the root layout is load-bearing.

# Git

Never commit or push anything. Do not touch
anything on GitHub — that is mine to do by hand.
Also, whenever you work on another worktree created by me or you, never touch another worktree, you must remain on your current worktree.

## Vercel deploys `master` and nothing else

`vercel.json` carries `git.deploymentEnabled`, which is an allowlist written
backwards: `"**": false` refuses every branch, and `"master": true` puts one
back. Vercel's rule is that a branch matching several patterns deploys if *any*
matching rule is `true`, so `master` wins its own exception and every other
branch — `remote` included — is refused before a build is queued.

**Vercel reads this file from the branch being pushed, not from `master`.** That
is what makes it work on `remote` at all, and it is also the trap: deleting or
editing this file on a branch re-enables deploys *for that branch*, and nothing
on `master` can prevent it.

It stops **automatic Git deployments only**. `vercel deploy` from a laptop still
deploys whatever it is pointed at, by design — that is the manual escape hatch,
not a hole in this.
