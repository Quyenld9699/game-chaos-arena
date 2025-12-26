export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum EntityType {
  PLAYER = 'PLAYER',
  ENEMY_BASIC = 'ENEMY_BASIC', // Basic chaser
  ENEMY_TANK = 'ENEMY_TANK',   // Slow, high HP
  ENEMY_FAST = 'ENEMY_FAST',   // Fast, low HP
  PROJECTILE = 'PROJECTILE',
  ITEM_HEALTH = 'ITEM_HEALTH',
  ITEM_POWERUP = 'ITEM_POWERUP'
}

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

export interface Entity extends Position, Velocity {
  id: string;
  type: EntityType;
  width: number;
  height: number;
  color: string;
}

export interface LivingEntity extends Entity {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
}

export interface Projectile extends Entity {
  damage: number;
  ownerId: string; // 'player' or enemy id
}

export interface Viewer {
  id: string; // Peer ID
  name: string;
  balance: number; // Coin
  betOn?: 'WIN' | 'LOSE' | null;
  betAmount?: number;
}

export interface GameState {
  status: GameStatus;
  player: LivingEntity;
  enemies: LivingEntity[];
  projectiles: Projectile[];
  score: number;
  timeElapsed: number;
  viewers: Viewer[];
  events: GameEvent[]; // Log for commentary
  difficultyMultiplier: number;
}

export interface GameEvent {
  id: string;
  text: string;
  type: 'INFO' | 'DANGER' | 'BUFF' | 'COMMENTARY';
  timestamp: number;
}

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// --- MULTIPLAYER TYPES ---

export type NetworkMessage = 
  | { type: 'SYNC_STATE'; state: GameState }
  | { type: 'VIEWER_JOIN'; name: string; id: string }
  | { type: 'VIEWER_ACTION_PURCHASE'; viewerId: string; itemId: string; cost: number }
  | { type: 'VIEWER_ACTION_BET'; viewerId: string; betType: 'WIN' | 'LOSE'; amount: number };

