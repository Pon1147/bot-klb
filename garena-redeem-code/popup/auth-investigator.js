/**
 * Auth Investigator popup logic.
 *
 * Load panel state → render tabs, timeline, refresh flow, network, storage.
 * Event inspector modal on click.
 */

(() => {
  'use strict';

  // ===== DOM elements =====
  const captureStatusEl = document.getElementById('captureStatus');
  const statusBannerEl = document.getElementById('statusBanner');
  const bannerIconEl = document.getElementById('bannerIcon');
  const bannerTitleEl = document.getElementById('bannerTitle');
  const bannerSubtitleEl = document.getElementById('bannerSubtitle');

  // Tab elements
  const tabBtns = document.querySelectorAll('.segment-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Overview
  const totalEventsEl = document.getElementById('totalEvents');
  const authEventsEl = document.getElementById('authEvents');
  const refreshCyclesEl = document.getElementById('refreshCycles');
  const hasChannelInfoEl = document.getElementById('hasChannelInfo');
  const hasAccessTokenEl = document.getElementById('hasAccessToken');
  const hasRefreshTokenEl = document.getElementById('hasRefreshToken');
  const hasGarenaOpenIdEl = document.getElementById('hasGarenaOpenId');
  const hasDfToolsOpenIdEl = document.getElementById('hasDfToolsOpenId');
  const garenaOpenIdEl = document.getElementById('garenaOpenId');
  const dfToolsOpenidEl = document.getElementById('dfToolsOpenid');
  const matchResultEl = document.getElementById('matchResult');
  const tokenStateEl = document.getElementById('tokenState');
  const refreshFlowEl = document.getElementById('refreshFlow');
  const domainListEl = document.getElementById('domainList');

  // Timeline
  const timelineListEl = document.getElementById('timelineList');

  // Refresh tab
  const refreshEventsListEl = document.getElementById('refreshEventsList');

  // Network tab
  const networkEventsListEl = document.getElementById('networkEventsList');
  const networkFiltersEl = document.getElementById('networkFilters');
  let networkFilter = 'all';

  // Storage tab
  const storageTableEl = document.getElementById('storageTable');

  // Modal
  const modalOverlayEl = document.getElementById('modalOverlay');
  const modalTitleEl = document.getElementById('modalTitle');
  const modalBodyEl = document.getElementById('modalBody');
  const modalCloseEl = document.getElementById('modalClose');

  // Clear button
  const btnClear = document.getElementById('btnClear');

  // ===== Tab switching =====
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // ===== Keyboard navigation for tabs =====
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const tabs = Array.from(tabBtns);
      const activeIdx = tabs.findIndex((t) => t.classList.contains('active'));
      if (activeIdx === -1) return;
      e.preventDefault();
      const nextIdx = e.key === 'ArrowLeft'
        ? (activeIdx - 1 + tabs.length) % tabs.length
        : (activeIdx + 1) % tabs.length;
      tabs[nextIdx].focus();
      tabs[nextIdx].click();
    }
  });

  // ===== Network filter chips =====
  networkFiltersEl.addEventListener('click', (e) => {
    if (!e.target.classList.contains('chip')) return;
    networkFiltersEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    e.target.classList.add('active');
    networkFilter = e.target.dataset.filter;
    renderNetworkEvents(getCachedEvents());
  });

  // ===== Load panel state =====
  let cachedEvents = [];

  function loadPanelState() {
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATS' }, (response) => {
      if (!response?.ok) return;
      const { panelState, events } = response;
      if (!panelState) return;

      cachedEvents = events || [];

      updateStatusBanner(panelState);
      renderOverview(panelState);
      renderIdentityMapping(panelState);
      renderTokenState(panelState);
      renderRefreshFlow(panelState);
      renderTimeline(panelState.timeline);
      renderRefreshEvents(panelState.timeline);
      renderNetworkEvents(cachedEvents);
      renderStorageEvents(panelState.storageEvents || []);
    });
  }

  function getCachedEvents() {
    return cachedEvents;
  }

  // ===== Status banner =====
  function updateStatusBanner(ps) {
    const hasAuth = ps.hasGarenaSnsOpenid || ps.hasAccessToken;
    const hasRefresh = ps.refreshFlow?.supported;
    const refreshConfirmed = ps.refreshFlow?.tokenReplacement === 'CONFIRMED';

    if (refreshConfirmed) {
      bannerIconEl.textContent = '✅';
      bannerTitleEl.textContent = 'SESSION HEALTHY';
      bannerTitleEl.style.color = 'var(--green)';
      bannerSubtitleEl.textContent = 'Garena auth ✓ · Refresh flow confirmed';
    } else if (hasAuth) {
      bannerIconEl.textContent = '🔐';
      bannerTitleEl.textContent = 'AUTHENTICATED';
      bannerTitleEl.style.color = 'var(--blue)';
      const parts = ['Garena auth detected'];
      if (ps.hasChannelInfo) parts.push('Channel info received');
      if (ps.hasDfToolsOpenId) parts.push('DfTools identity detected');
      bannerSubtitleEl.textContent = parts.join(' · ');
    } else {
      bannerIconEl.textContent = '⏳';
      bannerTitleEl.textContent = 'WAITING FOR DATA';
      bannerTitleEl.style.color = 'var(--muted)';
      bannerSubtitleEl.textContent = 'Mở HQ page và login Garena để bắt đầu';
    }
  }

  // ===== Render overview =====
  function renderOverview(ps) {
    totalEventsEl.textContent = ps.totalEvents || 0;
    authEventsEl.textContent = ps.authResponseEvents || 0;
    refreshCyclesEl.textContent = ps.refreshFlow?.requestCount || 0;
    hasChannelInfoEl.textContent = ps.hasChannelInfo ? '✓' : '—';
    hasAccessTokenEl.textContent = ps.hasAccessToken ? '✓' : '—';
    hasRefreshTokenEl.textContent = ps.hasRefreshToken ? '✓' : '—';
    hasGarenaOpenIdEl.textContent = ps.hasGarenaSnsOpenid ? '✓' : '—';
    hasDfToolsOpenIdEl.textContent = ps.hasDfToolsOpenId ? '✓' : '—';
  }

  // ===== Render identity mapping =====
  function renderIdentityMapping(ps) {
    const identity = ps.identity || {};
    garenaOpenIdEl.textContent = identity.garenaHash || '—';
    garenaOpenIdEl.className = 'mapping-value ' + (identity.garenaHash !== '—' ? 'match-yes' : 'match-pending');

    dfToolsOpenidEl.textContent = identity.dfToolsHash || '—';
    dfToolsOpenidEl.className = 'mapping-value ' + (identity.dfToolsHash !== '—' ? 'match-yes' : 'match-pending');

    if (identity.match === 'MATCH') {
      matchResultEl.textContent = '✓ MATCH';
      matchResultEl.className = 'mapping-value match-yes';
    } else if (identity.match === 'DIFFERENT') {
      matchResultEl.textContent = '⚠ DIFFERENT';
      matchResultEl.className = 'mapping-value match-no';
    } else {
      matchResultEl.textContent = '— NOT AVAILABLE';
      matchResultEl.className = 'mapping-value match-pending';
    }
  }

  // ===== Render token state =====
  function renderTokenState(ps) {
    const ts = ps.tokenState || {};
    if (!tokenStateEl) return;
    tokenStateEl.innerHTML = `
      <div class="token-row"><span class="token-label">Access Token</span><span class="token-value ${ts.accessToken === 'PRESENT' ? 'match-yes' : ''}">${ts.accessToken || '—'}</span></div>
      <div class="token-row"><span class="token-label">Refresh Token</span><span class="token-value ${ts.refreshToken === 'PRESENT' ? 'match-yes' : ''}">${ts.refreshToken || '—'}</span></div>
      <div class="token-row"><span class="token-label">Last Issued</span><span class="token-value">${ts.lastIssued || '—'}</span></div>
    `;
  }

  // ===== Render refresh flow =====
  function renderRefreshFlow(ps) {
    const rf = ps.refreshFlow || {};
    if (!refreshFlowEl) return;

    const statusClass = rf.tokenReplacement === 'CONFIRMED' ? 'match-yes' :
                        rf.tokenReplacement === 'DETECTED' ? '' :
                        rf.tokenReplacement === 'NOT YET CONFIRMED' ? 'match-pending' : 'match-no';

    refreshFlowEl.innerHTML = `
      <div class="token-row"><span class="token-label">Refresh Support</span><span class="token-value ${rf.supported ? 'match-yes' : ''}">${rf.supported ? '✓ DETECTED' : '— NOT DETECTED'}</span></div>
      <div class="token-row"><span class="token-label">Requests</span><span class="token-value">${rf.requestCount || 0}</span></div>
      <div class="token-row"><span class="token-label">Successful</span><span class="token-value match-yes">${rf.successCount || 0}</span></div>
      <div class="token-row"><span class="token-label">Failed</span><span class="token-value ${rf.failedCount > 0 ? 'match-no' : ''}">${rf.failedCount || 0}</span></div>
      <div class="token-row"><span class="token-label">Last refresh</span><span class="token-value">${rf.lastRefreshTime || '—'}</span></div>
      <div class="token-row"><span class="token-label">Token replacement</span><span class="token-value ${statusClass}">${rf.tokenReplacement || 'NOT DETECTED'}</span></div>
    `;
  }

  // ===== Render timeline =====
  function renderTimeline(timeline) {
    if (!timelineListEl) return;
    if (!timeline || timeline.length === 0) {
      timelineListEl.innerHTML = '<div class="empty-state">Chưa có events.</div>';
      return;
    }

    const sorted = [...timeline].sort((a, b) => b.timestamp - a.timestamp);
    timelineListEl.innerHTML = sorted.slice(0, 100).map((e) => renderTimelineItem(e)).join('');

    // Bind click for modal
    timelineListEl.querySelectorAll('.timeline-item').forEach((item) => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index, 10);
        openEventModal(sorted[idx], sorted[idx].raw || {});
      });
    });
  }

  function renderTimelineItem(e) {
    const icon = getTimelineIcon(e);
    const typeClass = getTimelineTypeClass(e);
    return `
      <div class="timeline-item" data-index="${e.index || 0}">
        <span class="timeline-time">${e.time}</span>
        <span class="timeline-icon ${icon}">${getTimelineEmoji(e)}</span>
        <div class="timeline-body">
          <div class="timeline-type ${typeClass}">${escapeHtml(e.type)}</div>
          <div class="timeline-summary">${escapeHtml(e.summary)}</div>
        </div>
      </div>
    `;
  }

  function getTimelineEmoji(e) {
    if (e.isRefresh) return '↻';
    if (e.hasToken) return '🔑';
    if (e.hasIdentity) return '🆔';
    if (e.hasChannelInfo) return '📋';
    return '●';
  }

  function getTimelineIcon(e) {
    if (e.isRefresh) return 'refresh';
    if (e.hasToken) return 'token';
    if (e.hasIdentity) return 'identity';
    if (e.hasChannelInfo) return 'channel';
    return 'auth';
  }

  function getTimelineTypeClass(e) {
    if (e.isRefresh) return 'refresh-request';
    if (e.hasToken) return 'fetch-response';
    return 'auth-called';
  }

  // ===== Render refresh events (Refresh tab) =====
  function renderRefreshEvents(timeline) {
    if (!refreshEventsListEl) return;
    const refreshEvents = (timeline || []).filter((e) => e.isRefresh);
    if (refreshEvents.length === 0) {
      refreshEventsListEl.innerHTML = '<div class="empty-state">Chưa có refresh events.</div>';
      return;
    }
    refreshEventsListEl.innerHTML = refreshEvents.map((e) => renderEventItem(e.raw || e)).join('');
    refreshEventsListEl.querySelectorAll('.event-item').forEach((item) => {
      item.addEventListener('click', () => item.classList.toggle('expanded'));
    });
  }

  // ===== Render network events =====
  function renderNetworkEvents(events) {
    if (!networkEventsListEl) return;
    const filtered = (events || []).filter((e) => {
      if (networkFilter === 'all') return true;
      if (networkFilter === 'response') return e.type?.includes('_response');
      if (networkFilter === 'refresh') return e.type === 'auth_refresh_request';
      return true;
    });

    if (filtered.length === 0) {
      networkEventsListEl.innerHTML = '<div class="empty-state">Chưa có network events.</div>';
      return;
    }

    networkEventsListEl.innerHTML = filtered.slice(0, 50).map((e) => renderEventItem(e)).join('');
    networkEventsListEl.querySelectorAll('.event-item').forEach((item) => {
      item.addEventListener('click', () => {
        item.classList.toggle('expanded');
      });
    });
  }

  // ===== Render storage events =====
  function renderStorageEvents(events) {
    if (!storageTableEl) return;
    if (!events || events.length === 0) {
      storageTableEl.innerHTML = '<div class="empty-state">Chưa có storage events.</div>';
      return;
    }

    storageTableEl.innerHTML = events.map((e) => `
      <div class="storage-row">
        <span class="storage-time">${new Date(e.timestamp).toLocaleTimeString('vi-VN')}</span>
        <span class="storage-type">${escapeHtml(e.storageType)}</span>
        <span class="storage-key">${escapeHtml(e.key)}</span>
      </div>
    `).join('');
  }

  // ===== Render single event item =====
  function renderEventItem(event) {
    const typeClass = getEventClass(event.type);
    const time = event.timestamp ? new Date(event.timestamp).toLocaleTimeString('vi-VN') : '--:--:--';
    const summary = getEventSummary(event);

    return `
      <div class="event-item">
        <div class="event-header">
          <span class="event-type ${typeClass}">${escapeHtml(event.type)}</span>
          <span class="event-time">${time}</span>
        </div>
        <div class="event-body">${summary}</div>
      </div>
    `;
  }

  function getEventClass(type) {
    if (type === 'auth_refresh_request') return 'refresh-request';
    if (type?.includes('storage_write')) return 'auth-storage';
    if (type?.includes('xhr_sent')) return 'xhr-sent';
    if (type?.includes('xhr_response')) return 'xhr-response';
    if (type?.includes('fetch_sent')) return 'fetch-sent';
    if (type?.includes('fetch_response')) return 'fetch-response';
    return '';
  }

  function getEventSummary(event) {
    const lines = [];
    if (event.url) lines.push(`<span class="field-key">URL:</span><span class="field-value">${escapeHtml(event.url)}</span>`);
    if (event.method) lines.push(`<span class="field-key">Method:</span><span class="field-value">${escapeHtml(event.method)}</span>`);
    if (event.statusCode) lines.push(`<span class="field-key">Status:</span><span class="field-value">${event.statusCode}</span>`);

    if (event.type === 'auth_refresh_request') {
      lines.push(`<span class="field-key">Refresh req:</span><span class="field-value" style="color:var(--green)">✓</span>`);
      if (event.hasRefreshTokenInBody !== undefined)
        lines.push(`<span class="field-key">Has refresh_token:</span><span class="field-value">${event.hasRefreshTokenInBody ? '✓' : '✗'}</span>`);
    }
    if (event.isRefreshResponse === true)
      lines.push(`<span class="field-key">Refresh resp:</span><span class="field-value" style="color:var(--green)">✓ correlated</span>`);

    if (event.hasAccessToken !== undefined)
      lines.push(`<span class="field-key">access_token:</span><span class="field-value">${event.hasAccessToken ? '✓' : '✗'}</span>`);
    if (event.hasRefreshToken !== undefined)
      lines.push(`<span class="field-key">refresh_token:</span><span class="field-value">${event.hasRefreshToken ? '✓' : '✗'}</span>`);
    if (event.hasGarenaSnsOpenid !== undefined)
      lines.push(`<span class="field-key">garena_sns_openid:</span><span class="field-value">${event.hasGarenaSnsOpenid ? '✓' : '✗'}</span>`);
    if (event.hasOpenId !== undefined)
      lines.push(`<span class="field-key">open_id:</span><span class="field-value">${event.hasOpenId ? '✓' : '✗'}</span>`);
    if (event.hasChannelInfo)
      lines.push(`<span class="field-key">channel_info:</span><span class="field-value">✓ (${(event.channelInfoKeys || []).join(', ')})</span>`);
    if (event.resultKeys?.length > 0)
      lines.push(`<span class="field-key">Keys:</span><span class="field-value">${event.resultKeys.join(', ')}</span>`);

    if (event.type === 'auth_storage_write') {
      lines.push(`<span class="field-key">Storage:</span><span class="field-value">${escapeHtml(event.storageType)}</span>`);
      lines.push(`<span class="field-key">Key:</span><span class="field-value">${escapeHtml(event.key)}</span>`);
    }

    return lines.join('<br>') || '(no data)';
  }

  // ===== Event inspector modal =====
  function openEventModal(event, raw) {
    modalTitleEl.textContent = event.type || 'Event';
    const lines = [];

    lines.push(detailRow('Type', event.type));
    lines.push(detailRow('Time', event.timestamp ? new Date(event.timestamp).toLocaleString('vi-VN') : '—'));
    lines.push(detailRow('Request ID', event.requestId || '—'));

    if (event.method) lines.push(detailRow('Method', event.method));
    if (event.url) lines.push(detailRow('URL', event.url));
    if (event.statusCode) lines.push(detailRow('Status', event.statusCode));

    // Auth fields
    const authFields = [
      ['access_token', event.hasAccessToken],
      ['refresh_token', event.hasRefreshToken],
      ['garena_sns_openid', event.hasGarenaSnsOpenid],
      ['open_id', event.hasOpenId],
      ['expires_in', event.hasExpiresIn],
      ['third_type', event.thirdType],
    ];
    const hasAuthFields = authFields.some(([, v]) => v !== undefined);
    if (hasAuthFields) {
      lines.push('');
      lines.push(`<div class="detail-section-title">Auth Fields</div>`);
      authFields.forEach(([key, val]) => {
        if (val !== undefined) {
          lines.push(detailRow(key, val ? '✓' : '✗'));
        }
      });
    }

    // Hashes
    if (event.garenaSnsOpenidHash || event.dfToolsOpenidHash) {
      lines.push('');
      lines.push(`<div class="detail-section-title">Identity Hashes</div>`);
      if (event.garenaSnsOpenidHash) lines.push(detailRow('Garena hash', event.garenaSnsOpenidHash));
      if (event.dfToolsOpenidHash) lines.push(detailRow('DfTools hash', event.dfToolsOpenidHash));
    }

    // Storage
    if (event.type === 'auth_storage_write') {
      lines.push('');
      lines.push(`<div class="detail-section-title">Storage</div>`);
      lines.push(detailRow('Type', event.storageType));
      lines.push(detailRow('Key', event.key));
      lines.push(detailRow('Value', `<${event.valueLength} chars>`));
    }

    modalBodyEl.innerHTML = lines.join('');
    modalOverlayEl.classList.add('active');
  }

  function detailRow(key, value) {
    return `<div class="detail-row"><span class="detail-key">${escapeHtml(key)}</span><span class="detail-value">${escapeHtml(String(value))}</span></div>`;
  }

  // Close modal
  modalCloseEl.addEventListener('click', () => {
    modalOverlayEl.classList.remove('active');
  });
  modalOverlayEl.addEventListener('click', (e) => {
    if (e.target === modalOverlayEl) {
      modalOverlayEl.classList.remove('active');
    }
  });

  // ===== Clear events =====
  btnClear.addEventListener('click', () => {
    if (!confirm('Xóa tất cả auth events?')) return;
    chrome.runtime.sendMessage({ type: 'CLEAR_AUTH_EVENTS' }, () => {
      loadPanelState();
    });
  });

  // ===== Init =====
  loadPanelState();
  setInterval(loadPanelState, 5000);

  // ===== Helpers =====
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
})();
