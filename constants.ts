import { EntityType, LivingEntity } from './types';

export const INITIAL_PLAYER: LivingEntity = {
  id: 'player',
  type: EntityType.PLAYER,
  x: 400,
  y: 300,
  vx: 0,
  vy: 0,
  width: 32,
  height: 32,
  color: '#3b82f6', // blue-500
  hp: 100,
  maxHp: 100,
  speed: 7, // Increased from 4 to 7
  damage: 25
};

export const ENEMY_TYPES = {
  [EntityType.ENEMY_BASIC]: {
    width: 24, height: 24, color: '#ef4444', hp: 30, speed: 2, damage: 5, score: 10
  },
  [EntityType.ENEMY_TANK]: {
    width: 40, height: 40, color: '#7f1d1d', hp: 100, speed: 1, damage: 15, score: 30
  },
  [EntityType.ENEMY_FAST]: {
    width: 20, height: 20, color: '#f59e0b', hp: 15, speed: 5, damage: 8, score: 20
  }
};

export const SHOP_ITEMS = [
  { id: 'spawn_basic', name: 'Triệu hồi Quái (Thường)', cost: 50, type: 'DEBUFF', effect: EntityType.ENEMY_BASIC },
  { id: 'spawn_fast', name: 'Triệu hồi Sát thủ', cost: 100, type: 'DEBUFF', effect: EntityType.ENEMY_FAST },
  { id: 'spawn_tank', name: 'Triệu hồi Tanker', cost: 200, type: 'DEBUFF', effect: EntityType.ENEMY_TANK },
  { id: 'heal_player', name: 'Hồi Máu (+20 HP)', cost: 150, type: 'BUFF', effect: 'HEAL' },
  { id: 'buff_damage', name: 'Tăng Sát Thương (+10)', cost: 300, type: 'BUFF', effect: 'DMG_UP' },
];

export const MOCK_VIEWERS = [
  { id: 'v1', name: 'NguyenVanA', balance: 1000, betOn: null },
  { id: 'v2', name: 'GamerVip_99', balance: 500, betOn: null },
  { id: 'v3', name: 'Viewer_X', balance: 2000, betOn: null },
];