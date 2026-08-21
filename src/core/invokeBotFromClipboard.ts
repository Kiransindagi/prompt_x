import { useOverlayStore } from "../store/overlayStore";
import { useSettingsStore } from '../store/settingsStore';

export async function registerGlobalTrigger() {
    if (!(window as any).__TAURI_INTERNALS__) return;
    
    const { listen } = await import("@tauri-apps/api/event");
    const { invoke } = await import("@tauri-apps/api/core");
    const { getCurrentWindow } = await import("@tauri-apps/api/window");

    console.log("[GlobalTrigger] Registering listener...");

    const unlisten = await listen<string>("trigger-overlay", async (event) => {
        if (!useSettingsStore.getState().enableGlobalShortcuts) return;
        const action = event.payload === 'shorten' || event.payload === 'expand' ? event.payload : 'rewrite';
        console.log("[GlobalTrigger] Ctrl+P detected via Rust!");

        // 1. Simulate Ctrl+C to copy selected text
        try {
            await invoke("simulate_copy");
        } catch (e) {
            console.error("[GlobalTrigger] Failed to simulate copy:", e);
        }

        // 2. Read Clipboard
        let text = "";
        try {
            text = await invoke<string>("read_clipboard");
        } catch (e) {
            console.error("[GlobalTrigger] Failed to read clipboard:", e);
        }

        console.log("[GlobalTrigger] Clipboard text:", text ? text.substring(0, 50) + "..." : "Empty");

        // 3. Focus Window (Crucial)
        try {
            await getCurrentWindow().show();
            await getCurrentWindow().unminimize();
            await getCurrentWindow().setFocus();
        } catch (e) {
            console.error("[GlobalTrigger] Failed to focus window:", e);
        }

        // 4. Show Overlay & Invoke Brain
        if (text && text.trim()) {
            let x = window.innerWidth / 2;
            let y = window.innerHeight / 2;

            try {
                // Get global mouse coordinates from Rust
                const pos = await invoke<[number, number]>("get_mouse_pos");
                if (pos && pos.length === 2 && (pos[0] !== 0 || pos[1] !== 0)) {
                    // Rust returns physical pixels, so we keep physical pixels
                    x = pos[0];
                    y = pos[1];
                }
            } catch (e) {
                console.error("[GlobalTrigger] Failed to get global mouse pos:", e);
            }

            useOverlayStore.getState().showOverlay({ x, y }, text, action);
        } else {
            // Just show overlay if empty (optional, but good UX)
            const x = window.innerWidth / 2;
            const y = window.innerHeight / 2;
            useOverlayStore.getState().showOverlay({ x, y }, "", action);
        }
    });
    return unlisten;
}
