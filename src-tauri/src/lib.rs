// M0-3 wake-latency spike — instrumented Tauri scaffold to validate the
// constitution C1 budget: global-shortcut wake of a transparent always-on-top
// window must stay <= 200ms P95. Measures show()+set_focus() command latency.
//
// Two trigger paths feed the same instrument:
//   - manual:    press Alt+Space to toggle the window
//   - automated: set PROMPT_HUB_WAKE_BENCH=1 to run timed cycles, then exit

use std::io::Write;
use std::sync::Mutex;
use std::thread::sleep;
use std::time::{Duration, Instant};

use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// Wake-show latency samples (microseconds), accumulated across toggles.
static WAKE_SAMPLES: Mutex<Vec<u128>> = Mutex::new(Vec::new());

fn report_wake_latency(micros: u128) {
    let mut samples = WAKE_SAMPLES.lock().expect("wake samples lock poisoned");
    samples.push(micros);
    let mut sorted = samples.clone();
    sorted.sort_unstable();
    let n = sorted.len();
    let p95_idx = (((n as f64) * 0.95).ceil() as usize).clamp(1, n) - 1;
    let p95_ms = sorted[p95_idx] as f64 / 1000.0;
    let last_ms = micros as f64 / 1000.0;
    let verdict = if p95_ms <= 200.0 { "OK" } else { "OVER BUDGET" };
    println!(
        "[wake-spike] n={n} last={last_ms:.2}ms p95={p95_ms:.2}ms / 200ms budget -> {verdict}"
    );
}

// Automated benchmark: cycle the window hidden->shown N times, record the show
// latency of each cycle, then exit. Triggered by PROMPT_HUB_WAKE_BENCH=1.
#[cfg(desktop)]
fn run_wake_bench(app: tauri::AppHandle) {
    const SAMPLES: usize = 40;
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    // Let the event loop settle, then one cold show/hide as warmup (discarded).
    sleep(Duration::from_millis(800));
    let _ = window.show();
    let _ = window.set_focus();
    sleep(Duration::from_millis(250));
    let _ = window.hide();
    sleep(Duration::from_millis(250));

    println!("[wake-spike] automated bench starting — {SAMPLES} samples");
    for _ in 0..SAMPLES {
        let started = Instant::now();
        let _ = window.show();
        let _ = window.set_focus();
        report_wake_latency(started.elapsed().as_micros());
        sleep(Duration::from_millis(150));
        let _ = window.hide();
        sleep(Duration::from_millis(150));
    }
    println!("[wake-spike] automated bench complete");
    let _ = std::io::stdout().flush();
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                let toggle = Shortcut::new(Some(Modifiers::ALT), Code::Space);
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, _shortcut, event| {
                            // Only one shortcut is registered, so any fire is ours.
                            if event.state() != ShortcutState::Pressed {
                                return;
                            }
                            let Some(window) = app.get_webview_window("main") else {
                                return;
                            };
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                                return;
                            }
                            let started = Instant::now();
                            let _ = window.show();
                            let _ = window.set_focus();
                            report_wake_latency(started.elapsed().as_micros());
                        })
                        .build(),
                )?;
                app.global_shortcut().register(toggle)?;
                println!(
                    "[wake-spike] global shortcut Alt+Space registered — press it to toggle the window"
                );

                if std::env::var_os("PROMPT_HUB_WAKE_BENCH").is_some() {
                    let handle = app.handle().clone();
                    std::thread::spawn(move || run_wake_bench(handle));
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
