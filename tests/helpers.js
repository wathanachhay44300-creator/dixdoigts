// Charge les scripts du site (sans navigateur) dans un bac à sable, pour les tester avec Node.
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const JS = path.join(__dirname, '..', 'js');

function loadSite(files, opts) {
  opts = opts || {};
  const storage = opts.storage || {};
  const sandbox = {
    localStorage: { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => (storage[k] = String(v)) },
    navigator: { platform: opts.platform || 'MacIntel' },
    document: { addEventListener() {}, createElement: () => ({ getContext: () => ({}) }), hidden: false },
    console,
    setTimeout,
    clearTimeout,
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  vm.createContext(sandbox);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), sandbox, { filename: f });
  sandbox.__storage = storage;
  return sandbox.DD;
}

const SITE_BASE = ['util.js', 'store.js', 'layout.js', 'words.js', 'generator.js', 'curriculum.js'];

module.exports = { loadSite, SITE_BASE };
