// Wake-latency auto-bench (cfg(feature = "bench") only).
//
// Replaces the M0-3 inline instrumentation that was stripped in commit
// a14d61e. Same shape: spawn an async task that warms up, cycles
// show()+set_focus()+hide() N times, prints JSON-line samples to stdout,
// then exits the process so the harness can collect the binary's output.
//
// Scope caveat: measures show()+set_focus() Rust call latency. Does NOT
// include the OS global-shortcut event dispatch (~10ms per M0-3 manual
// vs automated delta). Real ⌥Space P95 = this number + ~10ms.

use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

const WARMUP_ROUNDS: usize = 5;
const SAMPLE_ROUNDS: usize = 50;
const CYCLE_GAP_MS: u64 = 50;
const STARTUP_DELAY_MS: u64 = 1_000;

pub fn spawn_wake_cycle(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(STARTUP_DELAY_MS)).await;

        let Some(window) = app.get_webview_window("main") else {
            eprintln!("{{\"error\":\"main window missing\"}}");
            app.exit(1);
            return;
        };

        // Warm-up — discards JIT/cache transients without printing samples.
        for _ in 0..WARMUP_ROUNDS {
            let _ = window.show();
            let _ = window.set_focus();
            tokio::time::sleep(Duration::from_millis(CYCLE_GAP_MS)).await;
            let _ = window.hide();
            tokio::time::sleep(Duration::from_millis(CYCLE_GAP_MS)).await;
        }

        for round in 0..SAMPLE_ROUNDS {
            let t0 = Instant::now();
            let _ = window.show();
            let _ = window.set_focus();
            let elapsed_us = t0.elapsed().as_micros();
            println!("{{\"round\":{},\"show_us\":{}}}", round, elapsed_us);
            tokio::time::sleep(Duration::from_millis(CYCLE_GAP_MS)).await;
            let _ = window.hide();
            tokio::time::sleep(Duration::from_millis(CYCLE_GAP_MS)).await;
        }

        println!("{{\"done\":true}}");
        app.exit(0);
    });
}
