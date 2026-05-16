# BCI RecruitOS Cloud Folder

This folder is prepared for cloud deployment of the Phase 1 BCI RecruitOS MVP.

## Pages

- Internal admin dashboard: `index.html`
- Agent portal login: `agent-login.html`

## Local Preview

Run from the repository root:

```bash
python3 -m http.server 4180 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4180/bci-recruitos/
http://127.0.0.1:4180/bci-recruitos/agent-login.html
```

## Cloud Notes

This is currently a static MVP and can be deployed to GitHub Pages, Vercel, Netlify, or any static hosting service.

For production, replace demo data with a real backend, authentication, role permissions, and agent-level data isolation.
