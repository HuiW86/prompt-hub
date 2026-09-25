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

use std::sync::LazyLock;

use objc2::runtime::{AnyClass, AnyObject, Bool, ClassBuilder, Sel};
use objc2::{sel, ClassType};
use objc2_app_kit::{
    NSPanel, NSStatusWindowLevel, NSView, NSWindow, NSWindowCollectionBehavior, NSWindowStyleMask,
};
use tauri::WebviewWindow;

// The one instance variable tao 0.35's TaoWindow declares on top of NSWindow
// (tao src/platform_impl/macos/window.rs, WINDOW_CLASS). tao reads it back by
// name in set_focusable, so the swizzled class must still resolve it.
const TAO_FOCUSABLE_IVAR: &std::ffi::CStr = c"focusable";

// Subclass of NSPanel that force-allows key/main status. A borderless window
// (no Titled style bit) returns NO from the default canBecomeKeyWindow even as
// an NSPanel, so makeKeyWindow is a no-op and no keyboard input ever reaches
// the WebKit view. Overriding these two is the only reliable fix (same approach
// as Raycast / tauri-nspanel).
//
// Built at runtime rather than with define_class! because the class must
// mirror TaoWindow's instance layout: apply_nonactivating_panel isa-swizzles a
// live TaoWindow into it, which is only sound when both classes have the same
// instance size and ivar offsets. An ivar-less NSPanel subclass only matched
// by accident — TaoWindow's 1-byte `focusable` ivar used to fit in NSWindow's
// trailing alignment padding. On macOS 27 that padding is gone (field report:
// TaoWindow 536 bytes vs NSPanel 528), so the old size assert aborted launch.
// Declaring the same ivar on the same-sized superclass reproduces TaoWindow's
// layout on every macOS version by construction.
static KEYABLE_PANEL: LazyLock<&'static AnyClass> = LazyLock::new(|| {
    extern "C-unwind" fn yes(_this: &AnyObject, _sel: Sel) -> Bool {
        Bool::YES
    }

    let mut builder = ClassBuilder::new(c"PromptHubKeyablePanel", NSPanel::class())
        .expect("PromptHubKeyablePanel registered twice");
    builder.add_ivar::<Bool>(TAO_FOCUSABLE_IVAR);
    // SAFETY: signatures match the NSWindow selectors (BOOL, no arguments).
    unsafe {
        builder.add_method(
            sel!(canBecomeKeyWindow),
            yes as extern "C-unwind" fn(_, _) -> _,
        );
        builder.add_method(
            sel!(canBecomeMainWindow),
            yes as extern "C-unwind" fn(_, _) -> _,
        );
    }
    builder.register()
});

// Why an isa-swizzle from `from` into `to` would be unsound, or None if the
// two instance layouts are identical.
fn layout_mismatch(from: &AnyClass, to: &AnyClass) -> Option<String> {
    if from.instance_size() != to.instance_size() {
        return Some(format!(
            "instance size {} != {}",
            from.instance_size(),
            to.instance_size()
        ));
    }
    // The live window is usually not a bare TaoWindow: AppKit KVO swaps in a
    // dynamic NSKVONotifying_TaoWindow subclass with no ivars of its own. So
    // collect every ivar declared between `from` and NSWindow, not just on
    // `from` itself.
    let mut added_ivars = Vec::new();
    let mut cls = Some(from);
    while let Some(c) = cls.filter(|c| !std::ptr::eq(*c, NSWindow::class())) {
        added_ivars.extend(c.instance_variables().iter().map(|i| i.name()));
        cls = c.superclass();
    }
    if cls.is_none() {
        return Some(format!("{:?} is not an NSWindow subclass", from.name()));
    }
    if added_ivars != [TAO_FOCUSABLE_IVAR] {
        return Some(format!(
            "unexpected ivars between {:?} and NSWindow: {added_ivars:?}",
            from.name()
        ));
    }
    let offset = |cls: &AnyClass| {
        cls.instance_variable(TAO_FOCUSABLE_IVAR)
            .map(|i| i.offset())
    };
    if offset(from) != offset(to) {
        return Some(format!(
            "focusable ivar offset {:?} != {:?}",
            offset(from),
            offset(to)
        ));
    }
    None
}

pub fn apply_nonactivating_panel(window: &WebviewWindow) {
    let Ok(ns_window_ptr) = window.ns_window() else {
        return;
    };
    let ns_object = ns_window_ptr.cast::<AnyObject>();
    let ns_object_ref = unsafe { &*ns_object };
    let panel_cls = *KEYABLE_PANEL;
    let old_cls = ns_object_ref.class();
    if !std::ptr::eq(old_cls, panel_cls) {
        // AnyObject::set_class only debug_asserts the size match. Check the
        // full layout ourselves, and on mismatch degrade to a plain floating
        // window instead of panicking: this runs inside
        // applicationDidFinishLaunching, where a panic cannot unwind and
        // aborts the whole app at launch.
        if let Some(reason) = layout_mismatch(old_cls, panel_cls) {
            eprintln!(
                "{:?} -> {:?} isa-swizzle skipped ({reason}); window will not be a non-activating panel",
                old_cls.name(),
                panel_cls.name()
            );
            apply_window_behavior(unsafe { &*(ns_window_ptr as *const NSWindow) });
            focus_view(window);
            return;
        }
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

    apply_window_behavior(ns_window);

    focus_view(window);
}

// The parts of the overlay setup that work on any NSWindow, panel or not.
fn apply_window_behavior(ns_window: &NSWindow) {
    let behavior = NSWindowCollectionBehavior::CanJoinAllSpaces
        | NSWindowCollectionBehavior::FullScreenAuxiliary;
    ns_window.setCollectionBehavior(behavior);
    ns_window.setLevel(NSStatusWindowLevel);
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
