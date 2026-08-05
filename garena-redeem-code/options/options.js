// Load saved URL
chrome.storage.local.get('claimBaseUrl', (result) => {
  document.getElementById('claimBaseUrl').value = result.claimBaseUrl || '';
});

// Save URL
document.getElementById('saveBtn').addEventListener('click', () => {
  const url = document.getElementById('claimBaseUrl').value.trim();
  chrome.storage.local.set({ claimBaseUrl: url || null }, () => {
    const status = document.getElementById('status');
    status.textContent = url ? '✅ Saved!' : '✅ Cleared (will use default)';
    status.style.color = '#4caf50';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
});
