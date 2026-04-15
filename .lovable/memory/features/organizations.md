---
name: Organization structure
description: Multi-org setup with MOOUI Brasil and MOOUI Barcelona, two roles (admin/member)
type: feature
---
- Two organizations: MOOUI Brasil and MOOUI Barcelona
- Only two roles: Admin and Membro (member)
- Users can belong to both orgs with different roles
- Projects are linked to organizations via organization_id
- Sidebar has org selector dropdown
- Team page shows org-specific members
- OrganizationContext manages current org state (persisted in localStorage)
