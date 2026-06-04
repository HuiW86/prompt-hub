// macOS NSPanel isa-swizzle helper.
//
// Centralizes the non-activating panel setup so every wake path (setup,
// global shortcut handler, show_window IPC) goes through the same logic.
// Without this, a single set_focus() call on an un-swizzled path would
// undo the cross-Space fix.
//
// Background: tao creates an NSWindow subclass (TaoWindow). AppKit only
// honors the NonactivatingPanel styleMask on NSPanel instances, so we
// isa-swizzle the live NSWindow into NSPanel before applying it. Standard
// Tauri workaround used by Linear / Raycast / Stats.app. See ADR-008
// (macos-private-api) and the commit message of 3c736c5 for context.
//
// Threading: AppKit setters (setStyleMask / setLevel / setCollectionBehavior
// etc.) are MainThreadOnly per objc2-app-kit. Callers must invoke this from
// the main thread; in worker-thread contexts wrap with
// app.run_on_main_thread().

use objc2::runtime::AnyObject;
use objc2::{define_class, ClassType};
use objc2_app_kit::{
    NSPanel, NSStatusWindowLevel, NSView, NSWindow, NSWindowCollectionBehavior, NSWindowStyleMask,
};
use tauri::WebviewWindow;

define_class!(
    // Subclass of NSPanel that force-allows key/main status. A borderless
    // window (no Titled style bit) returns NO from the default
    // canBecomeKeyWindow even as an NSPanel, so makeKeyWindow is a no-op and
    // no keyboard input ever reaches the WebKit view. Overriding these two is
    // the only reliable fix (same approach as Raycast / tauri-nspanel).
    //
    // SAFETY: adds no instance variables, so instance_size stays equal to
    // NSPanel's — required because apply_nonactivating_panel isa-swizzles a
    // live TaoWindow into this class instead of allocating it normally.
    #[unsafe(super(NSPanel))]
    #[name = "PromptHubKeyablePanel"]
    struct KeyablePanel;

    impl KeyablePanel {
        #[unsafe(method(canBecomeKeyWindow))]
        fn can_become_key_window(&self) -> bool {
            true
        }

        #[unsafe(method(canBecomeMainWindow))]
        fn can_become_main_window(&self) -> bool {
            true
        }
    }
);

pub fn apply_nonactivating_panel(window: &WebviewWindow) {
    let Ok(ns_window_ptr) = window.ns_window() else {
        return;
    };
    let ns_object = ns_window_ptr.cast::<AnyObject>();
    let ns_object_ref = unsafe { &*ns_object };
    let panel_cls = KeyablePanel::class();
    let old_cls = ns_object_ref.class();
    if !std::ptr::eq(old_cls, panel_cls) {
        // Release-build assert: AnyObject::set_class only debug_asserts the
        // size match. Keep our own check so a future macOS that grows NSPanel
        // fail-fasts in production rather than corrupting memory.
        assert_eq!(
            old_cls.instance_size(),
            panel_cls.instance_size(),
            "TaoWindow -> KeyablePanel isa-swizzle: instance size mismatch"
        );
        unsafe {
            AnyObject::set_class(ns_object_ref, panel_cls);
        }
    }

    let ns_window = unsafe { &*(ns_window_ptr as *const NSWindow) };
    let ns_panel = unsafe { &*(ns_window_ptr as *const NSPanel) };

    // Floating keeps the overlay above normal windows. becomesKeyOnlyIfNeeded
    // must stay false: when true, AppKit only promotes the panel to key for
    // controls that report needsPanelToBecomeKey, which a WKWebView's inner
    // text fields do not — so clicking the search box would never make the
    // panel key and keyboard input would never reach the web content.
    ns_panel.setFloatingPanel(true);
    ns_panel.setBecomesKeyOnlyIfNeeded(false);

    let style_mask = ns_window.styleMask();
    ns_window.setStyleMask(style_mask | NSWindowStyleMask::NonactivatingPanel);

    let behavior = NSWindowCollectionBehavior::CanJoinAllSpaces
        | NSWindowCollectionBehavior::FullScreenAuxiliary;
    ns_window.setCollectionBehavior(behavior);
    ns_window.setLevel(NSStatusWindowLevel);

    focus_view(window);
}

pub fn order_front(window: &WebviewWindow) {
    let Ok(ns_window_ptr) = window.ns_window() else {
        return;
    };
    let ns_window = unsafe { &*(ns_window_ptr as *const NSWindow) };
    ns_window.orderFrontRegardless();
}

// AppKit delivers keyboard events only to the key window; orderFrontRegardless
// surfaces the panel but does not make it key, so without this every wake left
// the WebKit view unable to receive typing or in-app shortcuts. makeKeyWindow
// (vs tao's set_focus, which also calls activateIgnoringOtherApps:) promotes a
// NonactivatingPanel to key without activating the app, preserving the
// "float above all apps without stealing focus" model.
pub fn make_key(window: &WebviewWindow) {
    let Ok(ns_window_ptr) = window.ns_window() else {
        return;
    };
    let ns_window = unsafe { &*(ns_window_ptr as *const NSWindow) };
    ns_window.makeKeyWindow();
}

// Single wake sequence shared by every show path (global shortcut + show_window
// IPC) so the order/key/first-responder steps can't drift between call sites.
// Order matters: surface, become key, then target the WebKit view.
pub fn wake(window: &WebviewWindow) {
    order_front(window);
    make_key(window);
    focus_view(window);
}

// AppKit resets firstResponder across orderOut → orderIn cycles, so every
// wake must re-target the WebKit view. Without this the React document
// keydown listeners (⌘1 / ⌘2 / ⌘K) go dark after the first hide.
pub fn focus_view(window: &WebviewWindow) {
    let Ok(ns_window_ptr) = window.ns_window() else {
        return;
    };
    let Ok(ns_view_ptr) = window.ns_view() else {
        return;
    };
    let ns_window = unsafe { &*(ns_window_ptr as *const NSWindow) };
    let ns_view = unsafe { &*(ns_view_ptr as *const NSView) };
    ns_window.makeFirstResponder(Some(ns_view));
}
