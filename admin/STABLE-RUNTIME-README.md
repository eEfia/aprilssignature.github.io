APRILS SIGNATURE - STABLE ADMIN RUNTIME

This package uses a simplified, permanent Admin runtime:
- admin.js: core dashboard, authentication, records and Admin functions
- commerce-admin.js: shop, inventory and checkout functions
- Admin-fixes.js: lightweight interaction fixes

The previous package loaded many overlapping final-correction JavaScript layers at the same time. Several of those layers installed DOM observers and wrappers around the same dashboard functions. The active Admin page no longer loads those overlapping layers. This is a structural cleanup, not a one-day workaround.

The service-worker cache has been advanced to v7 and its Admin asset list has been reduced to the active runtime files, so the old correction layers are not intentionally cached for Admin.

Upload this package as a replacement for the existing website files. Do not separately re-add the old correction script tags to admin/index.html.

Do not delete the Supabase project or tables.
