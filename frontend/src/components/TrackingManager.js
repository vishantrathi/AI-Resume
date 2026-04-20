import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const CONSENT_COOKIE = 'jobmatch_tracking_consent';
const ANON_COOKIE = 'jobmatch_anon_id';
const CONSENT_VERSION = 'v1';

function getCookie(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function setCookie(name, value, days) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function ensureAnonymousId() {
  const existing = getCookie(ANON_COOKIE);
  if (existing) return existing;
  const anon = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  setCookie(ANON_COOKIE, anon, 365);
  return anon;
}

function getDeviceType() {
  const ua = (navigator.userAgent || '').toLowerCase();
  const mobile = /iphone|android|mobile|ipad|ipod/.test(ua);
  if (mobile) return 'mobile';
  const tablet = /tablet/.test(ua);
  if (tablet) return 'tablet';
  return 'desktop';
}

function describeClickTarget(target) {
  if (!target || !(target instanceof Element)) return 'unknown';
  const tracked = target.closest('[data-track-click]');
  if (tracked) return tracked.getAttribute('data-track-click') || 'custom';

  const candidate = target.closest('button, a, input, select, textarea, [role="button"], [role="link"]');
  const el = candidate || target;
  const tag = (el.tagName || 'node').toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const className = typeof el.className === 'string'
    ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
    : '';
  const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return [tag + id + className, text].filter(Boolean).join(' :: ');
}

function buildSectionId(el, index) {
  const explicit = el.getAttribute('data-track-section') || el.id || '';
  if (explicit.trim()) return explicit.trim();
  const heading = el.querySelector('h1, h2, h3, h4');
  if (heading && heading.textContent) return heading.textContent.trim().slice(0, 80);
  return `section-${index + 1}`;
}

const TrackingManager = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [consent, setConsent] = useState(null);

  const routeKey = `${location.pathname}${location.search}`;
  const sessionIdRef = useRef(`sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const activeSectionRef = useRef('page');
  const sectionDurationsRef = useRef({ page: 0 });
  const clickTargetsRef = useRef({});
  const interactionCountRef = useRef(0);
  const keypressCountRef = useRef(0);
  const mouseDistanceRef = useRef(0);
  const lastMousePosRef = useRef(null);
  const maxScrollDepthRef = useRef(0);
  const routeStartedAtRef = useRef(Date.now());
  const flushInFlightRef = useRef(false);
  const previousRouteRef = useRef('');
  const anonymousIdRef = useRef('');

  useEffect(() => {
    const cookieValue = getCookie(CONSENT_COOKIE);
    if (cookieValue === 'accepted') setConsent(true);
    else if (cookieValue === 'declined') setConsent(false);
    else setConsent(null);
  }, []);

  const flushTracking = useCallback(async () => {
    if (!user || consent !== true || flushInFlightRef.current) return;

    const durationMs = Date.now() - routeStartedAtRef.current;
    if (durationMs <= 0) return;

    const params = new URLSearchParams(location.search || '');
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    const payload = {
      sessionId: sessionIdRef.current,
      route: routeKey,
      routeFrom: previousRouteRef.current,
      durationMs,
      sectionDurations: sectionDurationsRef.current,
      clickTargets: Object.entries(clickTargetsRef.current)
        .map(([target, count]) => ({ target, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30),
      maxScrollDepth: maxScrollDepthRef.current,
      interactionCount: interactionCountRef.current,
      keypressCount: keypressCountRef.current,
      mouseDistancePx: Math.round(mouseDistanceRef.current),
      viewport: {
        width: window.innerWidth || 0,
        height: window.innerHeight || 0,
      },
      referrer: document.referrer || '',
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
      deviceType: getDeviceType(),
      platform: navigator.platform || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      connectionType: connection?.effectiveType || '',
      connectionDownlink: Number(connection?.downlink) || 0,
      connectionRtt: Number(connection?.rtt) || 0,
      anonymousId: anonymousIdRef.current,
      userAgent: navigator.userAgent || '',
      language: navigator.language || '',
      consentVersion: CONSENT_VERSION,
    };

    flushInFlightRef.current = true;
    try {
      await api.post('/tracking/events', payload);
      routeStartedAtRef.current = Date.now();
      sectionDurationsRef.current = { [activeSectionRef.current || 'page']: 0 };
      clickTargetsRef.current = {};
      interactionCountRef.current = 0;
      keypressCountRef.current = 0;
      mouseDistanceRef.current = 0;
      lastMousePosRef.current = null;
      maxScrollDepthRef.current = 0;
    } catch (_err) {
      // Keep counters; next flush retries naturally.
    } finally {
      flushInFlightRef.current = false;
    }
  }, [consent, routeKey, user, location.search]);

  useEffect(() => {
    if (!user || consent !== true) return;

    routeStartedAtRef.current = Date.now();
    activeSectionRef.current = 'page';
    sectionDurationsRef.current = { page: 0 };
    clickTargetsRef.current = {};
    interactionCountRef.current = 0;
    keypressCountRef.current = 0;
    mouseDistanceRef.current = 0;
    lastMousePosRef.current = null;
    maxScrollDepthRef.current = 0;
    anonymousIdRef.current = ensureAnonymousId();

    const visibleSections = new Map();
    const candidates = Array.from(document.querySelectorAll('section, article, main, [data-track-section]'));
    const sectionMap = new Map();
    candidates.forEach((el, index) => {
      sectionMap.set(el, buildSectionId(el, index));
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = sectionMap.get(entry.target) || 'page';
        if (entry.isIntersecting) {
          visibleSections.set(id, entry.intersectionRatio);
        } else {
          visibleSections.delete(id);
        }
      });

      let best = 'page';
      let bestRatio = 0;
      for (const [id, ratio] of visibleSections.entries()) {
        if (ratio > bestRatio) {
          best = id;
          bestRatio = ratio;
        }
      }
      activeSectionRef.current = best;
      if (!Object.prototype.hasOwnProperty.call(sectionDurationsRef.current, best)) {
        sectionDurationsRef.current[best] = 0;
      }
    }, { threshold: [0.25, 0.5, 0.75] });

    candidates.forEach((el) => observer.observe(el));

    const tickInterval = window.setInterval(() => {
      const section = activeSectionRef.current || 'page';
      sectionDurationsRef.current[section] = (sectionDurationsRef.current[section] || 0) + 1000;
    }, 1000);

    const flushInterval = window.setInterval(() => {
      flushTracking();
    }, 15000);

    const onScroll = () => {
      const doc = document.documentElement;
      const total = Math.max(1, (doc.scrollHeight || 1) - (window.innerHeight || 0));
      const depth = Math.round(((window.scrollY || 0) / total) * 100);
      if (depth > maxScrollDepthRef.current) maxScrollDepthRef.current = Math.min(depth, 100);
    };

    const onInteraction = (event) => {
      interactionCountRef.current += 1;

      if (event?.type === 'keydown') {
        keypressCountRef.current += 1;
      }

      if (event?.type === 'click') {
        const label = describeClickTarget(event.target);
        clickTargetsRef.current[label] = (clickTargetsRef.current[label] || 0) + 1;
      }
    };

    const onMouseMove = (event) => {
      const prev = lastMousePosRef.current;
      const current = { x: event.clientX, y: event.clientY };
      if (prev) {
        const dx = current.x - prev.x;
        const dy = current.y - prev.y;
        mouseDistanceRef.current += Math.sqrt(dx * dx + dy * dy);
      }
      lastMousePosRef.current = current;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushTracking();
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('click', onInteraction, { passive: true });
    window.addEventListener('keydown', onInteraction, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('beforeunload', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(tickInterval);
      window.clearInterval(flushInterval);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('click', onInteraction);
      window.removeEventListener('keydown', onInteraction);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('beforeunload', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      flushTracking();
      previousRouteRef.current = routeKey;
    };
  }, [consent, routeKey, user, flushTracking]);

  const banner = useMemo(() => {
    if (consent !== null) return null;

    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl premium-card">
        <h3 className="text-sm font-bold text-slate-900">Allow Cookies For Activity Insights?</h3>
        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
          We use cookies and analytics events to measure section time, route journeys, click behavior, movement depth, and streaks.
          This data powers personal insights and advanced recruiter analytics.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => {
              setCookie(CONSENT_COOKIE, 'accepted', 365);
              setConsent(true);
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
          >
            Accept Tracking Cookies
          </button>
          <button
            onClick={() => {
              setCookie(CONSENT_COOKIE, 'declined', 365);
              setConsent(false);
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            Decline
          </button>
        </div>
      </div>
    );
  }, [consent]);

  return banner;
};

export default TrackingManager;
