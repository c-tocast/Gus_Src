import { AnalyticsChartSpec, AnalyticsChatMessage } from '../types';

const STORAGE_KEYS = {
  PINNED_CHARTS: 'violet_pinned_analytics_charts_v1',
  ANALYTICS_CHAT: 'violet_analytics_chat_v1',
  LEGACY_ANALYTICS_PREF: 'ai_planner_analytics_pref_v1',
};

/**
 * Load pinned charts for top dashboard (Approach 6A)
 */
export function loadPinnedAnalyticsCharts(): AnalyticsChartSpec[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PINNED_CHARTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load pinned analytics charts:', e);
    return [];
  }
}

/**
 * Save pinned charts
 */
export function savePinnedAnalyticsCharts(charts: AnalyticsChartSpec[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PINNED_CHARTS, JSON.stringify(charts.slice(0, 3)));
  } catch (e) {
    console.error('Failed to save pinned analytics charts:', e);
  }
}

/**
 * Load dedicated Analytics AI Persona ("Prism") chat messages
 */
export function loadAnalyticsChatMessages(): AnalyticsChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ANALYTICS_CHAT);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load analytics chat messages:', e);
    return [];
  }
}

/**
 * Save analytics chat messages
 */
export function saveAnalyticsChatMessages(messages: AnalyticsChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ANALYTICS_CHAT, JSON.stringify(messages.slice(-50)));
  } catch (e) {
    console.error('Failed to save analytics chat messages:', e);
  }
}

/**
 * Legacy Preference Conversion Adapter (Approach 1B)
 * Checks for previous analytics settings in localStorage and returns prompt suggestion chips.
 */
export function getLegacyAnalyticsChips(): string[] {
  const chips: string[] = [];
  try {
    const legacyRaw = localStorage.getItem(STORAGE_KEYS.LEGACY_ANALYTICS_PREF);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (parsed.customDimension && parsed.customMetric) {
        chips.push(`Show ${parsed.customMetric} grouped by ${parsed.customDimension}`);
      }
    }
  } catch (_) {}

  // Standard high-value initial analytics prompt chips
  const defaultChips = [
    'Task distribution by environmental realm',
    'Weekly focus hours vs intended time',
    'Urgency breakdown of overdue items',
    'Task completion rate by assigned person',
  ];

  defaultChips.forEach((c) => {
    if (!chips.includes(c)) chips.push(c);
  });

  return chips.slice(0, 5);
}
