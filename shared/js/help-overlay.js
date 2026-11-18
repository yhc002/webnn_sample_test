export function initHelpOverlay(items, { title, flow } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';
  document.body.appendChild(overlay);

  const btn = document.createElement('button');
  btn.className = 'help-btn';
  btn.textContent = 'How to Use';
  const controls = document.querySelector('.controls');
  if (controls) {
    controls.appendChild(btn);
  } else {
    document.body.appendChild(btn);
  }

  let activeTooltip = null;
  let markers = [];
  let highlights = [];

  function positionMarker(marker, el, anchor) {
    const r = el.getBoundingClientRect();
    const sx = window.scrollX;
    const sy = window.scrollY;
    let x, y;
    switch (anchor) {
      case 'top-left':
        x = r.left + sx - 6;
        y = r.top + sy - 6;
        break;
      case 'top-right':
        x = r.right + sx - 22;
        y = r.top + sy - 6;
        break;
      case 'center':
        x = r.left + sx + r.width / 2 - 14;
        y = r.top + sy + r.height / 2 - 14;
        break;
      case 'left':
        x = r.left + sx - 14;
        y = r.top + sy + r.height / 2 - 14;
        break;
      default:
        x = r.left + sx - 6;
        y = r.top + sy - 6;
    }
    marker.style.left = x + 'px';
    marker.style.top = y + 'px';
  }

  function positionHighlight(hl, el) {
    const r = el.getBoundingClientRect();
    const sx = window.scrollX;
    const sy = window.scrollY;
    hl.style.left = (r.left + sx - 4) + 'px';
    hl.style.top = (r.top + sy - 4) + 'px';
    hl.style.width = (r.width + 8) + 'px';
    hl.style.height = (r.height + 8) + 'px';
  }

  function positionTooltip(tooltip, markerEl) {
    const mr = markerEl.getBoundingClientRect();
    const sx = window.scrollX;
    const sy = window.scrollY;
    const tw = 280;

    const arrow = tooltip.querySelector('.help-tooltip__arrow');

    const spaceRight = window.innerWidth - mr.right;
    const spaceLeft = mr.left;
    const spaceBelow = window.innerHeight - mr.bottom;

    if (spaceBelow > 200) {
      tooltip.style.left = Math.max(8, Math.min(mr.left + sx + 14 - tw / 2, window.innerWidth - tw - 8)) + 'px';
      tooltip.style.top = (mr.bottom + sy + 12) + 'px';
      arrow.style.top = '-7px';
      arrow.style.left = Math.min(Math.max(16, mr.left + sx + 14 - parseFloat(tooltip.style.left)), tw - 28) + 'px';
      arrow.style.transform = 'rotate(45deg)';
    } else if (spaceRight > tw + 20) {
      tooltip.style.left = (mr.right + sx + 12) + 'px';
      tooltip.style.top = Math.max(8, mr.top + sy - 10) + 'px';
      arrow.style.left = '-7px';
      arrow.style.top = '16px';
      arrow.style.transform = 'rotate(-45deg)';
    } else if (spaceLeft > tw + 20) {
      tooltip.style.left = (mr.left + sx - tw - 12) + 'px';
      tooltip.style.top = Math.max(8, mr.top + sy - 10) + 'px';
      arrow.style.right = '-7px';
      arrow.style.left = 'auto';
      arrow.style.top = '16px';
      arrow.style.transform = 'rotate(135deg)';
    } else {
      tooltip.style.left = Math.max(8, mr.left + sx + 14 - tw / 2) + 'px';
      tooltip.style.top = (mr.top + sy - 12) + 'px';
      tooltip.style.transform = 'translateY(-100%)';
      arrow.style.bottom = '-7px';
      arrow.style.top = 'auto';
      arrow.style.left = '50%';
      arrow.style.transform = 'rotate(-135deg)';
    }
  }

  function showTooltip(item, markerEl) {
    dismissTooltip();
    markerEl.classList.add('active');

    const tooltip = document.createElement('div');
    tooltip.className = 'help-tooltip';
    tooltip.innerHTML = `
      <div class="help-tooltip__arrow"></div>
      <div class="help-tooltip__label">${item.label}</div>
      <div class="help-tooltip__desc">${item.desc}</div>`;
    overlay.appendChild(tooltip);

    positionTooltip(tooltip, markerEl);
    requestAnimationFrame(() => tooltip.classList.add('visible'));
    activeTooltip = { tooltip, marker: markerEl };
  }

  function dismissTooltip() {
    if (!activeTooltip) return;
    activeTooltip.tooltip.remove();
    activeTooltip.marker.classList.remove('active');
    activeTooltip = null;
  }

  function buildOverlay() {
    overlay.innerHTML = '';

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'help-overlay__backdrop';
    overlay.appendChild(backdrop);

    // Header
    const header = document.createElement('div');
    header.className = 'help-overlay__header';
    header.innerHTML = `
      <div class="help-overlay__title">${title || 'How to Use'}</div>
      <div class="help-overlay__hint">Click a numbered marker to learn about that component</div>`;
    overlay.appendChild(header);

    // Close
    const closeBtn = document.createElement('button');
    closeBtn.className = 'help-overlay__close';
    closeBtn.innerHTML = '&times;';
    overlay.appendChild(closeBtn);

    markers = [];
    highlights = [];
    let num = 1;

    for (const item of items) {
      if (item.type === 'flow') continue;

      const el = document.querySelector(item.selector);
      if (!el) continue;

      // Temporarily reveal hidden elements so we can measure them
      const wasHidden = el.hidden;
      if (wasHidden) {
        el.hidden = false;
        el.dataset.helpRevealed = '1';
      }

      // Highlight outline
      const hl = document.createElement('div');
      hl.className = 'help-highlight';
      if (item.variant === 'tip') hl.classList.add('help-highlight--green');
      if (item.variant === 'warn') hl.classList.add('help-highlight--amber');
      overlay.appendChild(hl);
      positionHighlight(hl, el);
      highlights.push({ hl, el });

      // Marker
      const marker = document.createElement('div');
      marker.className = 'help-marker';
      if (item.variant === 'tip') marker.classList.add('help-marker--green');
      if (item.variant === 'warn') marker.classList.add('help-marker--amber');
      marker.textContent = num;
      overlay.appendChild(marker);
      positionMarker(marker, el, item.anchor || 'top-left');
      markers.push({ marker, el, anchor: item.anchor || 'top-left' });

      const capturedItem = item;
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        showTooltip(capturedItem, marker);
      });

      num++;
    }

    // Flow bar
    const flowItem = items.find(i => i.type === 'flow');
    if (flowItem) {
      const bar = document.createElement('div');
      bar.className = 'help-flow-bar';
      let barHtml = '<span class="help-flow-bar__label">Workflow:</span>';
      for (let i = 0; i < flowItem.steps.length; i++) {
        const s = flowItem.steps[i];
        barHtml += `<span class="help-flow-bar__step${s.color ? ' help-flow-bar__step--' + s.color : ''}">${s.label}</span>`;
        if (i < flowItem.steps.length - 1) {
          barHtml += `<span class="help-flow-bar__arrow">&rarr;</span>`;
        }
      }
      bar.innerHTML = barHtml;
      overlay.appendChild(bar);
    }

    // Events
    backdrop.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) dismissTooltip();
    });
  }

  function reposition() {
    for (const { marker, el, anchor } of markers) {
      positionMarker(marker, el, anchor);
    }
    for (const { hl, el } of highlights) {
      positionHighlight(hl, el);
    }
    if (activeTooltip) {
      positionTooltip(activeTooltip.tooltip, activeTooltip.marker);
    }
  }

  function open() {
    buildOverlay();
    overlay.style.display = 'block';
    requestAnimationFrame(() => overlay.classList.add('visible'));
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition);
  }

  function close() {
    dismissTooltip();
    overlay.classList.remove('visible');
    overlay.style.display = 'none';
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition);
    document.querySelectorAll('[data-help-revealed]').forEach(el => {
      el.hidden = true;
      delete el.dataset.helpRevealed;
    });
  }

  btn.addEventListener('click', open);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.style.display === 'block') close();
  });
}
