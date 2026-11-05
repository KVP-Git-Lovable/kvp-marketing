# SOC 2 Type 1 — System Description & Security Preface

**Service Organization:** KVP Business Solutions  
**System Name:** Bharat Sales Spark (KVP Field Force)  
**Report Period:** As of March 2026  
**Trust Services Criteria:** Security, Availability, Confidentiality

---

## 1. System Overview

Bharat Sales Spark (also referred to as KVP Field Force) is a cloud-hosted field force automation platform designed for consumer goods distribution companies operating in India. The system enables field sales representatives to plan daily retail visits (beats), capture orders, record attendance with biometric face verification, manage expenses, and report competitive intelligence — all from a single mobile application.

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18, TypeScript, Tailwind CSS | Single-page application UI |
| Mobile Runtime | Capacitor (iOS & Android) | Native device access (camera, GPS, filesystem) |
| Backend-as-a-Service | Supabase (PostgreSQL 15+) | Database, authentication, storage, real-time subscriptions |
| Server-Side Logic | Supabase Edge Functions (Deno) | 48 functions handling sensitive operations |
| Monitoring | Firebase Crashlytics & Performance | Client-side error and performance telemetry |
| Hosting | Supabase Cloud (AWS infrastructure) | Managed PostgreSQL, Auth, Storage, Edge Functions |

### Deployment Model

The application is deployed as a **single-tenant** cloud service. Each customer organization operates on a dedicated Supabase project with isolated database, authentication, storage, and edge function deployments. There is no shared tenancy across customer boundaries.

---

## 2. Data

The system processes the following categories of data, mapped to their corresponding database representations:

| Data Category | Description | Database Tables / Storage |
|--------------|-------------|--------------------------|
| **Access Control Data** | User roles, security profiles, granular permissions (module/field/action/widget) | `user_roles`, `security_profiles`, `profile_object_permissions`, `user_profiles` |
| **Customer Content (Retailer Data)** | Retailer profiles, orders, visit records, GPS coordinates, photos | `retailers`, `orders`, `order_items`, `visits`, `visit_photos`, `gps_tracking` |
| **End User Identifiable Information (EUII)** | Employee names, email addresses, phone numbers, profile photos, face verification data | `profiles`, `attendance` (photo URLs, face match confidence), `employee-photos` storage bucket |
| **System Metadata** | Feature flags, approval configurations, beat plans, product catalogs | `feature_flags`, `approval_config`, `beats`, `products`, `product_categories` |
| **Account Data** | Authentication credentials, session tokens, password reset state, account lock status | `auth.users` (managed by Supabase Auth), `profiles.must_change_password`, `profiles.is_account_locked`, `profiles.password_reset_attempts` |
| **Financial Data** | Expense claims, allowances, credit notes, invoices | `additional_expenses`, `beat_allowances`, `credit_notes`, `invoices` |
| **Audit Data** | Sensitive data access logs, approval audit trails, feature flag changes, beat reassignment history | `sensitive_data_access_log`, `approval_audit_log`, `feature_flag_audit`, `beat_audit_log` |

### Data Residency

All data is stored within the Supabase Cloud project infrastructure. Storage buckets holding employee photographs, attendance selfies, and visit photos are configured as **private by default**; access is granted exclusively through time-limited signed URLs generated server-side.

---

## 3. Control Monitoring

The organization employs the following mechanisms to continuously monitor the effectiveness of security controls:

| Mechanism | Implementation | Evidence |
|-----------|---------------|----------|
| **RLS Coverage Monitoring** | Automated database linter validates that Row-Level Security is enabled on all public tables | 284 of 284 tables confirmed with RLS enabled (100% coverage) |
| **Sensitive Data Access Logging** | Database trigger `prevent_admin_sensitive_access` blocks unauthorized reads of PII fields; all access attempts are recorded | `sensitive_data_access_log` table with `user_id`, `table_name`, `action`, `timestamp` |
| **Approval Audit Trail** | Every approval action (approve, reject, escalate) is immutably logged with performer identity and metadata | `approval_audit_log` table |
| **Feature Flag Audit** | Changes to feature toggles are logged with before/after state | `feature_flag_audit` table |
| **Edge Function Secret Management** | API keys and service credentials are stored as Supabase Edge Function environment variables, never in client-side code | Verified via codebase audit — `Deno.env.get()` pattern across all 48 functions |
| **Client-Side Error Monitoring** | Firebase Crashlytics captures runtime errors; Firebase Performance tracks API latency and screen rendering | `@capacitor-community/firebase-crashlytics`, `@capacitor-firebase/performance` |

---

## 4. Access Management

### Hierarchical Permission Model

Access control is implemented through a **4-layer hierarchical permission system**:

```
Security Profile
  └── Module Permissions    (e.g., attendance_, admin_product_)
       └── Field Permissions   (e.g., field_employee_phone)
            └── Action Permissions  (e.g., action_export_data)
                 └── Widget Permissions (e.g., widget_revenue_chart)
```

Each permission object in `profile_object_permissions` carries six boolean flags:

| Flag | Purpose |
|------|---------|
| `can_read` | View data / render UI element |
| `can_create` | Create new records |
| `can_edit` | Modify existing records |
| `can_delete` | Remove records |
| `can_view_all` | See data across the entire organization (bypasses manager hierarchy) |
| `can_modify_all` | Edit data across the entire organization |

### Security Profiles

Named security profiles (e.g., "System Administrator", "Area Sales Manager", "Sales Executive") are defined in the `security_profiles` table. Each profile is assigned a set of permission objects. Users are linked to profiles via the `user_profiles` table.

The System Administrator profile contains all permission objects with all flags enabled. Non-administrative profiles contain only the permission objects relevant to their role, with flags set according to the principle of least privilege.

### Manager Hierarchy Visibility

Data visibility is further constrained by organizational hierarchy. The database functions `get_all_subordinates(user_id)` and `get_reporting_chain(user_id)` — both implemented as `SECURITY DEFINER` functions — enable RLS policies to restrict data access based on the reporting structure stored in `profiles.manager_id`. A manager can view data belonging to their direct and indirect reports, but not peers or superiors.

---

## 5. Identity & Access Management

### Authentication Provider

All authentication is managed by **Supabase Auth**, which provides:

- Email/password credential storage with bcrypt hashing (managed by Supabase, not application code)
- JWT token issuance with configurable expiration
- Automatic token refresh via `onAuthStateChange` listener in the client application
- Session persistence across application restarts

### Session Management

The client application (`useAuth` hook) subscribes to Supabase Auth state changes. On every `SIGNED_IN`, `TOKEN_REFRESHED`, or `SIGNED_OUT` event, the application updates its local state. On sign-out, a comprehensive cleanup routine executes:

1. All cached permissions are purged from `localStorage`
2. All IndexedDB stores (offline orders, cached attendance) are cleared
3. React Query cache is invalidated
4. The user is redirected to the authentication screen

This ensures **zero residual data** from a previous session remains accessible to a subsequent user on the same device.

---

## 6. New User / Modification of User Access

### User Creation

New users are created exclusively through the **`admin-create-user`** edge function, which:

1. Validates that the requesting user holds `can_create` permission on the `admin_user_create` object
2. Creates the user in Supabase Auth with a temporary password
3. Creates the corresponding `profiles` record with `must_change_password = true`
4. Assigns the specified security profile via `user_profiles`

Direct user creation through the Supabase Auth API or dashboard is not part of the standard operational workflow.

### Invitation Flow

An alternative onboarding path uses the **`send-user-invitation`** edge function:

1. Permission check: caller must have `can_create` on `admin_user_create`
2. An invitation record is created in `user_invitations` with a UUID token and 7-day expiry
3. An email is sent via Resend with a profile completion link
4. The invitee completes their profile via the **`validate-invitation`** edge function, which verifies the token, creates the auth account, and assigns the profile

### Access Modification

Changes to a user's access level are performed by reassigning their security profile in `user_profiles`. This immediately changes their effective permissions on the next permission fetch (cached for up to 30 minutes client-side, with forced refresh available).

### User Deactivation

Users can be deactivated by setting `profiles.is_active = false`, which is enforced by RLS policies that filter inactive users from operational queries. Account lockout (`profiles.is_account_locked = true`) prevents authentication entirely.

---

## 7. Authentication

### Primary Authentication

Users authenticate with **email and password** through Supabase Auth. Upon successful authentication:

1. A JWT access token and refresh token are issued
2. The client stores tokens in secure storage (Capacitor Preferences on mobile, `localStorage` on web)
3. All subsequent API requests include the JWT in the `Authorization` header
4. Supabase validates the JWT on every request before evaluating RLS policies

### Account Lockout

The `profiles.is_account_locked` flag, when set to `true`, prevents the user from accessing any application functionality. The lockout is enforced both at the application layer (auth hook redirects to a locked screen) and at the database layer (RLS policies check the flag).

### Password Reset

Password reset is rate-limited via the `profiles.password_reset_attempts` counter and `profiles.last_password_reset_attempt` timestamp. The reset flow uses Supabase Auth's built-in password recovery with an additional SMS OTP verification step via the `send-password-reset-sms` edge function.

### Forced Password Change

New users created via `admin-create-user` have `must_change_password = true`. The application enforces a password change screen before granting access to any other functionality.

### Offline Authentication

For field environments with intermittent connectivity, the application caches authentication state locally with integrity validation (`cachedAuthIntegrity.ts`). The cached state includes a cryptographic signature to detect tampering. Cached credentials allow read-only access to previously synced data; write operations are queued and executed upon reconnection.

---

## 8. Authorization & Row-Level Security

### RLS Coverage

**100% of public tables** (284 of 284) have Row-Level Security enabled. No table in the public schema is accessible without a valid JWT and a matching RLS policy.

### Policy Architecture

RLS policies follow a consistent pattern:

1. **Owner-based policies**: `auth.uid() = user_id` — users see their own data
2. **Hierarchy-based policies**: `auth.uid() IN (SELECT * FROM get_reporting_chain(user_id))` — managers see subordinate data
3. **Role-based policies**: `has_role(auth.uid(), 'admin')` — administrators have broader access
4. **Permission-based policies**: Edge functions verify `profile_object_permissions` flags before performing operations

### SECURITY DEFINER Functions

To prevent infinite recursion when RLS policies reference other RLS-protected tables, critical helper functions are declared as `SECURITY DEFINER`:

| Function | Purpose |
|----------|---------|
| `has_role(user_id, role)` | Check if a user holds a specific `app_role` |
| `get_all_subordinates(user_id)` | Return all direct and indirect reports |
| `get_reporting_chain(user_id)` | Return the upward management chain |

These functions execute with the privileges of the function owner (typically the database superuser), bypassing RLS on the tables they query, while the calling RLS policy still enforces access on the target table.

### Approval Workflows

Sensitive operations (expense claims, leave requests, regularization requests) require multi-level approval through the `approval_requests` / `approval_steps` engine. The system uses a **first-action-wins** parallel approval model where multiple approvers at the same level can act, but only the first action is binding. All actions are logged to `approval_audit_log`.

---

## 9. Data Security

### Storage Security

| Bucket | Visibility | Access Method |
|--------|-----------|---------------|
| `employee-photos` | Private | Signed URLs (time-limited) |
| `attendance-photos` | Private | Signed URLs |
| `visit-photos` | Private | Signed URLs |
| `branding-assets` | Public | Direct URL (company logos only) |

Signed URLs are generated server-side with configurable expiration. The client application never holds permanent URLs to private assets.

### Sensitive Field Protection

The database trigger `prevent_admin_sensitive_access` intercepts queries to columns containing personally identifiable information (PII). Unauthorized access attempts are:

1. Blocked at the database level
2. Logged to `sensitive_data_access_log` with the requesting user's identity, the target table, the action attempted, and the timestamp

### Client-Side Data Protection

On user sign-out, the application performs a complete data wipe:

- `localStorage`: all keys cleared
- `IndexedDB`: all object stores dropped
- `Capacitor Preferences`: all entries removed
- `React Query cache`: invalidated and garbage collected

This prevents cross-user data leakage on shared devices — a critical requirement for field force applications where devices may be reassigned between employees.

---

## 10. Multi-Tenancy Statement

Bharat Sales Spark operates as a **single-tenant application**. Each customer organization is provisioned with a dedicated Supabase project, which includes:

- An isolated PostgreSQL database
- A separate Supabase Auth instance
- Independent storage buckets
- Dedicated edge function deployments

There are no tenant identifier columns in the database schema, and no data sharing occurs between customer deployments. Tenant isolation is enforced at the infrastructure level by Supabase's project separation model.

---

## 11. Edge Function Security

The application uses **48 Supabase Edge Functions** (Deno runtime) to handle operations that require elevated privileges or external API access:

| Category | Functions | Security Model |
|----------|----------|---------------|
| User Management | `admin-create-user`, `send-user-invitation`, `validate-invitation` | Service role key; caller permission verified via `profile_object_permissions` |
| Biometric Verification | `verify-face-match` | Service role key; face embeddings compared server-side, never sent to client |
| AI Processing | `generate-recommendations`, `beat-health-insights`, `ai-coach-chat` | External API keys (OpenAI, etc.) stored as environment variables |
| Notifications | `send-push-notification`, `send-password-reset-sms` | Resend API key, SMS provider credentials as environment variables |
| Data Processing | `generate-daily-summary`, `compute-attendance-summary` | Service role key for cross-user aggregation |

**Key security properties:**

1. All sensitive API keys (Resend, OpenAI, SMS providers) are stored as **Supabase Edge Function environment variables**, accessible only via `Deno.env.get()` at runtime
2. No secret keys appear in client-side code or are transmitted to the browser
3. Functions that modify user data verify the caller's permissions by checking `profile_object_permissions` before proceeding
4. The Supabase service role key is used only within edge functions for operations that legitimately require bypassing RLS (e.g., creating auth users, cross-user aggregation)

---

## 12. Audit & Logging

| Log Type | Table / System | Data Captured | Retention |
|----------|---------------|---------------|-----------|
| **Sensitive Data Access** | `sensitive_data_access_log` | User ID, table name, action, timestamp, IP context | Indefinite |
| **Approval Actions** | `approval_audit_log` | Request ID, action (approve/reject/escalate), performer, level, metadata, timestamp | Indefinite |
| **Feature Flag Changes** | `feature_flag_audit` | Flag name, old value, new value, changed by, timestamp | Indefinite |
| **Beat Reassignment** | `beat_audit_log` | Beat ID, old owner, new owner, action, performer, metadata | Indefinite |
| **GPS Tracking** | `gps_tracking` | User ID, latitude, longitude, accuracy, timestamp, battery level | Configurable |
| **Client Errors** | Firebase Crashlytics | Stack traces, device info, OS version, app version | 90 days (Firebase default) |
| **Performance Metrics** | Firebase Performance | API latency, screen render time, network traces | 90 days (Firebase default) |

All database audit tables are protected by RLS policies that restrict read access to administrators and the system service role. Audit records are append-only by design — no `UPDATE` or `DELETE` policies exist on audit tables.

---

*This document was derived from a comprehensive audit of the Bharat Sales Spark application codebase and database schema as of March 2026. All table names, function names, and architectural patterns referenced herein are verifiable against the source code repository.*
