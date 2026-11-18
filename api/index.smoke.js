// api/index.ts
var apiHandlerPromise;
function loadApiHandler() {
  if (!apiHandlerPromise) {
    const bundleUrl = new URL("../dist-server/api-handler.js", import.meta.url);
    apiHandlerPromise = import(bundleUrl.href).then((module) => module.default);
  }
  return apiHandlerPromise;
}
async function handler(req, res) {
  const apiHandler = await loadApiHandler();
  return apiHandler(req, res);
}
export {
  handler as default
};
