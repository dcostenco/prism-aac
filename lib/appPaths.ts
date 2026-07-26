export const PRISM_AAC_BASE_PATH = '/prism-aac';
export const PRISM_AAC_MANIFEST_PATH = `${PRISM_AAC_BASE_PATH}/manifest.json`;
export const PRISM_AAC_STATIC_PATH = `${PRISM_AAC_BASE_PATH}/_next/static/`;
export const PRISM_AAC_SERVICE_WORKER_PATH = `${PRISM_AAC_BASE_PATH}/sw.js`;
// No trailing slash: the canonical app document is /prism-aac, so the
// worker must cover that document as well as child routes.
export const PRISM_AAC_SERVICE_WORKER_SCOPE = PRISM_AAC_BASE_PATH;
