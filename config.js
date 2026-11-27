// Settings for the site. Edit the values here; there is no build step. Loaded before settings.js.
const CONFIG = Object.freeze({
  siteName: 'Northlight Studio',
  healthUrl: 'health.json',              // where the page reads name, version and build date
  exportFilePrefix: 'northlight-export', // start of the file name for "Export all data"
});

if (typeof module !== 'undefined') module.exports = CONFIG;
