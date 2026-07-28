(function () {
  'use strict';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const log = (level, msg, extra = '') => {
    const ts = new Date().toLocaleTimeString();
    const color =
      { INFO: '#4fc3f7', SUCCESS: '#66bb6a', WARN: '#ffb74d', ERROR: '#ef5350' }[level] || '#fff';
    console.log(
      `%c[${ts}] [${level}]%c ${msg} ${extra}`,
      `color:${color};font-weight:bold`,
      'color:inherit',
    );
  };

  window.Pon1147 = window.Pon1147 || {};
  window.Pon1147.utils = { sleep, log };
})();
