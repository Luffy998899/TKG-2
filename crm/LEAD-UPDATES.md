# Lead operations update

Deploy the CRM using the normal `update.sh` process in DEPLOY.md. Apply both
`20261022100000_lead_operations.sql` and `20261022120000_contact_later.sql`.
The migrations preserve existing customers and history; they do not assign
production leads or move existing leads to a new stage automatically.

## Contact Later pipeline stage

Apply `20261022120000_contact_later.sql` with this release. **Contact Later**
appears between Contacted and Appointment in the division pipelines, and is
also available in General / Unsorted. Filter Leads by this stage to see the
customers who need another contact later.

Open a customer's stage picker and choose **Contact Later**, or drag a card
into its board column. Enter **Contact again on**, use **In 2 days** or
**In 3 days**, then save. The stage and the optional follow-up reminder save
together. The reminder belongs to the assigned rep; on an unassigned lead it
belongs to the admin creating it. The existing daily due-date notification
engine and configured reminder email deliver it using Vancouver dates.

Leave the date blank when timing is unknown: the lead stays in Contact Later
without a reminder date being guessed. The call result remains independent.
No leads are moved automatically by the migration. A requested stage move adds
its normal history entry; existing customer details, prices, assignments and
past history are retained. Existing tasks are not completed or removed by the
move.

## Assign 98 leads to Eva Bansal

As an admin, open **Leads**, select **Telecommunications** and **Unassigned**,
and leave the search empty. Expand **Bulk assignment**. Verify the results
contain the intended 196 TELUS leads. Enter **98** under **Number of unassigned
leads**, click **Select first 98 unassigned**, choose **Eva Bansal**, then click
**Assign 98 leads**. The preview should say that 98 remain unassigned.

The assignment changes only `assigned_to` on each selected deal. Normal update
timestamps, assignment audit entries and notifications are added, and existing
open work follows its deal's rep. Customer fields, stage, review flag, pricing,
contract records and existing history are preserved. If any selected lead's
assignment has changed, the entire operation is refused; refresh and select
again. Only admins can run it, and recipients must be active sales reps.

The selector operates on the current results, capped at 300. Narrow the filters
for larger batches. **Distribute selected leads equally between reps** assigns
the selected batch in round-robin order. A remainder goes to the first selected
reps, so counts differ by at most one. It balances the selected batch, not each
rep's existing workload, and can be used on future lead batches.

## Pricing and reports

**Existing monthly bill** records what a customer currently pays TELUS or
another provider. It is never passed into revenue or commission calculations.
**New deal price / month** records the new offer. One-time price and term remain
separate. Historical clients added directly, and imports initially placed at
sale stages, are excluded from sales and revenue reports. An imported prospect
counts as a sale after an actual transition from a prospect stage to a sale
stage. The pre-existing commission policy remains: imported/directly added
clients do not automatically generate commissions.

Legacy import prices are moved into the existing-bill field only when their
saved source column explicitly says current, existing, bill or TELUS. An
amount already changed since import is left untouched. An
ambiguous old **Monthly** column cannot reliably distinguish an offer from a
provider bill and needs review. The migration does not guess or erase it.

## Import and contact details

Save Excel sheets as CSV. Map **Existing monthly bill**, **New deal price** and
**Existing contract status** separately. New imports default to **New Lead**.
Numbers are normalized to international format, including Excel apostrophes,
`.0` suffixes and exact scientific notation. Duplicate detection compares the
cleaned phone and case-insensitive email within the file and with existing
customers. Rows duplicating another row in the file are skipped with an error;
existing customers follow the chosen attach/skip policy.

Canadian addresses containing a distinct city followed by a recognized province
populate the city field while preserving the complete original address,
including province, unit and postal code. Explicit city columns take precedence;
uncertain addresses are preserved for review. Ambiguous CSV columns such as
**Monthly** need explicit mapping to the current bill or new offer.

Phone and email are optional for manual entry and imports. **Missing Contact**
appears if either is absent, and clears after both are supplied. Invalid,
nonblank phone/email values still need correction before importing.

## Calls, follow-ups and contracts

Call results: **No Answer**, **Not Interested**, **Call Back Later**,
**Interested**, **Wrong Number**. The latest result appears on the deal; every
logged result is preserved in its call activity.

**Call back in 2 days** and **Call back in 3 days** fill the follow-up form;
click **Add** to save. Choose any date for other follow-ups. The existing daily
08:00 Vancouver digest job now creates in-app due-date notifications, even
without email configuration. Each task is notified once per due date; completed
and future tasks are skipped. Email reminders include tasks due today and
overdue when the existing Resend configuration is available.

Moving a prospect to a sale stage asks for the new contract start and expiry.
Telecommunications conversions require both; other divisions can leave both
blank for one-time jobs without a contract.
The stage and contract save together, or neither saves. An existing active
contract is renewed with its history retained. Existing renewal reminders at
120, 90, 60 and 30 days before expiry continue through the scheduled engine.
Existing provider contract status is independently selectable as **Out of
Contract**, **Active Contract** or **Unknown**.
