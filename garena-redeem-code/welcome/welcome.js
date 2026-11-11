// Dynamic extension version from manifest
try {
  const manifest = typeof chrome !== 'undefined' && chrome?.runtime?.getManifest ? chrome.runtime.getManifest() : null;
  if (manifest?.version) {
    const badgeEl = document.querySelector('.hero-badge');
    if (badgeEl) {
      badgeEl.textContent = `🎉 CÀI ĐẶT THÀNH CÔNG · v${manifest.version}`;
    }
  }
} catch (_) {}

// Tab switching logic with full WAI-ARIA and roving tabindex
const tabs = Array.from(document.querySelectorAll('.tab-btn'));
const panels = Array.from(document.querySelectorAll('.tab-content'));

function activateTab(targetBtn) {
  if (!targetBtn) return;
  const targetId = `tab-${targetBtn.dataset.tab}`;

  tabs.forEach((btn) => {
    const isTarget = btn === targetBtn;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    btn.setAttribute('tabindex', isTarget ? '0' : '-1');
  });

  panels.forEach((panel) => {
    const isTarget = panel.id === targetId;
    panel.classList.toggle('active', isTarget);
    if (isTarget) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  });

  targetBtn.focus();
}

tabs.forEach((btn, index) => {
  btn.addEventListener('click', () => {
    activateTab(btn);
  });

  // Arrow key navigation (automatic activation)
  btn.addEventListener('keydown', (e) => {
    let targetIndex = null;

    if (e.key === 'ArrowRight') {
      targetIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      targetIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = tabs.length - 1;
    }

    if (targetIndex !== null) {
      e.preventDefault();
      activateTab(tabs[targetIndex]);
    }
  });
});

// Robust Copy to Clipboard with timer tracking and no text-stuck bug
document.querySelectorAll('.copy-btn').forEach((btn) => {
  // Ensure original text is cached permanently
  if (!btn.dataset.originalText) {
    btn.dataset.originalText = btn.textContent.trim();
  }

  btn.addEventListener('click', async () => {
    const textToCopy = btn.dataset.copy;
    if (!textToCopy) return;

    // Clear any pending timeout from previous rapid clicks
    if (btn._copyTimeout) {
      clearTimeout(btn._copyTimeout);
      btn._copyTimeout = null;
    }

    const originalText = btn.dataset.originalText;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for non-secure / restricted environments
        const tempInput = document.createElement('textarea');
        tempInput.value = textToCopy;
        tempInput.setAttribute('readonly', '');
        tempInput.style.position = 'absolute';
        tempInput.style.left = '-9999px';
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }

      btn.classList.add('copied');
      btn.textContent = '✓ Đã chép!';

      btn._copyTimeout = setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('copied');
        btn._copyTimeout = null;
      }, 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      btn.textContent = 'Lỗi copy!';
      btn._copyTimeout = setTimeout(() => {
        btn.textContent = originalText;
        btn._copyTimeout = null;
      }, 2000);
    }
  });
});
