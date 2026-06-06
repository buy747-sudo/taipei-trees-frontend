# Public Tree Reports MVP Design

Date: 2026-06-06
Projects: `taipei-trees-frontend`, `tree_app`
Status: Approved design, not yet implemented

## Purpose

Taipei Trees should let citizens report abnormal tree conditions because the public map covers many trees and can become a civic participation channel, not only a lookup tool.

The first version is a reporting intake system, not a 1999 replacement and not a formal dispatch platform. It collects reports for TreeApp administrators to review. It does not promise a reply, does not promise handling time, does not automatically notify agencies or contractors, and does not directly modify tree status.

After submission, citizens see:

> 已收到您的通報，案件編號 TT-R-YYYYMMDD-0001。通報將由管理人員檢視。若為緊急事項，例如樹木倒伏、枝幹即將掉落、已影響人車安全，請立即聯絡 1999。

## Scope

### In Scope

- Public report entry points in TaipeiTrees.
- Reports do not require login.
- Tree-bound reports from a tree detail page, map sheet, QR flow, or manual tree code lookup.
- Unbound location reports when citizens cannot identify a tree.
- Report form with issue type, urgency, description, location, optional photos, and optional contact information.
- TreeApp backend storage, report number generation, rate limiting, and admin review UI.
- Report status management in TreeApp.
- Future-ready data fields for park trees.

### Out Of Scope For MVP

- Public report list.
- Public report map.
- Public case tracking by report number.
- Automatic agency or contractor notification.
- Contractor-specific routing.
- Government account workflows.
- SLA, promised reply, or promised handling time.
- Direct tree status changes from a public report.
- CAPTCHA, unless spam appears after launch.

## Public Frontend Flow

### Entry Points

TaipeiTrees should show the feature clearly enough for public demos:

1. Homepage visible entry: `通報樹木異常`.
2. Map bottom sheet after selecting a tree: `通報問題`.
3. `tree.html` detail page: `通報這棵樹`.
4. QR scan flow through tree detail, then report.

The homepage entry should guide citizens toward identifying a tree first instead of opening a generic repair form. It should offer:

- Scan tree plate QR Code.
- Select a tree on the map.
- Enter a tree registry code.
- Continue with location-only report when the tree cannot be identified.

### Tree-Bound Report

When a report is opened from a known tree, the frontend passes:

- `tree_code`
- `tree_category`
- `species_name`
- `district`
- `managing_unit`
- tree coordinates when available

The citizen fills only the report content.

### Unbound Location Report

When the citizen cannot identify a tree, the form allows a location report. The report is stored with:

- `tree_code = null`
- `tree_category = unknown`
- `needs_location_review = true`

Location can come from at least one of:

- GPS coordinate
- map-selected point
- address, road section, intersection, or free-text location description

## Report Form

### Issue Types

The MVP has seven fixed issue types:

1. 枯枝、斷枝、掉枝風險
2. 樹木明顯傾斜或倒伏
3. 病蟲害或菇菌異常
4. 樹穴、支架、鋪面問題
5. 樹牌或 QR Code 損壞
6. 遮擋交通號誌、路牌、民宅
7. 其他問題

### Required Fields

- Issue type.
- Urgency:
  - 一般
  - 可能危險
  - 已影響人車安全
- Description, 10 to 500 characters.
- Location source:
  - bound tree, GPS, map point, or location text.

### Optional Fields

- Up to three photos.
- Contact name.
- Contact phone or email.

Contact is optional because the platform does not have capacity to reply to every citizen and must not imply guaranteed case handling.

### Citizen Warnings

The form should show clear copy:

- 本平台協助收集樹木異常資訊，通報內容將提供管理人員檢視；本平台不保證個案回覆或處理時程。
- 若為緊急事項，例如樹木倒伏、枝幹即將掉落、已影響人車安全，請立即聯絡 1999。
- 上傳照片時請避免拍到人臉、車牌、門牌等個資。

## Abuse Prevention

The MVP does not require login and does not include CAPTCHA.

Controls:

- Honeypot field in the frontend form.
- Backend rejects filled honeypot fields.
- Backend IP rate limit:
  - same IP: max 3 reports per 10 minutes
  - same IP: max 20 reports per day
- Description length validation server-side.
- Issue type and urgency allowlist server-side.
- Photo count limit server-side.
- Admin can mark a report as `不受理 / 重複通報`.

Frontend validation is only an aid. The backend remains the source of truth.

## Data Model

### `public_reports`

- `id`
- `report_no`: backend-generated, e.g. `TT-R-20260606-0001`
- `tree_code`: nullable
- `tree_category`: `street`, `protected`, `park`, or `unknown`
- `species_name`: nullable display snapshot
- `district`: nullable
- `managing_unit`: nullable road section, management unit, or park name
- `issue_type`: one of the seven MVP issue types
- `urgency`: `normal`, `possible_danger`, `affecting_safety`
- `description`
- `location_text`: nullable
- `lat`: nullable
- `lng`: nullable
- `needs_location_review`: boolean
- `contact_name`: nullable
- `contact_info`: nullable
- `status`: report review status
- `source`: `home_entry`, `tree_detail`, `map_sheet`, `qr`, `manual_code`, or `location_only`
- `ip_hash`
- `user_agent`
- `created_at`
- `updated_at`
- `reviewed_by`: nullable admin user id
- `reviewed_at`: nullable
- `internal_note`: nullable

### `public_report_photos`

- `id`
- `report_id`
- `photo_url`
- `created_at`

Photo metadata can be expanded later, but the MVP only requires an uploaded file reference.

## Statuses

TreeApp administrators can set:

1. 待檢視
2. 已確認
3. 需現勘
4. 已轉交
5. 已結案
6. 不受理 / 重複通報

Public reports do not directly change tree records. Any tree state change must be a separate authenticated admin action.

## TreeApp Admin MVP

TreeApp gets a `民眾通報` admin list visible to platform administrators.

### List Columns

- Report number
- Created time
- Issue type
- Urgency
- Bound tree code or unbound marker
- District
- Managing unit
- Status
- Photo indicator

### Filters

- Status
- Issue type
- Urgency
- District
- Bound vs unbound
- Has photos

### Detail View

- Full report content
- Bound tree data when available
- Map location when coordinates exist
- Photos
- Optional contact information
- IP hash and user agent summary
- Status update control
- Internal note

Only platform administrators see contact information in the MVP.

## API Design

### Public API

- `POST /public/reports`
  - Creates a report.
  - Generates `report_no`.
  - Validates issue type, urgency, description length, location presence, honeypot, and rate limits.
  - Accepts report fields. Photos can be included in multipart form data or uploaded after creation.

- `POST /public/reports/<id>/photos`
  - Optional if photos are not sent with the main report.
  - Max three photos per report.

The exact upload shape should follow TreeApp's existing upload conventions where possible.

### Admin API

- `GET /api/public-reports`
- `GET /api/public-reports/<id>`
- `PATCH /api/public-reports/<id>`

Admin APIs require authentication and platform administrator permission in the MVP.

## Future Park Tree Support

The design reserves `tree_category = park`. Once park tree records are imported into TaipeiTrees/TreeApp, public reports can bind to park trees without changing the report schema.

Future routing can use:

- `tree_category`
- `district`
- `managing_unit`
- `contractor_id`
- park ownership or responsible unit

Routing and notifications remain outside the MVP.

## Privacy

- Public report contents, photos, and contact information are not displayed publicly.
- The frontend does not offer public case tracking.
- Optional contact information is stored only for admin review.
- Photos include a citizen-facing reminder to avoid personal data such as faces, license plates, and house numbers.
- Future data retention rules can anonymize or delete contact information after a fixed period.

## Testing

Frontend tests:

- Homepage entry is visible.
- Tree detail report link includes tree code.
- Map sheet report link appears for selected tree.
- Report form validates required fields.
- Emergency urgency shows 1999 warning.
- Location-only report can be submitted when location text or coordinates exist.
- Optional contact fields can be blank.
- Photo limit is enforced in UI.

Backend tests:

- Report number generation format and sequence.
- Server-side validation of type, urgency, description, and location.
- Honeypot rejection.
- IP rate limit.
- Bound tree snapshot fields.
- Unbound reports set `tree_category = unknown` and `needs_location_review = true`.
- Photo upload limit.
- Admin list filters.
- Status update permission.

## Open Implementation Notes

- Implement TreeApp backend first or in parallel with frontend mocks.
- Keep the first public frontend implementation usable with mocked API while backend is being built.
- Do not add public report maps or public case tracking in the first implementation.
- Keep copy conservative so the platform receives reports without implying official dispatch responsibility.
