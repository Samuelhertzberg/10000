/**
 * Analytics utility for Plausible event tracking
 *
 * This module provides type-safe wrappers around the Plausible Analytics API.
 * Events are only tracked in production to avoid polluting analytics data during development.
 */

// Extend Window interface to include plausible
declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: {
        props?: Record<string, string | number | boolean>;
        callback?: () => void;
      }
    ) => void;
  }
}

/**
 * Check if we're in production environment
 * Only track analytics in production to avoid dev/test data
 */
const isProduction = (): boolean => {
  return import.meta.env.PROD;
};

/**
 * Track a custom event with Plausible
 *
 * @param eventName - Name of the event (e.g., "Add Player", "Game Reset")
 * @param props - Optional properties to attach to the event
 *
 * @example
 * trackEvent("Add Player", { playerName: "Alice" });
 * trackEvent("Game Reset");
 */
export const trackEvent = (
  eventName: string,
  props?: Record<string, string | number | boolean>
): void => {
  // Only track in production
  if (!isProduction()) {
    console.debug(`[Analytics] ${eventName}`, props);
    return;
  }

  // Check if Plausible is loaded
  if (typeof window.plausible === 'function') {
    try {
      window.plausible(eventName, { props });
    } catch (error) {
      console.error('[Analytics] Error tracking event:', error);
    }
  } else {
    console.warn('[Analytics] Plausible not loaded');
  }
};

/**
 * Predefined game events for type safety
 */
export const GameEvents = {
  // Player management
  ADD_PLAYER: 'Add Player',
  REMOVE_PLAYER: 'Remove Player',

  // Game actions
  ADD_POINTS: 'Add Points',
  GAME_RESET: 'Game Reset',

  // Game state
  GAME_WON: 'Game Won',

  // UI interactions
  EXPAND_SCORES: 'Expand Scores',
  COLLAPSE_SCORES: 'Collapse Scores',

  // Settings
  TOGGLE_ANY_POINTS: 'Toggle Any Points Setting',
  CHANGE_MAX_POINTS: 'Change Max Points',

  // Help
  VIEW_HELP: 'View Help',
} as const;

/**
 * Track player addition
 */
export const trackAddPlayer = (playerName: string): void => {
  trackEvent(GameEvents.ADD_PLAYER, {
    playerName,
  });
};

/**
 * Track player removal
 */
export const trackRemovePlayer = (playerName: string, playerCount: number): void => {
  trackEvent(GameEvents.REMOVE_PLAYER, {
    playerName,
    remainingPlayers: playerCount,
  });
};

/**
 * Track points addition
 */
export const trackAddPoints = (points: number, playerName: string): void => {
  trackEvent(GameEvents.ADD_POINTS, {
    points,
    playerName,
  });
};

/**
 * Track game reset
 */
export const trackGameReset = (playerCount: number, roundsPlayed: number): void => {
  trackEvent(GameEvents.GAME_RESET, {
    playerCount,
    roundsPlayed,
  });
};

/**
 * Track game won
 */
export const trackGameWon = (
  winnerName: string,
  finalScore: number,
  playerCount: number,
  roundsPlayed: number
): void => {
  trackEvent(GameEvents.GAME_WON, {
    winnerName,
    finalScore,
    playerCount,
    roundsPlayed,
  });
};

/**
 * Track settings changes
 */
export const trackSettingsChange = (
  setting: 'allowAnyPoints' | 'maxPoints',
  value: boolean | number
): void => {
  if (setting === 'allowAnyPoints') {
    trackEvent(GameEvents.TOGGLE_ANY_POINTS, {
      enabled: value as boolean,
    });
  } else {
    trackEvent(GameEvents.CHANGE_MAX_POINTS, {
      maxPoints: value as number,
    });
  }
};

/**
 * Track help dialog view
 */
export const trackViewHelp = (): void => {
  trackEvent(GameEvents.VIEW_HELP);
};

/**
 * Track score expansion
 */
export const trackScoreExpansion = (expanded: boolean): void => {
  trackEvent(
    expanded ? GameEvents.EXPAND_SCORES : GameEvents.COLLAPSE_SCORES
  );
};
