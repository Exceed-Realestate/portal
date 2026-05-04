# Access Levels — Exceed Portal

Single reference for every role and what it unlocks. The team-tree Edit modal
(admin only) lets you set this per member; if the member is also a registered
agent, saving writes the role straight to `agents/{uid}.role` so portal
features are gated immediately.

The same data lives in code at `firebase-init.js → ROLE_CAPABILITIES` — keep
this file and that map in sync.

---

## How to assign access

1. Sign in as admin (`balraj@exceed-re.ae` or `admin@exceed-re.ae`).
2. Open **Team** → click **Edit Tree**.
3. Click any member's edit (pencil) button.
4. Scroll to the **Access permissions** section and pick a role.
5. Save. If a "Linked" badge is shown, the role is also written to that
   agent's portal account (effective on their next reload).

If a member is **not** linked to a registered account yet, the access role
is still stored on the team entry so it carries over the moment they
register — they just can't sign in until then.

---

## System Admin — Platform owner

**Summary:** sits above CEO. Full business access **plus** platform-level
admin rights. Reserved for the platform owner.

- Everything CEO can do
- Plus: change anyone's access role (including own)
- Plus: edit team tree, partners, and Firestore-backed config
- Plus: receive system alerts and Firestore rule overrides
- Currently held by `balraj@exceed-re.ae` only

This is the role to use when the holder is also the technical operator of
the portal — not just the business owner.

---

## CEO — Full access

**Summary:** every screen, every dataset, every admin action.

- View and edit every page in the portal
- Approve, suspend or change role of any agent
- See all customers across all agents
- See leadership-only attendance briefing
- Edit team tree structure, partners and access roles
- Receive deal alerts and high-priority notifications

Use sparingly — currently held by Teruo Shimada and the admin email.

---

## Managing Director — Operations lead

**Summary:** day-to-day operations. Almost everything except changing roles.

- View leadership attendance briefing
- View all agents and customers
- Approve / suspend agents (no role changes)
- Edit team tree, partners and listings
- Receive deal alerts

Right level for Shoya (Japan) and Malik (Dubai).

---

## Board / Executive (役員クラス) — Governance, read-mostly

**Summary:** company-wide visibility for governance, no operational levers.

- View leadership attendance briefing
- View all agents and customers (read only)
- View IRR Simulator and Listings
- Cannot approve agents or edit team structure

Right level for executives who need to see the full picture but
shouldn't be flipping switches.

---

## Manager (マネージャー) — Sales manager / team lead

**Summary:** everything an Agent does, plus visibility into the agents
they manage. Sits between Agent and MD.

- Everything an Agent can do
- Plus: view customers of agents they manage
- Plus: view their team's attendance
- Plus: receive deal alerts
- Cannot approve agents or change roles

Right level for sales managers / team leads who need to coach a small
group without full operational authority.

---

## Agent (エージェント) — Sales agent (default)

**Summary:** the standard sales-agent toolkit. This is the default role
applied at registration.

- Register and manage **own** customers
- Use IRR Simulator, Listings, Deal Alert, Travel and Car Booking
- Mark daily attendance
- Cannot view other agents' customers

Anyone selling property to clients should sit here.

---

## Back Office (バックオフィス) — Admin support

**Summary:** internal-tools-only. Lightest role.

- Mark daily attendance
- View team tree and listings
- Use Car Booking and Database lookups
- No customer or deal-flow access

Right level for office admin / accounting / coordination roles.

---

## No role / blank

If the **Access role** dropdown is left empty, the member is documented in
the org chart but has **no portal login**. Use this for partners (e.g.,
developer reps from Sobha) who shouldn't sign in.

---

## Where roles are enforced

- **Page-level gates:** `isLeadership(role, email)` in `firebase-init.js`
  controls who sees the leadership attendance briefing.
- **Admin-only buttons:** `isAdmin(email)` (a separate, hard-coded list)
  controls Edit Tree, Auto-link, Apply Structure, role-changing dropdowns
  in the agents table.
- **Firestore rules:** `firestore.rules` validates that `role` is one of
  `['admin', 'ceo', 'md', 'board', 'manager', 'agent', 'back_office']` on
  create, and forbids non-admins from changing their own role on update.
