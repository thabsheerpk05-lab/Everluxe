# Everluxe implementation checklist

| Requirement | Status | Evidence / blocker |
|---|---|---|
| Repository inventory and staged checklist | VERIFIED | Repository inspected; this file tracks status. |
| Neon connection diagnosis and safe migration | IN PROGRESS | Additive migration applied; current local API restart cannot reach Neon intermittently. |
| Database-backed enquiry submission | IMPLEMENTED · LOCALLY CHECKED | The single rendered form submits models, budget, add-ons and validated private image attachments; duplicate requests use an idempotency key. Server rejects unpublished models, unapproved add-ons and non-upload attachment URLs. Live DB workflow remains blocked by unavailable runtime. |
| Admin enquiry management | IMPLEMENTED · CODE CHECKED | Admin-only enquiry list/status workflow includes attachments, selections and quotation relations. Authenticated live test remains blocked by unavailable runtime. |
| Persistent gallery image uploads and synchronization | IMPLEMENTED · UNVERIFIED | Upload/gallery persistence and public refresh mapping are implemented. Development filesystem is explicitly non-durable; database/object-storage refresh could not be verified without a running API/database. |
| Gallery administration (upload/preview/replace/publish/unpublish/delete/order) | IMPLEMENTED · CODE CHECKED | Admin UI now exposes photo/video upload, preview, category, display order, replacement, status changes and deletion; authenticated runtime verification remains blocked. |
| Gallery categories and video support | IMPLEMENTED · LOCALLY CHECKED | `category`/`mediaType` persist; validated image/video upload and lightbox playback are implemented. Public refresh remains unverified. |
| Recent Works and fullscreen/swipe viewer | IMPLEMENTED · LOCALLY CHECKED | Public gallery maps persisted media and the lightbox supports video, keyboard navigation and pointer swipe. |
| Editable budget ranges | IMPLEMENTED · CODE CHECKED | Admin/public routes and admin screen are present; live persistence test is blocked. |
| Admin-managed design models | IMPLEMENTED · CODE CHECKED | Catalogue CRUD and published-model loading/validation are present; live persistence test is blocked. |
| Approved addons under ₹30k | IMPLEMENTED · CODE CHECKED | Admin/public routes, customer controls and server-side approval validation are present; live persistence test is blocked. |
| Secure customer reference-photo uploads | IMPLEMENTED · CODE CHECKED | Visible multi-file input has previews/removal and client limits; server validates image data URLs, size/type and stores private attachment records. Live access test is blocked. |
| Quotation management and historical snapshots | IMPLEMENTED · CODE CHECKED | Admin quotation creation/status/history UI is wired; snapshots and intentional revisions persist server-side. Live DB test is blocked. |
| Secure admin password change | IMPLEMENTED · CODE CHECKED | Password-change endpoint and admin screen are present; authenticated runtime test is blocked. |
| Customer accounts and event profiles | VERIFIED (deferred) | Customer accounts are intentionally not exposed in v1; backend event-profile structure remains available for a future customer portal. |
| ADMIN/CUSTOMER authorization | IMPLEMENTED · CODE CHECKED | Server middleware restricts admin APIs to ADMIN and customer event profiles to the authenticated owner; live authorization test pending. |
| Demo cleanup and responsive integration | IMPLEMENTED · LOCALLY CHECKED | Removed the client fallback portfolio imagery and fake placeholder copy; no sample packages/videos are present in the seed file. Existing responsive styles remain in place. Database records could not be inspected; any uncertain records remain untouched and must be reviewed by an ADMIN. |
| Frontend/backend feature tests | BLOCKED · RUNTIME ONLY | `npm run dev` started Vite successfully, but the API exited during its required database connection before port 4000 became available. Frontend admin navigation was inspected in the existing browser session; enquiry, upload, quotation, gallery-refresh, profile and authorization workflows could not be exercised. No Neon troubleshooting was attempted. |
| Production persistent storage | BLOCKED · APPROVAL REQUIRED | Use an object-storage provider (recommended: Cloudflare R2 or Supabase Storage) for public gallery media and private attachments. Requires a bucket, credentials, server-side signed/private access configuration and user approval before any paid/hosted activation. |
| Production deployment | NOT STARTED | Intentionally not performed; awaiting explicit approval. |
