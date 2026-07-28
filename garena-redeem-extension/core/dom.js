(function () {
  'use strict';

  const sleep = window.Pon1147.utils.sleep;

  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };

  const findInput = () =>
    document.querySelector('input.exc-input') ||
    [...document.querySelectorAll('input')].find(
      (el) => visible(el) && !el.disabled && !el.readOnly,
    );

  const findButton = () =>
    document.querySelector('a.btn-exchange, button.btn-exchange, .btn-exchange') ||
    [...document.querySelectorAll('a, button')].find(
      (el) => visible(el) && /đổi|exchange|redeem|confirm|xác nhận/i.test(el.innerText || ''),
    );

  const setValue = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  };

  const clickRedeem = (button) => {
    if (!button) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    button.dispatchEvent(new MouseEvent('pointerdown', opts));
    button.dispatchEvent(new MouseEvent('mousedown', opts));
    button.dispatchEvent(new MouseEvent('pointerup', opts));
    button.dispatchEvent(new MouseEvent('mouseup', opts));
    button.click();
  };

  const getDialogMessage = () => {
    const dialog = [
      ...document.querySelectorAll('[role="dialog"], .dialog, .pop, .popup, .modal, .ant-modal'),
    ].find(visible);
    if (dialog) {
      const text = (dialog.innerText || dialog.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) return { source: 'dialog', text };
    }
    const tip = document.querySelector('#superTips, .super-tips');
    if (tip && (tip.innerText || tip.textContent || '').trim()) {
      return {
        source: 'tip',
        text: (tip.innerText || tip.textContent || '').replace(/\s+/g, ' ').trim(),
      };
    }
    return { source: '', text: '' };
  };

  const closeDialog = () => {
    const dialog = [
      ...document.querySelectorAll('[role="dialog"], .dialog, .pop, .popup, .modal, .ant-modal'),
    ].find(visible);
    if (!dialog) return;
    const closeBtn =
      dialog.querySelector('.ant-modal-close, .close, .btn-close, [aria-label="close"]') ||
      [...dialog.querySelectorAll('a, button')].find(visible);
    if (closeBtn) closeBtn.click();
  };

  const clearOldMessage = async () => {
    const tip = document.querySelector('#superTips, .super-tips');
    if (tip) tip.textContent = '';
    closeDialog();
    await sleep(100);
    if (tip) tip.textContent = '';
    closeDialog();
  };

  window.Pon1147 = window.Pon1147 || {};
  window.Pon1147.dom = {
    findInput,
    findButton,
    setValue,
    clickRedeem,
    getDialogMessage,
    closeDialog,
    clearOldMessage,
  };
})();
