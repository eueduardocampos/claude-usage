use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

fn toggle_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Janela transparente: o "vidro" é feito em CSS (backdrop-filter sobre o
            // desktop), o que dá um regulador de transparência ajustável no widget.

            // ---- Ícone na barra de menu ----
            let toggle_i = MenuItem::with_id(app, "toggle", "Mostrar / Ocultar", true, None::<&str>)?;
            let on_top_i = CheckMenuItem::with_id(
                app,
                "on_top",
                "Sempre no topo",
                true,
                true,
                None::<&str>,
            )?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Sair", true, Some("Cmd+Q"))?;
            let menu = Menu::with_items(app, &[&toggle_i, &on_top_i, &sep, &quit_i])?;

            let on_top_handle = on_top_i.clone();
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .tooltip("Consumo do Claude")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "toggle" => toggle_main(app),
                    "on_top" => {
                        let next = on_top_handle.is_checked().unwrap_or(true);
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.set_always_on_top(next);
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
