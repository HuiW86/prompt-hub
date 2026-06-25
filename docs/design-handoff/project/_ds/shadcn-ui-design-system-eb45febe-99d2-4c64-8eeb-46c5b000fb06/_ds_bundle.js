/* @ds-bundle: {"format":3,"namespace":"ShadcnUiDesignSystem_eb45fe","components":[{"name":"Badge","sourcePath":"components/buttons/Badge.jsx"},{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"Alert","sourcePath":"components/display/Alert.jsx"},{"name":"AlertTitle","sourcePath":"components/display/Alert.jsx"},{"name":"AlertDescription","sourcePath":"components/display/Alert.jsx"},{"name":"Avatar","sourcePath":"components/display/Avatar.jsx"},{"name":"AvatarImage","sourcePath":"components/display/Avatar.jsx"},{"name":"AvatarFallback","sourcePath":"components/display/Avatar.jsx"},{"name":"Card","sourcePath":"components/display/Card.jsx"},{"name":"CardHeader","sourcePath":"components/display/Card.jsx"},{"name":"CardTitle","sourcePath":"components/display/Card.jsx"},{"name":"CardDescription","sourcePath":"components/display/Card.jsx"},{"name":"CardContent","sourcePath":"components/display/Card.jsx"},{"name":"CardFooter","sourcePath":"components/display/Card.jsx"},{"name":"Separator","sourcePath":"components/display/Separator.jsx"},{"name":"Tabs","sourcePath":"components/display/Tabs.jsx"},{"name":"TabsList","sourcePath":"components/display/Tabs.jsx"},{"name":"TabsTrigger","sourcePath":"components/display/Tabs.jsx"},{"name":"TabsContent","sourcePath":"components/display/Tabs.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Label","sourcePath":"components/forms/Label.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"}],"sourceHashes":{"components/buttons/Badge.jsx":"5ff23c92a5f5","components/buttons/Button.jsx":"6c72d1e724ee","components/display/Alert.jsx":"8b14d1e9bae1","components/display/Avatar.jsx":"21f7f74533c4","components/display/Card.jsx":"a96b3fa4edbe","components/display/Separator.jsx":"abcbed2ae1ea","components/display/Tabs.jsx":"d35ae881a3de","components/forms/Checkbox.jsx":"63ddc5999d83","components/forms/Input.jsx":"65295fd59f1a","components/forms/Label.jsx":"4ba35d2700a1","components/forms/Switch.jsx":"5e779eea4860","components/forms/Textarea.jsx":"8dd9d18f1360","ui_kits/dashboard/RecentTable.jsx":"fbef87913510","ui_kits/dashboard/RevenueChart.jsx":"436f55ad9d7d","ui_kits/dashboard/Sidebar.jsx":"669d5a527a66","ui_kits/dashboard/StatCards.jsx":"9f09c9e68a8c","ui_kits/dashboard/Topbar.jsx":"9e75236d1297"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ShadcnUiDesignSystem_eb45fe = window.ShadcnUiDesignSystem_eb45fe || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/buttons/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Badge — compact status / category label. Variants: default, secondary,
 * destructive, outline.
 */
function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-badge", `ui-badge--${variant}`, className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    "data-slot": "badge"
  }, props), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Badge.jsx", error: String((e && e.message) || e) }); }

// components/buttons/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Button — shadcn/ui (new-york). Variants: default, destructive, outline,
 * secondary, ghost, link. Sizes: default, xs, sm, lg, icon, icon-sm, icon-lg.
 */
function Button({
  variant = "default",
  size = "default",
  className = "",
  type = "button",
  children,
  ...props
}) {
  const cls = ["ui-btn", `ui-btn--${variant}`, size !== "default" ? `ui-btn--${size}` : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: cls,
    "data-slot": "button"
  }, props), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/display/Alert.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Alert — callout box. Variants: default, destructive. */
function Alert({
  variant = "default",
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-alert", variant !== "default" ? `ui-alert--${variant}` : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "alert",
    className: cls,
    "data-slot": "alert"
  }, props), children);
}
function AlertTitle({
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-alert__title", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    "data-slot": "alert-title"
  }, props), children);
}
function AlertDescription({
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-alert__description", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    "data-slot": "alert-description"
  }, props), children);
}
Object.assign(__ds_scope, { Alert, AlertTitle, AlertDescription });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Alert.jsx", error: String((e && e.message) || e) }); }

// components/display/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Avatar — user image with text fallback. Sizes: default, sm, lg. */
function Avatar({
  size = "default",
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-avatar", size !== "default" ? `ui-avatar--${size}` : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    "data-slot": "avatar"
  }, props), children);
}
function AvatarImage({
  className = "",
  alt = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("img", _extends({
    className: className,
    alt: alt,
    "data-slot": "avatar-image"
  }, props));
}
function AvatarFallback({
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-avatar__fallback", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    "data-slot": "avatar-fallback"
  }, props), children);
}
Object.assign(__ds_scope, { Avatar, AvatarImage, AvatarFallback });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/display/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Card — bordered surface container with optional sub-parts. */
function Card({
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-card", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    "data-slot": "card"
  }, props), children);
}
function CardHeader({
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-card__header", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    "data-slot": "card-header"
  }, props), children);
}
function CardTitle({
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-card__title", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    "data-slot": "card-title"
  }, props), children);
}
function CardDescription({
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-card__description", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    "data-slot": "card-description"
  }, props), children);
}
function CardContent({
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-card__content", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    "data-slot": "card-content"
  }, props), children);
}
function CardFooter({
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-card__footer", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    "data-slot": "card-footer"
  }, props), children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Card.jsx", error: String((e && e.message) || e) }); }

// components/display/Separator.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Separator — thin divider line. */
function Separator({
  orientation = "horizontal",
  className = "",
  ...props
}) {
  const cls = ["ui-separator", `ui-separator--${orientation}`, className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "separator",
    "aria-orientation": orientation,
    className: cls,
    "data-slot": "separator"
  }, props));
}
Object.assign(__ds_scope, { Separator });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Separator.jsx", error: String((e && e.message) || e) }); }

// components/display/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TabsContext = React.createContext(null);

/** Tabs — controlled or uncontrolled tab group. */
function Tabs({
  defaultValue,
  value,
  onValueChange,
  className = "",
  children,
  ...props
}) {
  const [internal, setInternal] = React.useState(defaultValue);
  const active = value !== undefined ? value : internal;
  const setActive = v => {
    if (value === undefined) setInternal(v);
    onValueChange?.(v);
  };
  const cls = ["ui-tabs", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement(TabsContext.Provider, {
    value: {
      active,
      setActive
    }
  }, /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    "data-slot": "tabs"
  }, props), children));
}
function TabsList({
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-tabs__list", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    className: cls,
    "data-slot": "tabs-list"
  }, props), children);
}
function TabsTrigger({
  value,
  className = "",
  children,
  ...props
}) {
  const ctx = React.useContext(TabsContext);
  const selected = ctx?.active === value;
  const cls = ["ui-tabs__trigger", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "tab",
    "aria-selected": selected,
    "data-state": selected ? "active" : "inactive",
    className: cls,
    "data-slot": "tabs-trigger",
    onClick: () => ctx?.setActive(value)
  }, props), children);
}
function TabsContent({
  value,
  className = "",
  children,
  ...props
}) {
  const ctx = React.useContext(TabsContext);
  if (ctx?.active !== value) return null;
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tabpanel",
    className: className,
    "data-slot": "tabs-content"
  }, props), children);
}
Object.assign(__ds_scope, { Tabs, TabsList, TabsTrigger, TabsContent });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Checkbox — native checkbox styled as shadcn check. */
function Checkbox({
  className = "",
  ...props
}) {
  const cls = ["ui-checkbox", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    className: cls,
    "data-slot": "checkbox"
  }, props));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Input — single-line text field. */
function Input({
  className = "",
  type = "text",
  ...props
}) {
  const cls = ["ui-input", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    className: cls,
    "data-slot": "input"
  }, props));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Label.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Label — form field label. Use htmlFor to bind to a control id. */
function Label({
  className = "",
  children,
  ...props
}) {
  const cls = ["ui-label", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("label", _extends({
    className: cls,
    "data-slot": "label"
  }, props), children);
}
Object.assign(__ds_scope, { Label });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Label.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Switch — native checkbox styled as a sliding toggle. */
function Switch({
  className = "",
  ...props
}) {
  const cls = ["ui-switch", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    role: "switch",
    className: cls,
    "data-slot": "switch"
  }, props));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Textarea — multi-line text field. */
function Textarea({
  className = "",
  ...props
}) {
  const cls = ["ui-textarea", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("textarea", _extends({
    className: cls,
    "data-slot": "textarea"
  }, props));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/RecentTable.jsx
try { (() => {
// RecentTable — recent documents table with status badges and avatars.
function RecentTable() {
  const {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    Badge,
    Avatar,
    AvatarImage,
    AvatarFallback,
    Button
  } = window.ShadcnUiDesignSystem_eb45fe;
  const rows = [{
    name: "Cover page",
    type: "Narrative",
    status: "In Process",
    target: "18",
    limit: "5",
    who: "01.png",
    init: "EH"
  }, {
    name: "Table of contents",
    type: "Narrative",
    status: "Done",
    target: "29",
    limit: "24",
    who: "02.png",
    init: "JL"
  }, {
    name: "Executive summary",
    type: "Narrative",
    status: "Done",
    target: "10",
    limit: "13",
    who: "03.png",
    init: "AR"
  }, {
    name: "Technical approach",
    type: "Technical",
    status: "In Process",
    target: "27",
    limit: "23",
    who: "04.png",
    init: "MK"
  }, {
    name: "Capabilities",
    type: "Technical",
    status: "Done",
    target: "12",
    limit: "16",
    who: "shadcn.jpg",
    init: "CN"
  }];
  return /*#__PURE__*/React.createElement(Card, {
    className: "dk-table-card"
  }, /*#__PURE__*/React.createElement(CardHeader, {
    className: "dk-table-head"
  }, /*#__PURE__*/React.createElement(CardTitle, null, "Recent Documents"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "plus"
  }), " Add Section")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("table", {
    className: "dk-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Header"), /*#__PURE__*/React.createElement("th", null, "Type"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", {
    className: "dk-num"
  }, "Target"), /*#__PURE__*/React.createElement("th", {
    className: "dk-num"
  }, "Limit"), /*#__PURE__*/React.createElement("th", null, "Reviewer"))), /*#__PURE__*/React.createElement("tbody", null, rows.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.name
  }, /*#__PURE__*/React.createElement("td", {
    className: "dk-td-name"
  }, r.name), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
    variant: "outline"
  }, r.type)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "dk-status"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": r.status === "Done" ? "circle-check" : "loader",
    className: r.status === "Done" ? "dk-ic-done" : "dk-ic-prog"
  }), r.status)), /*#__PURE__*/React.createElement("td", {
    className: "dk-num"
  }, r.target), /*#__PURE__*/React.createElement("td", {
    className: "dk-num"
  }, r.limit), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "dk-reviewer"
  }, /*#__PURE__*/React.createElement(Avatar, {
    size: "sm"
  }, /*#__PURE__*/React.createElement(AvatarImage, {
    src: "../../assets/avatars/" + r.who,
    alt: ""
  }), /*#__PURE__*/React.createElement(AvatarFallback, null, r.init))))))))));
}
window.RecentTable = RecentTable;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/RecentTable.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/RevenueChart.jsx
try { (() => {
// RevenueChart — simple bar chart in a Card with Tabs range switch.
function RevenueChart() {
  const {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    Tabs,
    TabsList,
    TabsTrigger
  } = window.ShadcnUiDesignSystem_eb45fe;
  const data = [40, 62, 48, 70, 55, 82, 67, 90, 76, 95, 84, 72];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const max = Math.max(...data);
  return /*#__PURE__*/React.createElement(Card, {
    className: "dk-chart-card"
  }, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement("div", {
    className: "dk-chart-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(CardTitle, null, "Total Visitors"), /*#__PURE__*/React.createElement(CardDescription, null, "Total for the last 12 months")), /*#__PURE__*/React.createElement(Tabs, {
    defaultValue: "year"
  }, /*#__PURE__*/React.createElement(TabsList, null, /*#__PURE__*/React.createElement(TabsTrigger, {
    value: "quarter"
  }, "3M"), /*#__PURE__*/React.createElement(TabsTrigger, {
    value: "half"
  }, "6M"), /*#__PURE__*/React.createElement(TabsTrigger, {
    value: "year"
  }, "12M"))))), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    className: "dk-chart"
  }, data.map((v, i) => /*#__PURE__*/React.createElement("div", {
    className: "dk-bar-col",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-bar",
    style: {
      height: v / max * 100 + "%"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "dk-bar-label"
  }, months[i]))))));
}
window.RevenueChart = RevenueChart;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/RevenueChart.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Sidebar.jsx
try { (() => {
// Sidebar — product nav rail for the dashboard kit.
function Sidebar({
  active,
  onSelect
}) {
  const {
    Avatar,
    AvatarImage,
    AvatarFallback
  } = window.ShadcnUiDesignSystem_eb45fe;
  const nav = [{
    id: "dashboard",
    icon: "layout-dashboard",
    label: "Dashboard"
  }, {
    id: "lifecycle",
    icon: "list-todo",
    label: "Lifecycle"
  }, {
    id: "analytics",
    icon: "chart-line",
    label: "Analytics"
  }, {
    id: "projects",
    icon: "folder",
    label: "Projects"
  }, {
    id: "team",
    icon: "users",
    label: "Team"
  }];
  const tools = [{
    id: "settings",
    icon: "settings",
    label: "Settings"
  }, {
    id: "help",
    icon: "circle-help",
    label: "Get Help"
  }];
  return /*#__PURE__*/React.createElement("aside", {
    className: "dk-sidebar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-brand"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-mark.png",
    alt: "",
    className: "dk-brand-mark"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dk-brand-word"
  }, "shadcn", /*#__PURE__*/React.createElement("span", {
    className: "dk-brand-slash"
  }, "/ui"))), /*#__PURE__*/React.createElement("nav", {
    className: "dk-nav"
  }, nav.map(n => /*#__PURE__*/React.createElement("button", {
    key: n.id,
    className: "dk-nav-item" + (active === n.id ? " is-active" : ""),
    onClick: () => onSelect(n.id)
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": n.icon
  }), /*#__PURE__*/React.createElement("span", null, n.label)))), /*#__PURE__*/React.createElement("div", {
    className: "dk-nav dk-nav--bottom"
  }, tools.map(n => /*#__PURE__*/React.createElement("button", {
    key: n.id,
    className: "dk-nav-item"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": n.icon
  }), /*#__PURE__*/React.createElement("span", null, n.label)))), /*#__PURE__*/React.createElement("div", {
    className: "dk-user"
  }, /*#__PURE__*/React.createElement(Avatar, {
    size: "sm"
  }, /*#__PURE__*/React.createElement(AvatarImage, {
    src: "../../assets/avatars/shadcn.jpg",
    alt: "shadcn"
  }), /*#__PURE__*/React.createElement(AvatarFallback, null, "CN")), /*#__PURE__*/React.createElement("div", {
    className: "dk-user-meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-user-name"
  }, "shadcn"), /*#__PURE__*/React.createElement("div", {
    className: "dk-user-mail"
  }, "m@example.com")), /*#__PURE__*/React.createElement("i", {
    "data-lucide": "chevrons-up-down",
    className: "dk-user-caret"
  })));
}
window.Sidebar = Sidebar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/StatCards.jsx
try { (() => {
// StatCards — KPI metric row using Card + Badge.
function StatCards() {
  const {
    Card,
    CardHeader,
    CardDescription,
    CardTitle,
    CardFooter,
    Badge
  } = window.ShadcnUiDesignSystem_eb45fe;
  const stats = [{
    label: "Total Revenue",
    value: "$1,250.00",
    delta: "+12.5%",
    up: true,
    note: "Trending up this month"
  }, {
    label: "New Customers",
    value: "1,234",
    delta: "-20%",
    up: false,
    note: "Down 20% this period"
  }, {
    label: "Active Accounts",
    value: "45,678",
    delta: "+12.5%",
    up: true,
    note: "Strong user retention"
  }, {
    label: "Growth Rate",
    value: "4.5%",
    delta: "+4.5%",
    up: true,
    note: "Steady performance increase"
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "dk-stats"
  }, stats.map(s => /*#__PURE__*/React.createElement(Card, {
    key: s.label,
    className: "dk-stat"
  }, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardDescription, null, s.label), /*#__PURE__*/React.createElement(CardTitle, {
    className: "dk-stat-value"
  }, s.value), /*#__PURE__*/React.createElement("div", {
    className: "dk-stat-action"
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "outline"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": s.up ? "trending-up" : "trending-down"
  }), s.delta))), /*#__PURE__*/React.createElement(CardFooter, {
    className: "dk-stat-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dk-stat-note"
  }, s.note, " ", /*#__PURE__*/React.createElement("i", {
    "data-lucide": s.up ? "trending-up" : "trending-down"
  }))))));
}
window.StatCards = StatCards;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/StatCards.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Topbar.jsx
try { (() => {
// Topbar — page header with title, search, theme toggle, actions.
function Topbar({
  title,
  dark,
  onToggleTheme
}) {
  const {
    Input,
    Button
  } = window.ShadcnUiDesignSystem_eb45fe;
  return /*#__PURE__*/React.createElement("header", {
    className: "dk-topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-topbar-left"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "dk-title"
  }, title)), /*#__PURE__*/React.createElement("div", {
    className: "dk-topbar-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dk-search"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "search"
  }), /*#__PURE__*/React.createElement(Input, {
    placeholder: "Search\u2026"
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "icon",
    onClick: onToggleTheme,
    "aria-label": "Toggle theme"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": dark ? "sun" : "moon"
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "icon",
    "aria-label": "Notifications"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "bell"
  })), /*#__PURE__*/React.createElement(Button, {
    size: "sm"
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "plus"
  }), "Quick Create")));
}
window.Topbar = Topbar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Topbar.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.AlertTitle = __ds_scope.AlertTitle;

__ds_ns.AlertDescription = __ds_scope.AlertDescription;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.AvatarImage = __ds_scope.AvatarImage;

__ds_ns.AvatarFallback = __ds_scope.AvatarFallback;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardTitle = __ds_scope.CardTitle;

__ds_ns.CardDescription = __ds_scope.CardDescription;

__ds_ns.CardContent = __ds_scope.CardContent;

__ds_ns.CardFooter = __ds_scope.CardFooter;

__ds_ns.Separator = __ds_scope.Separator;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.TabsList = __ds_scope.TabsList;

__ds_ns.TabsTrigger = __ds_scope.TabsTrigger;

__ds_ns.TabsContent = __ds_scope.TabsContent;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

})();
