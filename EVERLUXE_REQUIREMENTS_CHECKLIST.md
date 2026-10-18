# Everluxe implementation checklist

| Requirement | Status | Evidence / blocker |
|---|---|---|
| Repository inventory and staged checklist | VERIFIED | Repository inspected; this file tracks status. |
| Neon connection diagnosis and safe migration | IN PROGRESS | Additive migration applied; current local API restart cannot reach Neon intermittently. |
| Database-backed enquiry submission | IN PROGRESS | API route persists enquiries; frontend now submits to API. Needs live request test after Neon reconnects. |
| Admin enquiry management | IN PROGRESS | Existing status update plus attachments/add-ons/quotation relations added; needs live authenticated test. |
| Persistent gallery image uploads and synchronization | IN PROGRESS | Existing upload/gallery flow works locally; live verification pending. |
| Gallery categories and video support | IN PROGRESS | `category`/`mediaType` persist; video upload validation and lightbox playback are implemented, but admin media picker still needs final UI verification. |
| Recent Works and fullscreen/swipe viewer | IN PROGRESS | Public gallery now maps persisted categories/media and lightbox supports video plus existing swipe/navigation; refresh test awaits live API. |
| Editable budget ranges | IN PROGRESS | Models, admin/public API routes and wired admin screen added; live workflow test pending. |
| Admin-managed design models | IN PROGRESS | Existing catalogue design CRUD is present; budget-selection UI still required. |
| Approved addons under ₹30k | IN PROGRESS | Models and admin/public API routes added; admin/customer UI still required. |
| Secure customer reference-photo uploads | IN PROGRESS | Private attachment records added; upload authorization/storage UI and live test still required. |
| Quotation management and historical snapshots | IN PROGRESS | Quotation and history models/routes added; admin UI and live test still required. |
| Secure admin password change | IN PROGRESS | Auth endpoint added; admin UI and live test still required. |
| Customer accounts and event profiles | IN PROGRESS | Registration/profile APIs and `/account` event-profile screen added; live authenticated test pending. |
| ADMIN/CUSTOMER authorization | IN PROGRESS | Admin middleware and customer-scoped event-profile routes are present; live authorization test pending. |
| Demo cleanup and responsive integration | IN PROGRESS | Admin navigation is now wired; final responsive/demo-data review remains. |
| Frontend/backend feature tests | IN PROGRESS | Build and Prisma validation pass; Neon-backed API test is currently blocked by connection refusal. |
| Production deployment | NOT STARTED | Intentionally not performed; awaiting explicit approval. |
