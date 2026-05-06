/**
 * Lab Storage Utilities
 * Handles saving large content to Lab with automatic fallback to sessionStorage
 */

/**
 * Saves content to Lab input with automatic storage selection based on size
 * Uses sessionStorage for large files (> 1MB) and localStorage for smaller ones
 * If content is too large to cache, it will be skipped but won't throw an error
 */
export function saveToLabInput(content: string): void {
    try {
        // For large content (> 1MB), use sessionStorage
        if (content.length > 1024 * 1024) {
            sessionStorage.setItem('lab-input', content);
            localStorage.removeItem('lab-input');
        } else {
            // For smaller content, use localStorage for persistence
            localStorage.setItem('lab-input', content);
            sessionStorage.removeItem('lab-input');
        }
    } catch (e: any) {
        // If quota exceeded, try sessionStorage as fallback
        if (e.name === 'QuotaExceededError') {
            try {
                sessionStorage.setItem('lab-input', content);
                localStorage.removeItem('lab-input');
                console.warn('Switched to sessionStorage due to quota limit');
            } catch (sessionError) {
                // If even sessionStorage fails, just log and continue
                // The content will still be available in memory for the current session
                console.warn('Content too large to cache, but will be available in current session');
            }
        } else {
            // For other errors, just log and continue
            console.error('Failed to save to storage:', e);
        }
    }
}

/**
 * Loads content from Lab input (checks both storages)
 */
export function loadFromLabInput(): string {
    try {
        return sessionStorage.getItem('lab-input') || localStorage.getItem('lab-input') || '';
    } catch (e) {
        console.warn('Failed to load lab-input from storage:', e);
        return '';
    }
}

/**
 * Clears Lab input from both storages
 */
export function clearLabInput(): void {
    localStorage.removeItem('lab-input');
    sessionStorage.removeItem('lab-input');
}
