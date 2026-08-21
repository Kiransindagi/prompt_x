use tauri::Manager;
use tauri::Emitter;
use arboard::Clipboard;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState, Shortcut};
use std::{collections::HashMap, str::FromStr, sync::Mutex};
 
use enigo::{Enigo, Key, Keyboard, Settings, Direction};

struct ShortcutActions(Mutex<HashMap<u32, String>>);

fn normalize_shortcut(value: &str) -> String {
    value.replace(' ', "").replace("Command", "SUPER").replace("Cmd", "SUPER").replace("Control", "CTRL")
}

#[tauri::command]
fn configure_shortcuts(
    app: tauri::AppHandle,
    enabled: bool,
    rewrite: String,
    shorten: String,
    expand: String,
) -> Result<(), String> {
    let definitions = [(rewrite, "rewrite"), (shorten, "shorten"), (expand, "expand")];
    let mut shortcuts = Vec::new();
    for (value, action) in definitions {
        let shortcut = Shortcut::from_str(&normalize_shortcut(&value))
            .map_err(|error| format!("Invalid {action} shortcut: {error}"))?;
        shortcuts.push((shortcut, action.to_string()));
    }
    let manager = app.global_shortcut();
    manager.unregister_all().map_err(|error| error.to_string())?;
    let action_state = app.state::<ShortcutActions>();
    let mut actions = action_state.0.lock().map_err(|_| "Shortcut state is unavailable")?;
    actions.clear();
    if enabled {
        for (shortcut, action) in shortcuts {
            manager.register(shortcut).map_err(|error| error.to_string())?;
            actions.insert(shortcut.id(), action);
        }
    }
    Ok(())
}
 
 #[tauri::command]
 fn simulate_paste() {
     let mut enigo = Enigo::new(&Settings::default()).expect("Failed to initialize Enigo");
     // Short sleep to ensure focus has returned to the target app
     std::thread::sleep(std::time::Duration::from_millis(100));
     
     #[cfg(target_os = "macos")]
     {
         let _ = enigo.key(Key::Meta, Direction::Press);
         let _ = enigo.key(Key::Unicode('v'), Direction::Click);
         let _ = enigo.key(Key::Meta, Direction::Release);
     }
     #[cfg(not(target_os = "macos"))]
     {
         let _ = enigo.key(Key::Control, Direction::Press);
         let _ = enigo.key(Key::Unicode('v'), Direction::Click);
         let _ = enigo.key(Key::Control, Direction::Release);
     }
 }

 #[tauri::command]
 fn simulate_copy() {
     let mut enigo = Enigo::new(&Settings::default()).expect("Failed to initialize Enigo");
     
     #[cfg(target_os = "macos")]
     {
         let _ = enigo.key(Key::Meta, Direction::Press);
         let _ = enigo.key(Key::Unicode('c'), Direction::Click);
         let _ = enigo.key(Key::Meta, Direction::Release);
     }
     #[cfg(not(target_os = "macos"))]
     {
         let _ = enigo.key(Key::Control, Direction::Press);
         let _ = enigo.key(Key::Unicode('c'), Direction::Click);
         let _ = enigo.key(Key::Control, Direction::Release);
     }
     // Small sleep to ensure clipboard is populated by the OS
     std::thread::sleep(std::time::Duration::from_millis(150));
 }

#[tauri::command]
fn read_clipboard() -> String {
    match Clipboard::new() {
        Ok(mut clipboard) => clipboard.get_text().unwrap_or_default(),
        Err(e) => {
            println!("Clipboard Init Error: {}", e);
            String::new()
        }
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn debug_log(msg: &str) {
    println!("[FRONTEND] {}", msg);
}

use mouse_position::mouse_position::Mouse as MousePos;
use enigo::Mouse as EnigoMouse;

#[tauri::command]
fn get_mouse_pos() -> (i32, i32) {
    let position = MousePos::get_mouse_position();
    match position {
        MousePos::Position { x, y } => (x, y),
        MousePos::Error => {
            // Fallback to enigo if mouse_position crate fails
            if let Ok(enigo) = Enigo::new(&Settings::default()) {
                if let Ok((x, y)) = enigo.location() {
                    return (x, y);
                }
            }
            (0, 0)
        }
    }
}

#[tauri::command]
fn set_ignore_mouse(app: tauri::AppHandle, ignore: bool) {
    if let Some(window) = app.get_webview_window("main") {
        window.set_ignore_cursor_events(ignore).ok();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app: &tauri::AppHandle, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let action = app.state::<ShortcutActions>().0.lock().ok().and_then(|actions| actions.get(&shortcut.id()).cloned());
                        if let Some(action) = action {
                            if let Some(window) = app.get_webview_window("main") {
                                // We emit the event FIRST. The frontend will simulate copy,
                                // read the clipboard, and THEN steal focus using window.setFocus().
                                // This ensures the background app (like VS Code) actually gets the Ctrl+C!
                                window.emit("trigger-overlay", action).ok();
                            }
                        }
                    }
                })
                .build(),
        )
        .manage(ShortcutActions(Mutex::new(HashMap::new())))
        .setup(|app| {
            configure_shortcuts(app.handle().clone(), true, "Ctrl+P".into(), "Ctrl+S".into(), "Ctrl+E".into())?;

            // Start by ignoring mouse events so background apps work
            if let Some(window) = app.get_webview_window("main") {
                window.set_ignore_cursor_events(true).ok();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, read_clipboard, debug_log, get_mouse_pos, set_ignore_mouse, simulate_paste, simulate_copy, configure_shortcuts])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
