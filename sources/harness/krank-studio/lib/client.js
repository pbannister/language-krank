// dsh-krank-studio — a Harness client plugin.
//
// It adds a "Krank" action to the conversation session header. The action opens
// the local prompt studio in a full-viewport dialog over the Harness. The studio
// remains the standalone renderer served by `make studio`; this module is a
// launcher and host, not a second implementation.
//
// The module is loaded by the Harness Web Client through its module loader, so it
// uses the loader's wrapper rather than a bundler. The `require` names are the
// packages named by this package's dsh.client.inject (plus React and React DOM).
window.__ModuleLoader__.load({
    id: "dsh-krank-studio",
    factory: (require) => {
        var module = { exports: {} };
        var exports = module.exports;
        const React = require("react");
        const ReactDOM = require("react-dom");
        const STUDIO = "http://127.0.0.1:8090/browser/index.html";

        const overlay_style = {
            position: "fixed",
            inset: "0",
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        };

        const panel_style = {
            width: "min(96vw, 1600px)",
            height: "94vh",
            background: "Canvas",
            color: "CanvasText",
            border: "1px solid ButtonBorder",
            borderRadius: "0.45rem",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 1rem 4rem rgba(0, 0, 0, 0.35)",
        };

        const bar_style = {
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.55rem 0.8rem",
            borderBottom: "1px solid color-mix(in srgb, Canvas 78%, CanvasText 22%)",
        };

        function KrankPanel({ open, onClose }) {
            const close_ref = React.useRef(null);
            React.useEffect(() => {
                if (!open) {
                    return undefined;
                }
                close_ref.current?.focus();
                const on_key = (event) => {
                    if (event.key === "Escape") {
                        onClose();
                    }
                };
                window.addEventListener("keydown", on_key);
                return () => window.removeEventListener("keydown", on_key);
            }, [open, onClose]);
            return ReactDOM.createPortal(
                React.createElement(
                    "div",
                    { style: { ...overlay_style, display: open ? "flex" : "none" } },
                    React.createElement(
                        "div",
                        {
                            style: panel_style,
                            role: "dialog",
                            "aria-modal": "true",
                            "aria-label": "Krank prompt studio",
                        },
                        React.createElement(
                            "div",
                            { style: bar_style },
                            React.createElement("strong", null, "Krank prompt studio"),
                            React.createElement(
                                "a",
                                { href: STUDIO, target: "_blank", rel: "noopener noreferrer" },
                                "Open in new tab",
                            ),
                            React.createElement("span", { style: { flex: "1 1 auto" } }),
                            React.createElement(
                                "button",
                                { ref: close_ref, type: "button", "aria-label": "Close the Krank prompt studio", onClick: onClose },
                                "Close",
                            ),
                        ),
                        React.createElement("iframe", {
                            src: STUDIO,
                            title: "Krank prompt studio",
                            style: { flex: "1 1 auto", width: "100%", border: "0", background: "white" },
                            allow: "clipboard-read; clipboard-write",
                            sandbox: "allow-scripts allow-same-origin allow-forms allow-downloads allow-popups",
                        }),
                    ),
                ),
                document.body,
            );
        }

        function KrankAction() {
            const [is_open, set_open] = React.useState(false);
            const [has_opened, set_has_opened] = React.useState(false);
            const button_ref = React.useRef(null);
            const close = React.useCallback(() => {
                set_open(false);
                button_ref.current?.focus();
            }, []);
            return React.createElement(
                React.Fragment,
                null,
                React.createElement(
                    "button",
                    {
                        ref: button_ref,
                        type: "button",
                        title: is_open ? "Close the krank prompt studio" : "Open the krank prompt studio",
                        "aria-expanded": String(is_open),
                        "aria-haspopup": "dialog",
                        onClick: () => {
                            if (!is_open) {
                                set_has_opened(true);
                            }
                            set_open((value) => !value);
                        },
                    },
                    "Krank",
                ),
                has_opened ? React.createElement(KrankPanel, { open: is_open, onClose: close }) : null,
            );
        }

        const inject = ["slots"];

        function apply(ctx) {
            ctx.slots.inject("conversation.session.header.actions", () =>
                ctx.slots.register(
                    {
                        name: "conversation.session.header.actions",
                        id: "krank-studio",
                        order: 100,
                    },
                    KrankAction,
                ));
        }

        exports.apply = apply;
        exports.inject = inject;
        return module.exports;
    },
});
