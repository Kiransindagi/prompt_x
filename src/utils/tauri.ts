export const isTauri = () => !!(window as any).__TAURI_INTERNALS__;

export const safeInvoke = async <T>(command: string, args?: any): Promise<T | null> => {
    if (isTauri()) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            return await invoke<T>(command, args);
        } catch (e) {
            console.error("Tauri invoke error:", e);
        }
    }
    return null;
};

export const safeMinimize = async () => {
    if (isTauri()) {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().minimize();
        } catch (e) {
            console.error("Tauri minimize error:", e);
        }
    }
};

export const safeMaximize = async () => {
    if (isTauri()) {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().toggleMaximize();
        } catch (e) {
            console.error("Tauri maximize error:", e);
        }
    }
};

export const safeFocus = async () => {
    if (isTauri()) {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().setFocus();
        } catch (e) {
            console.error("Tauri focus error:", e);
        }
    }
};
