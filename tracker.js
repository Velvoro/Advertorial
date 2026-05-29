(function () {
  'use strict';

  // Wait for config to be available
  var CFG = window.FUNNEL_CONFIG || {};
  var supabaseClient = null;
  var visitorId = 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
  var sessionId  = 's-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
  var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };

  /* ── Init Supabase ── */
  function initSupabase() {
    if (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) {
      try {
        supabaseClient = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
      } catch (e) { /* silent */ }
    }
  }

  /* ── Init Meta Pixel ── */
  function initMetaPixel() {
    var pixelId = CFG.metaPixelId;
    if (!pixelId) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
  }

  /* ── Init GA4 ── */
  function initGA() {
    var gaId = CFG.gaId;
    if (!gaId) return;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + gaId;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', gaId);
  }

  /* ── Init GTM ── */
  function initGTM() {
    var gtmId = CFG.gtmId;
    if (!gtmId) return;
    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0],
        j = d.createElement(s), dl = l !== 'dataLayer' ? '&l=' + l : '';
      j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', gtmId);
  }

  /* ── Send event to Supabase ── */
  function sendEvent(eventType, eventData) {
    if (!supabaseClient) return;
    var payload = {
      funnel_id:   CFG.funnelId || 'advertorial',
      visitor_id:  visitorId,
      session_id:  sessionId,
      event_type:  eventType,
      event_data:  eventData || {},
      page_url:    window.location.href,
      user_agent:  navigator.userAgent,
      referrer:    document.referrer || '',
      created_at:  new Date().toISOString()
    };
    supabaseClient.from('funnel_events').insert(payload).then(function () {}).catch(function () {});
  }

  /* ── Fire pixel event ── */
  function firePixelEvent(eventName, params) {
    if (window.fbq) window.fbq('track', eventName, params || {});
    if (window.gtag) window.gtag('event', eventName, params || {});
  }

  /* ── Page view ── */
  function trackPageView() {
    sendEvent('page_view', {
      title:    document.title,
      referrer: document.referrer
    });
  }

  /* ── Scroll tracking ── */
  function getScrollPercent() {
    var body     = document.body;
    var html     = document.documentElement;
    var scrolled = window.scrollY || document.documentElement.scrollTop;
    var total    = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight) - window.innerHeight;
    if (total <= 0) return 100;
    return Math.round((scrolled / total) * 100);
  }

  var scrollThrottle = false;
  function onScroll() {
    if (scrollThrottle) return;
    scrollThrottle = true;
    setTimeout(function () {
      scrollThrottle = false;
      var pct = getScrollPercent();
      [25, 50, 75, 100].forEach(function (milestone) {
        if (!scrollMilestones[milestone] && pct >= milestone) {
          scrollMilestones[milestone] = true;
          sendEvent('scroll_' + milestone, { depth: milestone });
          firePixelEvent('scroll_' + milestone, { depth: milestone });
        }
      });
    }, 200);
  }

  /* ── CTA click tracking ── */
  function onDocClick(e) {
    var target = e.target;
    // Walk up to find data-cta element
    while (target && target !== document) {
      if (target.getAttribute && target.getAttribute('data-cta')) {
        var ctaId = target.getAttribute('data-cta');
        sendEvent('cta_click', { cta_id: ctaId, href: target.href || '' });
        firePixelEvent('InitiateCheckout', { cta_id: ctaId });
        // Also fire ViewContent / conversion on last CTA
        if (ctaId === 'cta_3' || ctaId === 'cta_float') {
          sendEvent('conversion', { cta_id: ctaId });
          firePixelEvent('Purchase', { cta_id: ctaId });
        }
        break;
      }
      target = target.parentNode;
    }
  }

  /* ── Time on page ── */
  var startTime = Date.now();
  function sendTimeOnPage() {
    var seconds = Math.round((Date.now() - startTime) / 1000);
    sendEvent('time_on_page', { seconds: seconds });
  }

  /* ── Bootstrap ── */
  function bootstrap() {
    initSupabase();
    initMetaPixel();
    initGA();
    initGTM();
    trackPageView();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onDocClick);
    window.addEventListener('beforeunload', sendTimeOnPage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();
