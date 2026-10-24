import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const src = (dir) => fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

// /api plus the server-rendered reset pages (/password/reset/:token, /student/password/reset/:token).
// /password/forgot and /password/reset (no token) are client routes and stay on Vite.
const proxyFor = (target) =>
  Object.fromEntries(["/api/", "^/(student/)?password/reset/[^/]+"].map((path) => [path, { target }]));

const pkg = (...names) => new RegExp(`[\\\\/]node_modules[\\\\/](${names.join("|")})[\\\\/]`);

const reactShell = pkg(
  "react", "react-dom", "scheduler", "react-router", "react-router-dom", "history", "react-is", "prop-types",
  "object-assign", "@babel/runtime", "classnames", "dom-helpers", "react-transition-group", "react-lifecycles-compat",
);

// Heavy vendors get their own cacheable chunks, loaded only by the (lazy) pages that use them.
// Groups pull in their dependencies, so small libraries shared with the always-loaded shell
// (Header/react-bootstrap, yup) are claimed first by higher-priority groups; otherwise every page
// would have to fetch the charts chunk just for e.g. prop-types or lodash.
const vendorGroups = [
  {
    name: "react",
    priority: 1,
    test: (id) => id.includes("vite/preload-helper") || reactShell.test(id),
  },
  { name: "lodash", priority: 1, test: pkg("lodash") },
  {
    name: "charts",
    test: pkg("d3", "d3-[^/\\\\]+", "internmap", "delaunator", "robust-predicates", "recharts", "recharts-scale", "victory-vendor", "@upsetjs"),
  },
  { name: "slides", test: pkg("reveal\\.js", "@gregcello", "prismjs") },
  { name: "table", test: pkg("react-bootstrap-table-next") },
  // No react-player group: it's imported as react-player/lazy, which already code-splits each site's
  // player (YouTube, Vimeo, ...) into its own chunk; a group would merge them all back together.
];

// @gregcello/revealjs-react re-exports every reveal.js plugin (highlight.js alone is ~940 kB) but the
// guidelines page uses none; reveal.js doesn't declare sideEffects, so mark the plugins droppable.
const revealPluginsSideEffectFree = {
  name: "reveal-plugins-side-effect-free",
  transform: {
    filter: { id: /[\\/]node_modules[\\/]reveal\.js[\\/]plugin[\\/]/ },
    handler: (code) => ({ code, moduleSideEffects: false }),
  },
};

export default defineConfig(({ mode }) => {
  // Backend used by the dev-server proxy (CRA's "proxy" field used to do this).
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = proxyFor(env.VITE_PROXY_TARGET || "http://localhost:3000");

  return {
    plugins: [react(), revealPluginsSideEffectFree],
    resolve: {
      // Absolute imports relative to src/ (jsconfig.json "baseUrl": "src", kept for editors).
      alias: ["assets", "components", "handler", "pages", "provider", "utils"].map((dir) => ({
        find: new RegExp(`^${dir}/`),
        replacement: `${src(dir)}/`,
      })),
    },
    css: {
      preprocessorOptions: {
        scss: {
          // Styles import bootstrap as "node_modules/bootstrap/scss/..." (resolved from client/).
          loadPaths: [fileURLToPath(new URL(".", import.meta.url))],
          // Bootstrap 4 uses @import / global functions deprecated in Dart Sass; silence the noise.
          quietDeps: true,
          silenceDeprecations: [
            "import",
            "global-builtin",
            "color-functions",
            "slash-div",
            "if-function",
          ],
        },
      },
    },
    server: {
      port: 8080,
      strictPort: true,
      proxy,
    },
    preview: {
      port: 8080,
      proxy,
    },
    build: {
      // server.js serves client/build in production.
      outDir: "build",
      // Keep CRA's /static/ asset prefix (server.js access log skips /static/ requests).
      assetsDir: "static",
      sourcemap: false,
      rolldownOptions: {
        output: {
          // Pages are React.lazy() routes (App.jsx); see vendorGroups above.
          codeSplitting: { groups: vendorGroups },
        },
      },
    },
  };
});
