use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use tauri::{Manager, PhysicalPosition, PhysicalSize, RunEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg(feature = "bench")]
mod bench;
mod commands;
mod db;
mod error;
mod models;
mod repo;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir().expect("resolve app_data_dir");
            let db_path = data_dir.join("prompt-hub.db");
            let conn = db::open_at(&db_path).expect("open prompt-hub db");
            app.manage(AppState {
                conn: Mutex::new(conn),
                copy_seq: AtomicU64::new(0),
            });

            #[cfg(desktop)]
            {
                // Resize the main window to cover the primary monitor instead
                // of using tauri.conf.json `fullscreen: true`, which on macOS
                // creates a system fullscreen Space (independent space, no
                // alwaysOnTop, transparency disabled — incompatible with
                // spec §1.1 "全屏覆盖窗口浮于所有应用上方不抢焦点").
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(Some(monitor)) = window.primary_monitor() {
                        let size = monitor.size();
                        let pos = monitor.position();
                        let _ = window.set_size(PhysicalSize::new(size.width, size.height));
                        let _ = window.set_position(PhysicalPosition::new(pos.x, pos.y));
                    }

                }

                let toggle = Shortcut::new(Some(Modifiers::ALT), Code::Space);
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, _shortcut, event| {
                            if event.state() != ShortcutState::Pressed {
                                return;
                            }
                            let Some(window) = app.get_webview_window("main") else {
                                return;
                            };
                            // Bump copy_seq so any pending delayed hide from
                            // an earlier copy can't trample this toggle.
                            app.state::<AppState>()
                                .copy_seq
                                .fetch_add(1, Ordering::SeqCst);
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                // System fullscreen Spaces are WindowServer/AppKit
                                // domains, not z-order layers. A plain NSWindow
                                // (Tauri/tao creates TaoWindow, an NSWindow
                                // subclass) is bound to its owning desktop Space
                                // even with CanJoinAllSpaces|FullScreenAuxiliary
                                // — AppKit only honors the NonactivatingPanel
                                // styleMask on NSPanel instances. Empirical
                                // proof: setStyleMask was a silent no-op (mask
                                // 32780 in, 32780 out).
                                //
                                // Fix: isa-swizzle the live NSWindow into NSPanel
                                // before applying NonactivatingPanel. Standard
                                // Tauri workaround used by Linear / Raycast /
                                // Stats.app. Instance size must match (asserted)
                                // — NSPanel adds no ivars over NSWindow so this
                                // is safe across system updates. Tao's focusable
                                // ivar and sendEvent: override are lost; we
                                // don't use either.
                                //
                                // Idempotent across wakes — guard checks the
                                // current class before re-swizzling.
                                #[cfg(target_os = "macos")]
                                {
                                    use objc2::{
                                        ffi::object_setClass,
                                        runtime::{AnyClass, AnyObject},
                                        ClassType,
                                    };
                                    use objc2_app_kit::{
                                        NSPanel, NSStatusWindowLevel, NSView, NSWindow,
                                        NSWindowCollectionBehavior, NSWindowStyleMask,
                                    };
                                    if let Ok(ns_window_ptr) = window.ns_window() {
                                        let ns_object = ns_window_ptr.cast::<AnyObject>();
                                        let old_cls = unsafe { (*ns_object).class() };
                                        let panel_cls = NSPanel::class();
                                        if !std::ptr::eq(old_cls, panel_cls) {
                                            assert_eq!(
                                                old_cls.instance_size(),
                                                panel_cls.instance_size(),
                                                "TaoWindow -> NSPanel isa-swizzle: instance size mismatch"
                                            );
                                            unsafe {
                                                object_setClass(
                                                    ns_object,
                                                    panel_cls as *const AnyClass,
                                                );
                                            }
                                        }
                                        let ns_window =
                                            unsafe { &*(ns_window_ptr as *const NSWindow) };
                                        let ns_panel =
                                            unsafe { &*(ns_window_ptr as *const NSPanel) };
                                        // Floating + becomes-key-only-if-needed are
                                        // the panel-class defaults required for a
                                        // non-stealing overlay (a la NSStatusBar).
                                        ns_panel.setFloatingPanel(true);
                                        ns_panel.setBecomesKeyOnlyIfNeeded(true);
                                        let style_mask = ns_window.styleMask();
                                        ns_window.setStyleMask(
                                            style_mask | NSWindowStyleMask::NonactivatingPanel,
                                        );
                                        // Reset first responder after class swap so
                                        // the WebKit view continues to receive key
                                        // events (otherwise React keyboard pipeline
                                        // goes dark).
                                        if let Ok(ns_view_ptr) = window.ns_view() {
                                            let ns_view =
                                                unsafe { &*(ns_view_ptr as *const NSView) };
                                            ns_window.makeFirstResponder(Some(ns_view));
                                        }
                                        let behavior =
                                            NSWindowCollectionBehavior::CanJoinAllSpaces
                                                | NSWindowCollectionBehavior::FullScreenAuxiliary;
                                        ns_window.setCollectionBehavior(behavior);
                                        ns_window.setLevel(NSStatusWindowLevel);
                                    }
                                }
                                let _ = window.show();
                                // Tao's set_focus() calls activateIgnoringOtherApps:
                                // which actively yanks the window back into the
                                // app's own Space, fighting the non-activating
                                // panel model. Skip it on macOS; orderFrontRegardless
                                // below already surfaces the window without stealing
                                // app activation from the foreground fullscreen app.
                                #[cfg(not(target_os = "macos"))]
                                let _ = window.set_focus();
                                #[cfg(target_os = "macos")]
                                {
                                    use objc2_app_kit::NSWindow;
                                    if let Ok(ns_window_ptr) = window.ns_window() {
                                        let ns_window =
                                            unsafe { &*(ns_window_ptr as *const NSWindow) };
                                        ns_window.orderFrontRegardless();
                                    }
                                }
                            }
                        })
                        .build(),
                )?;
                app.global_shortcut().register(toggle)?;

                #[cfg(feature = "bench")]
                bench::spawn_wake_cycle(app.handle().clone());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_phases,
            commands::list_alignment_phrases,
            commands::list_macros,
            commands::list_scenes_with_children,
            commands::list_recent_usage,
            commands::count_today_usage,
            commands::record_usage,
            commands::hide_window,
            commands::show_window,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            #[cfg(desktop)]
            let _ = app.global_shortcut().unregister_all();
        }
    });
}
