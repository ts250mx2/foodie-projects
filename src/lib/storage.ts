/**
 * Storage helpers for dashboard persistence
 */

export const getDashboardSelectedBranch = (): number | null => {
    if (typeof window === 'undefined') return null;
    const val = localStorage.getItem('dashboardSelectedBranch');
    return val ? parseInt(val) : null;
};

export const setDashboardSelectedBranch = (branchId: number) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('dashboardSelectedBranch', branchId.toString());
    // Trigger storage event for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'dashboardSelectedBranch',
        newValue: branchId.toString()
    }));
};

export const getDashboardSelectedMonth = (): number => {
    if (typeof window === 'undefined') return new Date().getMonth();
    const val = localStorage.getItem('lastSelectedMonth');
    return val ? parseInt(val) : new Date().getMonth();
};

export const setDashboardSelectedMonth = (month: number) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('lastSelectedMonth', month.toString());
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'lastSelectedMonth',
        newValue: month.toString()
    }));
};

export const getDashboardSelectedYear = (): number => {
    if (typeof window === 'undefined') return new Date().getFullYear();
    const val = localStorage.getItem('lastSelectedYear');
    return val ? parseInt(val) : new Date().getFullYear();
};

export const setDashboardSelectedYear = (year: number) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('lastSelectedYear', year.toString());
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'lastSelectedYear',
        newValue: year.toString()
    }));
};
