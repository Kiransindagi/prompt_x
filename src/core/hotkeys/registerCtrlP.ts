import { useOverlayStore } from "../../store/overlayStore";

export function registerCtrlP() {
    window.addEventListener('keydown', (e) => {
        // Check for Ctrl+P (or Cmd+P on Mac)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.code === 'KeyP')) {
            e.preventDefault();

            const selection = window.getSelection();
            const text = selection?.toString().trim();

            // Get cursor position or fallback to center
            let x = window.innerWidth / 2;
            let y = window.innerHeight / 2;

            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                // Position specifically near the end of selection or center of it
                if (rect.width > 0 && rect.height > 0) {
                    x = rect.left + (rect.width / 2);
                    y = rect.top + rect.height + 10; // Slightly below
                }
            }

            console.log('[Hotkeys] Ctrl+P detected. Text:', text ? text.substring(0, 20) : 'None');

            // Show Overlay via Store
            // If no text, we still show overlay (maybe for "Type to ask" mode later), 
            // but for V1 we assume text selection or fail gracefully?
            // User request says: "A soft-glowing ∞ symbol appears near the cursor (or center if no selection)"
            // So we always show it.

            useOverlayStore.getState().showOverlay({ x, y }, text || '');
        }
    });
}
