// Admin tab fix: ensures the admin nav appears when admin status loads from server.
// The built-in P.on() listener only calls top(), not render(), so the admin tab
// doesn't appear until manual navigation. This patch adds a proper admin-change listener.
import { Menu } from './ui.js';

const origShow = Menu.prototype.show;
Menu.prototype.show = function () {
  const r = origShow.call(this);
  // Track admin changes and re-render nav when it flips
  let lastAdmin = !!this.P.admin;
  this.P.on(() => {
    const cur = !!this.P.admin;
    if (cur !== lastAdmin) {
      lastAdmin = cur;
      try { this.render(); } catch (e) {}
    }
  });
  return r;
};
