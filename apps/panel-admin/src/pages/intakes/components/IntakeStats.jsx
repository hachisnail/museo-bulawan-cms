/**
 * Pure helper functions for sidebar stats on the Intakes page.
 * No React imports needed — these are data-only transforms.
 */

/** Returns the stat rows for the sidebar based on the active tab. */
export function getSidebarStats({ activeTab, submissions, intakes }) {
    const activeIntakesList = intakes.filter(i => i.status !== 'rejected');
    const awaitingDeliveryCount = activeIntakesList.filter(i => i.status === 'awaiting_delivery').length;
    const inCustodyCount        = activeIntakesList.filter(i => i.status === 'in_custody').length;
    const approvedIntakesCount  = activeIntakesList.filter(i =>
        ['approved', 'processed', 'accessioned'].includes(i.status)
    ).length;
    const pendingOffersCount       = submissions.filter(s => ['pending', 'under_review'].includes(s.status)).length;
    const archivedSubmissionsCount = submissions.filter(s => s.status === 'archived').length;
    const rejectedIntakesCount     = intakes.filter(i => i.status === 'rejected').length;

    if (activeTab === 'submissions') {
        return [
            { label: 'Pending Review', count: pendingOffersCount, bgClass: 'bg-amber-50/50', badgeClass: 'bg-amber-100 text-amber-800' }
        ];
    }
    if (activeTab === 'intakes') {
        return [
            { label: 'Awaiting Delivery',    count: awaitingDeliveryCount, bgClass: 'bg-zinc-50',     badgeClass: 'bg-zinc-100 text-zinc-800' },
            { label: 'In Custody',           count: inCustodyCount,        bgClass: 'bg-zinc-50',     badgeClass: 'bg-zinc-200 text-zinc-900' },
            { label: 'Approved & Accessioned', count: approvedIntakesCount, bgClass: 'bg-green-50/50', badgeClass: 'bg-green-100 text-green-800' }
        ];
    }
    // archive
    return [
        { label: 'Archived Offers',   count: archivedSubmissionsCount, bgClass: 'bg-zinc-50',    badgeClass: 'bg-zinc-100 text-zinc-600' },
        { label: 'Rejected Intakes',  count: rejectedIntakesCount,     bgClass: 'bg-red-50/50',  badgeClass: 'bg-red-100 text-red-800' }
    ];
}

/** Returns the header label for the sidebar total badge. */
export function getSidebarTitle(activeTab) {
    if (activeTab === 'submissions') return 'Total Offers';
    if (activeTab === 'intakes')     return 'Total Intakes';
    return 'Archived Items';
}

/** Returns the numeric count shown in the sidebar header badge. */
export function getSidebarCount({ activeTab, submissions, intakes }) {
    if (activeTab === 'submissions') return submissions.filter(s => s.status !== 'archived').length;
    if (activeTab === 'intakes')     return intakes.filter(i => i.status !== 'rejected').length;
    return (
        submissions.filter(s => s.status === 'archived').length +
        intakes.filter(i => i.status === 'rejected').length
    );
}
