// dsh-krank-studio — a Harness client plugin.
//
// It adds a "Studio" action to the conversation session header. The action opens
// the local prompt studio, which `make studio` serves at http://127.0.0.1:8090.
//
// The module is loaded by the Harness Web Client through its module loader, so it
// uses the loader's wrapper rather than a bundler. The `require` names are the
// packages named by this package's dsh.client.inject (plus React).
window.__ModuleLoader__.load({
    id: "dsh-krank-studio",
    factory: (require) => {
        var module = { exports: {} };
        var exports = module.exports;
        const React = require("react");
        const STUDIO = "http://127.0.0.1:8090/browser/index.html";

        function StudioAction() {
            return React.createElement(
                "button",
                {
                    type: "button",
                    title: "Open the krank prompt studio (make studio)",
                    onClick: () => window.open(STUDIO, "_blank", "noopener"),
                },
                "Studio",
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
                    StudioAction,
                ));
        }

        exports.apply = apply;
        exports.inject = inject;
        return module.exports;
    },
});
