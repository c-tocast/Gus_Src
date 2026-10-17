/**
 * Global Error Tracking & Classification Utility
 * Standardizes app errors with HTTP status & source fallbacks (Approach 1B)
 * Intercepts global window errors & unhandled rejections (Approach 4A)
 */

export interface CapturedError {
  errorCode: string;
  message: string;
  timestamp: number;
}

let latestCapturedError: CapturedError | null = null;

/**
 * Classify any error or exception into a standardized error code (Approach 1B)
 */
export function classifyError(err: any, fallbackCode: string = 'ERR_UNKNOWN_WORKFLOW_FAIL'): string {
  if (!err) return fallbackCode;

  // Check network status
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'ERR_NETWORK_OFFLINE';
  }

  const errStr = String(err?.message || err?.error || err || '').toLowerCase();
  const status = err?.status || err?.statusCode || err?.response?.status;

  // Check 503 Model High Demand / Capacity Spikes
  if (
    status === 503 ||
    errStr.includes('503') ||
    errStr.includes('high demand') ||
    errStr.includes('spikes in demand') ||
    errStr.includes('unavailable') ||
    errStr.includes('overloaded') ||
    errStr.includes('temporarily unavailable')
  ) {
    return 'ERR_MODEL_HIGH_DEMAND';
  }

  // Check HTTP Status or Quota Exceeded
  if (status === 429 || errStr.includes('quota') || errStr.includes('resource_exhausted') || errStr.includes('rate limit') || errStr.includes('too many requests')) {
    return 'ERR_QUOTA_EXCEEDED';
  }

  if (status) {
    return `ERR_HTTP_${status}`;
  }

  // Common status messages in error strings
  if (errStr.includes('429')) return 'ERR_QUOTA_EXCEEDED';
  if (errStr.includes('500')) return 'ERR_HTTP_500';
  if (errStr.includes('503')) return 'ERR_HTTP_503';
  if (errStr.includes('404')) return 'ERR_HTTP_404';
  if (errStr.includes('401')) return 'ERR_HTTP_401';
  if (errStr.includes('403')) return 'ERR_HTTP_403';

  // Network or Connection failures
  if (errStr.includes('failed to fetch') || errStr.includes('networkerror') || errStr.includes('network error') || errStr.includes('offline')) {
    return 'ERR_NETWORK_OFFLINE';
  }

  // Check JavaScript Error types
  if (err instanceof TypeError || errStr.includes('typeerror')) return 'ERR_JS_TYPEERROR';
  if (err instanceof ReferenceError || errStr.includes('referenceerror')) return 'ERR_JS_REFERENCEERROR';
  if (err instanceof SyntaxError || errStr.includes('syntaxerror')) return 'ERR_JS_SYNTAXERROR';

  // Request outside supported workflows
  if (errStr.includes('unsupported workflow') || errStr.includes('unhandled workflow') || errStr.includes('invalid workflow')) {
    return 'ERR_UNHANDLED_WORKFLOW';
  }

  return fallbackCode;
}

/**
 * Registers global listeners for uncaught browser errors and promise rejections (Approach 4A)
 */
export function registerGlobalErrorListeners(): void {
  if (typeof window === 'undefined') return;

  // Listen for uncaught JavaScript errors in browser console
  window.addEventListener('error', (event: ErrorEvent) => {
    const code = classifyError(event.error || event.message, 'ERR_CONSOLE_EXCEPTION');
    latestCapturedError = {
      errorCode: code,
      message: event.message || 'Browser console exception',
      timestamp: Date.now(),
    };
    console.warn('[ErrorTracker] Captured window console error:', code, event.message);
  });

  // Listen for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const code = classifyError(event.reason, 'ERR_CONSOLE_UNHANDLED_REJECTION');
    latestCapturedError = {
      errorCode: code,
      message: event.reason?.message || String(event.reason) || 'Unhandled promise rejection',
      timestamp: Date.now(),
    };
    console.warn('[ErrorTracker] Captured unhandled promise rejection:', code, event.reason);
  });
}

/**
 * Get latest captured browser error if recorded within the last 15 seconds
 */
export function getLatestCapturedError(): CapturedError | null {
  if (!latestCapturedError) return null;
  // Expire errors after 15 seconds so stale errors don't persist indefinitely
  if (Date.now() - latestCapturedError.timestamp > 15000) {
    latestCapturedError = null;
    return null;
  }
  return latestCapturedError;
}

/**
 * Manually report or store a captured error
 */
export function setCapturedError(code: string, message: string): void {
  latestCapturedError = {
    errorCode: code,
    message,
    timestamp: Date.now(),
  };
}

/**
 * Check if an error is due to high model demand, capacity spikes, or temporary throttling
 */
export function isHighDemandError(code?: string): boolean {
  if (!code) return false;
  return (
    code === 'ERR_MODEL_HIGH_DEMAND' ||
    code === 'ERR_HTTP_503' ||
    code === 'ERR_QUOTA_EXCEEDED' ||
    code === 'ERR_HTTP_429'
  );
}

/**
 * Clear captured error buffer
 */
export function clearLatestCapturedError(): void {
  latestCapturedError = null;
}


