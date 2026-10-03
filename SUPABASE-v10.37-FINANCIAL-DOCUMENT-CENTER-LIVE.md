# Supabase live alignment — v10.37 Financial & Document Center

Project: `balqees-floral`  
Project ref: `urlsngdafpfuetzafggy`

This version was aligned against the live Supabase schema rather than assuming table names.

## Canonical B2B official-document table
`public.client_documents`

The portal does **not** generate tax invoices. Accounting invoices are issued externally, then their official copies are uploaded to the private `client-documents` Storage bucket.

## Lifecycle
`draft → published → replaced / cancelled / archived`

A replacement creates a new row with `replaces_document_id`; publishing the new revision marks the previous published row as `replaced`. The previous file is preserved.

## User state
`public.organization_document_user_state` tracks per-user:
- last opened
- reviewed acknowledgement
- pinned state

Opening and reviewing are intentionally separate.

## Unified center RPC
`public.get_organization_document_center(p_organization_id uuid)`

Sources:
- client documents
- official quotation PDFs
- official contract PDFs
- published contract amendment files

Financial values are returned only where the caller has the relevant finance/approval permission.

## Storage
Bucket: `client-documents` (private)

The SELECT policy checks the exact backing document/source and organization/finance permission. Knowing the Storage path alone does not grant access.

## Notifications
Publishing a client document sends an organization notification with a deep link such as:
`/portal/financial/client_document/<uuid>`

## Realtime
Enabled for:
- `public.client_documents`
- `public.organization_document_user_state`
