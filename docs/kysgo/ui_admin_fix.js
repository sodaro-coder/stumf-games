// Admin tab fix: ensures the admin nav appears when admin status loads from server.
// The profile may load before or after Menu.show() — this handles both cases.
import { Menu } from './ui.js';

const origShow = Menu.prototype.show;
Menu.prototype.show = function () {
  const r = origShow.call(this);
  // If admin is already true but the tab isn't showing, re-render immediately.
  // (Profile loaded before show() was called — the change listener below would never fire.)
  try {
    if (this.P && this.P.admin && !this.adminShown) {
      this.render();
    }
  } catch (e) {}
  // Track admin changes and re-render nav when it flips (profile loads after show).
  let lastAdmin = !!(this.P && this.P.admin);
  this.P.on(() => {
    const cur = !!(this.P && this.P.admin);
    if (cur !== lastAdmin) {
      lastAdmin = cur;
      try { this.render(); } catch (e) {}
    }
  });
  return r;
};
