import { z } from 'zod';
import {
  ArenaSessionState,
  LobbyConfig,
  LobbyConfigSchema,
  SessionFsmState,
} from './session';

/**
 * Danh sách Tên sự kiện WebSocket chuẩn hóa hai đầu C2S & S2C
 */
export const ArenaSocketEvents = {
  // Client to Server (C2S)
  C2S_JOIN_LOBBY: 'c2s:join_lobby',
  C2S_UPDATE_CONFIG: 'c2s:update_config',
  C2S_START_COMBAT: 'c2s:start_combat',
  C2S_SKIP_PREP: 'c2s:skip_prep',
  C2S_TOGGLE_PAUSE: 'c2s:toggle_pause',
  C2S_AUDIO_STREAM_DATA: 'c2s:audio_stream_data',
  C2S_SUBMIT_TRANSCRIPT: 'c2s:submit_transcript',

  // Server to Client (S2C)
  S2C_SESSION_SYNC: 's2c:session_sync',
  S2C_TIMER_TICK: 's2c:timer_tick',
  S2C_LIVE_TRANSCRIPT: 's2c:live_transcript',
  S2C_VAD_ALERT: 's2c:vad_alert',
  S2C_BOSS_STATEMENT: 's2c:boss_statement',
  S2C_COMBAT_RESULT: 's2c:combat_result',
  S2C_ERROR: 's2c:error',
} as const;

export type ArenaSocketEvents =
  (typeof ArenaSocketEvents)[keyof typeof ArenaSocketEvents];

/**
 * Zod Schemas cho các gói tin C2S
 */
export const C2SJoinLobbyPayloadSchema = z.object({
  sessionId: z.string(),
  documentId: z.string(),
});
export type C2SJoinLobbyPayload = z.infer<typeof C2SJoinLobbyPayloadSchema>;

export const C2SUpdateConfigPayloadSchema = z.object({
  sessionId: z.string(),
  config: LobbyConfigSchema,
});
export type C2SUpdateConfigPayload = z.infer<typeof C2SUpdateConfigPayloadSchema>;

export const C2SSubmitTranscriptPayloadSchema = z.object({
  sessionId: z.string(),
  text: z.string(),
  isFinal: z.boolean().default(false),
  estimatedWpm: z.number().optional(),
});
export type C2SSubmitTranscriptPayload = z.infer<
  typeof C2SSubmitTranscriptPayloadSchema
>;

export const C2SSessionActionPayloadSchema = z.object({
  sessionId: z.string(),
});
export type C2SSessionActionPayload = z.infer<
  typeof C2SSessionActionPayloadSchema
>;

/**
 * Payloads cho các gói tin S2C
 */
export interface S2CTimerTickPayload {
  fsmState: SessionFsmState;
  prepRemainingSeconds: number;
  turnRemainingSeconds: number;
  isPaused: boolean;
}

export interface S2CLiveTranscriptPayload {
  sender: 'CANDIDATE' | 'BOSS';
  text: string;
  isFinal: boolean;
  timestamp: string;
}

export interface S2CVadAlertPayload {
  silenceSeconds: number;
  thresholdSeconds: number;
  warningText: string;
}
