// Wake-latency auto-bench (cfg(feature = "bench") only).
//
// Replaces the M0-3 inline instrumentation that was stripped in commit
// a14d61e. Spawns an async task that warms up, cycles the platform wake
// path N times, prints JSON-line samples to stdout, then exits the
// process so the harness can collect the binary's output.
//
// macOS uses show() + orderFrontRegardless (mirroring lib.rs wake path
// after the NSPanel isa-swizzle fix); other platforms keep show() +
// set_focus(). Without this split, bench would call activateIgnoringOtherApps
// via set_focus and stop reflecting real ⌥Space behavior.
//
// Scope caveat: measures the Rust call latency only. Does NOT include the
// OS global-shortcut event dispatch (~10ms per M0-3 manual vs automated
// delta). Real ⌥Space P95 = this number + ~10ms.

use std::sync::mpsc;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

const WARMUP_ROUNDS: usize = 5;
const SAMPLE_ROUNDS: usize = 50;
const CYCLE_GAP_MS: u64 = 50;
const STARTUP_DELAY_MS: u64 = 1_000;

pub fn spawn_wake_cycle(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(STARTUP_DELAY_MS)).await;

        if app.get_webview_window("main").is_none() {
            eprintln!("{{\"error\":\"main window missing\"}}");
            app.exit(1);
            return;
        }

        // Warm-up — discards JIT/cache transients without printing samples.
        for _ in 0..WARMUP_ROUNDS {
            wake_sample(&app);
            tokio::time::sleep(Duration::from_millis(CYCLE_GAP_MS)).await;
            hide_main(&app);
            tokio::time::sleep(Duration::from_millis(CYCLE_GAP_MS)).await;
        }

        for round in 0..SAMPLE_ROUNDS {
            match wake_sample(&app) {
                Some(elapsed_us) => {
                    println!("{{\"round\":{},\"show_us\":{}}}", round, elapsed_us)
                }
                None => {
                    eprintln!("{{\"error\":\"wake sample failed\"}}");
                    app.exit(1);
                    return;
                }
            }
            tokio::time::sleep(Duration::from_millis(CYCLE_GAP_MS)).await;
            hide_main(&app);
            tokio::time::sleep(Duration::from_millis(CYCLE_GAP_MS)).await;
        }

        println!("{{\"done\":true}}");
        app.exit(0);
    });
}

// AppKit window APIs are MainThreadOnly (see macos.rs), so the wake call must
// be dispatched onto the main thread. Timing is captured inside the closure to
// keep measuring only the Rust call latency, then handed back over a channel.
fn wake_sample(app: &AppHandle) -> Option<u128> {
    let (tx, rx) = mpsc::channel();
    let app = app.clone();
    app.clone()
        .run_on_main_thread(move || {
            let Some(window) = app.get_webview_window("main") else {
                let _ = tx.send(None);
                return;
            };
            let t0 = Instant::now();
            let _ = window.show();
            #[cfg(not(target_os = "macos"))]
            let _ = window.set_focus();
            #[cfg(target_os = "macos")]
            crate::macos::order_front(&window);
            let _ = tx.send(Some(t0.elapsed().as_micros()));
        })
        .ok()?;
    rx.recv().ok().flatten()
}

fn hide_main(app: &AppHandle) {
    let app = app.clone();
    let _ = app.clone().run_on_main_thread(move || {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.hide();
        }
    });
}
