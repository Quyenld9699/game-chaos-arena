import React, { useState, useEffect, useReducer, useRef, useCallback } from 'react';
import { Play, RotateCcw, Monitor, Users, MessageSquare, Copy, Link as LinkIcon, LogOut } from 'lucide-react';
import Peer, { DataConnection } from 'peerjs';
import GameCanvas from './components/GameCanvas';
import ViewerControls from './components/ViewerControls';
import { generateCommentary } from './services/geminiService';
import { 
  GameState, GameStatus, EntityType, LivingEntity, Projectile, 
  CANVAS_WIDTH, CANVAS_HEIGHT, Viewer, GameEvent, NetworkMessage 
} from './types';
import { INITIAL_PLAYER, ENEMY_TYPES, SHOP_ITEMS } from './constants';

// --- REDUCER ---

type Action = 
  | { type: 'SYNC_STATE'; state: GameState }
  | { type: 'START_GAME' }
  | { type: 'RESET_GAME' }
  | { type: 'GAME_TICK'; dt: number }
  | { type: 'MOVE_PLAYER'; dx: number; dy: number }
  | { type: 'SHOOT'; targetX: number; targetY: number }
  | { type: 'SPAWN_ENEMY'; enemyType: EntityType }
  | { type: 'BUFF_PLAYER'; buffType: string }
  | { type: 'BET'; viewerId: string; betType: 'WIN' | 'LOSE'; amount: number }
  | { type: 'ADD_EVENT'; text: string; eventType: 'INFO' | 'DANGER' | 'BUFF' | 'COMMENTARY' }
  | { type: 'UPDATE_VIEWER_BALANCE'; viewerId: string; amount: number }
  | { type: 'ADD_VIEWER'; viewer: Viewer };

const initialState: GameState = {
  status: GameStatus.IDLE,
  player: { ...INITIAL_PLAYER },
  enemies: [],
  projectiles: [],
  score: 0,
  timeElapsed: 0,
  viewers: [],
  events: [],
  difficultyMultiplier: 1,
};

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SYNC_STATE':
      // Merge events locally if needed, but for simplicity we take Host state authoritative
      // except maybe preserve local viewer identity if we wanted to be complex.
      // Here we just replace state but maybe keep the "viewers" list if we were doing client-side prediction.
      // For this simple game: full replacement is fine, but it might feel jumpy if laggy.
      return action.state;

    case 'START_GAME':
      return {
        ...initialState,
        status: GameStatus.PLAYING,
        viewers: state.viewers.map(v => ({...v, betOn: null, betAmount: 0, balance: v.balance })),
      };

    case 'RESET_GAME':
      return { ...initialState, viewers: state.viewers };

    case 'ADD_VIEWER':
      if (state.viewers.find(v => v.id === action.viewer.id)) return state;
      return { ...state, viewers: [...state.viewers, action.viewer] };

    case 'MOVE_PLAYER': {
      if (state.status !== GameStatus.PLAYING) return state;
      const { dx, dy } = action;
      const speed = state.player.speed;
      
      // Normalize vector for diagonal movement
      // Calculate length of the input vector
      const length = Math.sqrt(dx * dx + dy * dy);
      
      // If moving (length > 0), divide by length to get unit vector, then multiply by speed
      // If not moving, delta is 0
      const moveX = length > 0 ? (dx / length) * speed : 0;
      const moveY = length > 0 ? (dy / length) * speed : 0;

      let newX = state.player.x + moveX;
      let newY = state.player.y + moveY;
      
      newX = Math.max(state.player.width/2, Math.min(CANVAS_WIDTH - state.player.width/2, newX));
      newY = Math.max(state.player.height/2, Math.min(CANVAS_HEIGHT - state.player.height/2, newY));

      return { ...state, player: { ...state.player, x: newX, y: newY } };
    }

    case 'SHOOT': {
       if (state.status !== GameStatus.PLAYING) return state;
       const { x, y } = state.player;
       const angle = Math.atan2(action.targetY - y, action.targetX - x);
       const speed = 10;
       const newProjectile: Projectile = {
         id: Math.random().toString(),
         type: EntityType.PROJECTILE,
         x: x,
         y: y,
         vx: Math.cos(angle) * speed,
         vy: Math.sin(angle) * speed,
         width: 8, height: 8, color: '#facc15',
         damage: state.player.damage,
         ownerId: 'player'
       };
       return { ...state, projectiles: [...state.projectiles, newProjectile] };
    }

    case 'SPAWN_ENEMY': {
      if (state.status !== GameStatus.PLAYING) return state;
      const config = ENEMY_TYPES[action.enemyType as keyof typeof ENEMY_TYPES] || ENEMY_TYPES[EntityType.ENEMY_BASIC];
      const edge = Math.floor(Math.random() * 4); 
      let ex = 0, ey = 0;
      if (edge === 0) { ex = Math.random() * CANVAS_WIDTH; ey = -20; }
      else if (edge === 1) { ex = CANVAS_WIDTH + 20; ey = Math.random() * CANVAS_HEIGHT; }
      else if (edge === 2) { ex = Math.random() * CANVAS_WIDTH; ey = CANVAS_HEIGHT + 20; }
      else { ex = -20; ey = Math.random() * CANVAS_HEIGHT; }

      const newEnemy: LivingEntity = {
        id: Math.random().toString(),
        type: action.enemyType,
        x: ex, y: ey,
        vx: 0, vy: 0,
        ...config,
        maxHp: config.hp
      };
      return { ...state, enemies: [...state.enemies, newEnemy] };
    }

    case 'BUFF_PLAYER': {
       if (state.status !== GameStatus.PLAYING) return state;
       const p = { ...state.player };
       if (action.buffType === 'HEAL') {
         p.hp = Math.min(p.maxHp, p.hp + 20);
       } else if (action.buffType === 'DMG_UP') {
         p.damage += 10;
       }
       return { ...state, player: p };
    }

    case 'BET': {
      const updatedViewers = state.viewers.map(v => 
        v.id === action.viewerId 
          ? { ...v, betOn: action.betType, betAmount: action.amount, balance: v.balance - action.amount }
          : v
      );
      return { ...state, viewers: updatedViewers };
    }

    case 'UPDATE_VIEWER_BALANCE': {
      const updatedViewers = state.viewers.map(v => 
        v.id === action.viewerId ? { ...v, balance: v.balance + action.amount } : v
      );
      return { ...state, viewers: updatedViewers };
    }

    case 'ADD_EVENT': {
      const newEvent: GameEvent = {
        id: Math.random().toString(),
        text: action.text,
        type: action.eventType,
        timestamp: Date.now()
      };
      return { ...state, events: [newEvent, ...state.events].slice(0, 6) };
    }

    case 'GAME_TICK': {
       if (state.status !== GameStatus.PLAYING) return state;

       const activeProjectiles = state.projectiles
         .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy }))
         .filter(p => p.x > 0 && p.x < CANVAS_WIDTH && p.y > 0 && p.y < CANVAS_HEIGHT);

       const activeEnemies = state.enemies.map(e => {
         const angle = Math.atan2(state.player.y - e.y, state.player.x - e.x);
         return {
           ...e,
           x: e.x + Math.cos(angle) * e.speed,
           y: e.y + Math.sin(angle) * e.speed
         };
       });

       let scoreToAdd = 0;
       const survivingEnemies: LivingEntity[] = [];

       for (const enemy of activeEnemies) {
          let enemyDead = false;
          let enemyHp = enemy.hp;

          for (let i = activeProjectiles.length - 1; i >= 0; i--) {
            const proj = activeProjectiles[i];
            const dx = proj.x - enemy.x;
            const dy = proj.y - enemy.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < (enemy.width/2 + proj.width/2)) {
               enemyHp -= proj.damage;
               activeProjectiles.splice(i, 1);
               if (enemyHp <= 0) {
                 enemyDead = true;
                 const typeScore = enemy.type === EntityType.ENEMY_TANK ? 30 : enemy.type === EntityType.ENEMY_FAST ? 20 : 10;
                 scoreToAdd += typeScore;
                 break;
               }
            }
          }

          if (!enemyDead) {
            survivingEnemies.push({ ...enemy, hp: enemyHp });
          }
       }

       let playerHp = state.player.hp;
       const enemiesAfterPlayerCollision = [];

       for (const enemy of survivingEnemies) {
          const dx = enemy.x - state.player.x;
          const dy = enemy.y - state.player.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist < (enemy.width/2 + state.player.width/2)) {
             playerHp -= enemy.damage;
          } else {
             enemiesAfterPlayerCollision.push(enemy);
          }
       }

       let newStatus: GameStatus = state.status;
       if (playerHp <= 0) {
         playerHp = 0;
         newStatus = GameStatus.GAME_OVER;
       }

       return {
         ...state,
         player: { ...state.player, hp: playerHp },
         enemies: enemiesAfterPlayerCollision,
         projectiles: activeProjectiles,
         score: state.score + scoreToAdd,
         timeElapsed: state.timeElapsed + action.dt,
         status: newStatus
       };
    }

    default:
      return state;
  }
}

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  
  // FIX: Keep a ref to the latest state to avoid stale closures in PeerJS callbacks and Interval
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Networking State
  const [role, setRole] = useState<'NONE' | 'HOST' | 'VIEWER'>('NONE');
  const [peerId, setPeerId] = useState<string>(''); // My ID
  const [hostIdInput, setHostIdInput] = useState<string>(''); // For joining
  const [viewerName, setViewerName] = useState<string>('');
  
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]); // For Host: list of viewers
  const hostConnectionRef = useRef<DataConnection | null>(null); // For Viewer: connection to host

  // Gemini Commentary Integration
  const lastCommentaryTime = useRef<number>(0);
  const triggerCommentary = useCallback(async (text: string, type: 'DANGER' | 'BUFF' | 'INFO') => {
      dispatch({ type: 'ADD_EVENT', text, eventType: type });
      
      // Broadcast event if host
      if (role === 'HOST') {
        const now = Date.now();
        if (now - lastCommentaryTime.current > 8000 || type === 'DANGER') {
           lastCommentaryTime.current = now;
           // FIX: Use ref for current score/hp to ensure we have latest data
           const currentScore = gameStateRef.current.score;
           const currentHp = gameStateRef.current.player.hp;

           const aiText = await generateCommentary(text, currentScore, currentHp);
           if (aiText) {
              dispatch({ type: 'ADD_EVENT', text: `🎙️ ${aiText}`, eventType: 'COMMENTARY' });
           }
        }
      }
  }, [role]);

  // --- HOST LOGIC ---

  const startHost = () => {
    const peer = new Peer();
    peer.on('open', (id) => {
      setPeerId(id);
      setRole('HOST');
      dispatch({ type: 'RESET_GAME' });
    });

    peer.on('connection', (conn) => {
      connectionsRef.current.push(conn);
      
      conn.on('data', (data: any) => {
        const msg = data as NetworkMessage;
        // FIX: Always read from the Ref to get the latest state
        const currentState = gameStateRef.current;
        
        if (msg.type === 'VIEWER_JOIN') {
          dispatch({ 
            type: 'ADD_VIEWER', 
            viewer: { id: msg.id, name: msg.name, balance: 1000, betOn: null } 
          });
          triggerCommentary(`Người xem ${msg.name} đã vào phòng!`, 'INFO');
        } 
        
        else if (msg.type === 'VIEWER_ACTION_PURCHASE') {
          const viewer = currentState.viewers.find(v => v.id === msg.viewerId);
          // Check balance against current state
          if (viewer && viewer.balance >= msg.cost) {
            handlePurchase(msg.viewerId, msg.itemId, msg.cost);
          }
        }

        else if (msg.type === 'VIEWER_ACTION_BET') {
           handleBet(msg.viewerId, msg.betType, msg.amount);
        }
      });

      conn.on('close', () => {
         connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
      });
    });

    peerRef.current = peer;
  };

  // --- VIEWER LOGIC ---

  const joinGame = () => {
    if (!hostIdInput || !viewerName) return;
    const peer = new Peer();
    
    peer.on('open', (myId) => {
       setPeerId(myId);
       setRole('VIEWER');
       
       const conn = peer.connect(hostIdInput);
       conn.on('open', () => {
         hostConnectionRef.current = conn;
         // Send Join Handshake
         conn.send({ type: 'VIEWER_JOIN', name: viewerName, id: myId });
       });

       conn.on('data', (data: any) => {
         const msg = data as NetworkMessage;
         if (msg.type === 'SYNC_STATE') {
           dispatch({ type: 'SYNC_STATE', state: msg.state });
         }
       });

       conn.on('close', () => {
         alert('Mất kết nối với Host!');
         setRole('NONE');
       });
    });

    peerRef.current = peer;
  };

  // --- GAME LOOP (ONLY RUNS ON HOST) ---

  useEffect(() => {
    if (role !== 'HOST') return;

    let loopId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      
      // FIX: Check Ref instead of closure state for loop condition if needed, 
      // but dispatch works fine with reducer. 
      // Accessing gameState.status from closure might be stale if useEffect doesn't update, 
      // but we put gameState.status in deps, so this effect recreates.
      // Optimization: use ref for status check to avoid recreating loop?
      // For now, let's trust the Ref for logic checks if inside callbacks.
      // But here `gameState` is in dependency array, so `loop` is recreated when `gameState.status` changes.
      // This is OK.
      
      if (gameState.status === GameStatus.PLAYING) {
        dispatch({ type: 'GAME_TICK', dt });
        
        // Random natural spawns
        if (Math.random() < 0.01 + (gameState.timeElapsed * 0.0001)) {
           dispatch({ type: 'SPAWN_ENEMY', enemyType: EntityType.ENEMY_BASIC });
        }
      }
      
      loopId = requestAnimationFrame(loop);
    };

    loopId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(loopId);
  }, [gameState.status, gameState.timeElapsed, role]);

  // --- STATE BROADCAST (HOST -> VIEWERS) ---
  useEffect(() => {
    if (role === 'HOST') {
      // FIX: This interval was depending on [gameState], causing it to reset constantly.
      // Now it depends only on [role] and reads from gameStateRef.
      const interval = setInterval(() => {
        if (connectionsRef.current.length > 0) {
           // Read fresh state from ref
           const msg: NetworkMessage = { type: 'SYNC_STATE', state: gameStateRef.current };
           connectionsRef.current.forEach(conn => {
             if(conn.open) conn.send(msg);
           });
        }
      }, 50); // 20 updates per second

      return () => clearInterval(interval);
    }
  }, [role]);


  // Pay out bets on Game Over (Host Logic)
  useEffect(() => {
    if (role === 'HOST' && gameState.status === GameStatus.GAME_OVER) {
       gameState.viewers.forEach(v => {
         if (v.betOn === 'LOSE' && v.betAmount) {
            dispatch({ type: 'UPDATE_VIEWER_BALANCE', viewerId: v.id, amount: v.betAmount * 2 });
            triggerCommentary(`${v.name} đã thắng cược khi Streamer thất bại!`, 'INFO');
         }
       });
       triggerCommentary("Streamer đã ngã xuống! Game Over!", "DANGER");
    }
  }, [gameState.status, role, triggerCommentary]);


  // --- HANDLERS ---

  const handleMove = (dx: number, dy: number) => {
    if (role === 'HOST') dispatch({ type: 'MOVE_PLAYER', dx, dy });
  };

  const handleShoot = (targetX: number, targetY: number) => {
    if (role === 'HOST') dispatch({ type: 'SHOOT', targetX, targetY });
  };

  // Host executes this logic
  const handlePurchase = (viewerId: string, itemId: string, cost: number) => {
     const item = SHOP_ITEMS.find(i => i.id === itemId);
     if (!item) return;

     dispatch({ type: 'UPDATE_VIEWER_BALANCE', viewerId: viewerId, amount: -cost });
     
     // FIX: Read name from Ref to ensure we have the viewer list
     const vName = gameStateRef.current.viewers.find(v => v.id === viewerId)?.name || 'Viewer';

     if (item.type === 'DEBUFF') {
        dispatch({ type: 'SPAWN_ENEMY', enemyType: item.effect as EntityType });
        triggerCommentary(`${vName} đã triệu hồi ${item.name}!`, 'DANGER');
     } else {
        dispatch({ type: 'BUFF_PLAYER', buffType: item.effect as string });
        triggerCommentary(`${vName} đã gửi tặng ${item.name}!`, 'BUFF');
     }
  };

  // Host executes this logic
  const handleBet = (viewerId: string, type: 'WIN' | 'LOSE', amount: number) => {
    dispatch({ type: 'BET', viewerId: viewerId, betType: type, amount });
    
    // FIX: Read name from Ref
    const vName = gameStateRef.current.viewers.find(v => v.id === viewerId)?.name || 'Viewer';
    triggerCommentary(`${vName} đã cược ${amount}$ vào cửa ${type === 'WIN' ? 'THẮNG' : 'THUA'}!`, 'INFO');
  };

  // Viewer Interaction (Sends network request)
  const onViewerPurchase = (itemId: string, cost: number) => {
    if (role === 'VIEWER' && hostConnectionRef.current) {
      hostConnectionRef.current.send({ 
        type: 'VIEWER_ACTION_PURCHASE', 
        viewerId: peerId, 
        itemId, cost 
      });
    }
  };

  const onViewerBet = (type: 'WIN' | 'LOSE', amount: number) => {
    if (role === 'VIEWER' && hostConnectionRef.current) {
      hostConnectionRef.current.send({ 
        type: 'VIEWER_ACTION_BET', 
        viewerId: peerId, 
        betType: type, amount 
      });
    }
  };

  const currentViewerSelf = gameState.viewers.find(v => v.id === peerId);

  // --- RENDER: LOBBY ---

  if (role === 'NONE') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-200">
        <div className="max-w-md w-full bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
           <div className="p-8 text-center bg-gradient-to-b from-slate-800 to-slate-900">
             <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-2 pixel-font">CHAOS ARENA</h1>
             <p className="text-slate-400 mb-6">Multiplayer Interactive Survival</p>
             
             <button 
               onClick={startHost}
               className="w-full mb-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg"
             >
               <Monitor size={20} /> TẠO PHÒNG MỚI (HOST)
             </button>

             <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-900 text-slate-500">HOẶC VÀO PHÒNG</span></div>
             </div>

             <div className="space-y-3">
               <input 
                 type="text" 
                 placeholder="Tên của bạn"
                 className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white focus:border-indigo-500 outline-none"
                 value={viewerName}
                 onChange={e => setViewerName(e.target.value)}
               />
               <input 
                 type="text" 
                 placeholder="Nhập ID Phòng (Room ID)"
                 className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white focus:border-indigo-500 outline-none font-mono text-sm"
                 value={hostIdInput}
                 onChange={e => setHostIdInput(e.target.value)}
               />
               <button 
                 onClick={joinGame}
                 disabled={!viewerName || !hostIdInput}
                 className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg"
               >
                 <Users size={20} /> VÀO PHÒNG (VIEWER)
               </button>
             </div>
           </div>
        </div>
      </div>
    )
  }

  // --- RENDER: GAME ---

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6 shadow-md z-10">
        <div className="flex items-center gap-3">
           <div className={`p-2 rounded-lg ${role === 'HOST' ? 'bg-indigo-600' : 'bg-purple-600'}`}>
             {role === 'HOST' ? <Monitor size={24} className="text-white" /> : <Users size={24} className="text-white" />}
           </div>
           <div>
             <h1 className="font-bold text-xl text-white tracking-wider pixel-font">CHAOS ARENA</h1>
             <div className="flex items-center gap-2 text-xs text-slate-400">
               <span className="font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-600">{role}</span>
               {role === 'HOST' && (
                 <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-600 cursor-pointer hover:text-white"
                   onClick={() => {navigator.clipboard.writeText(peerId); alert('Đã copy Room ID!');}}
                 >
                   <span className="font-mono max-w-[100px] truncate">ID: {peerId}</span>
                   <Copy size={12} />
                 </div>
               )}
               {role === 'VIEWER' && <span className="text-green-400 flex items-center gap-1"><LinkIcon size={12}/> Connected</span>}
             </div>
           </div>
        </div>

        <div className="flex items-center gap-4">
           {role === 'HOST' && (
             gameState.status === GameStatus.IDLE || gameState.status === GameStatus.GAME_OVER ? (
               <button 
                  onClick={() => dispatch({ type: 'START_GAME' })}
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-green-900/20"
               >
                 <Play size={18} fill="currentColor" /> BẮT ĐẦU
               </button>
             ) : (
               <button 
                  onClick={() => dispatch({ type: 'RESET_GAME' })}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-full font-bold flex items-center gap-2"
               >
                 <RotateCcw size={18} /> KẾT THÚC
               </button>
             )
           )}
           <button 
             onClick={() => window.location.reload()} // Quick logout/disconnect
             className="text-slate-400 hover:text-red-400 p-2"
             title="Rời phòng"
           >
             <LogOut size={20} />
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left: Game Area */}
        <div className="flex-1 p-6 flex flex-col items-center justify-center bg-slate-950 relative">
          <GameCanvas 
             gameState={gameState} 
             isHost={role === 'HOST'}
             onMove={handleMove}
             onShoot={handleShoot}
          />
          
          {role === 'HOST' && gameState.status === GameStatus.PLAYING && (
             <div className="mt-4 text-slate-500 text-sm flex gap-8">
                <span><kbd className="bg-slate-800 px-2 py-1 rounded border border-slate-700">W,A,S,D</kbd> Di chuyển</span>
                <span><kbd className="bg-slate-800 px-2 py-1 rounded border border-slate-700">Click chuột</kbd> Bắn</span>
             </div>
          )}

          {/* Commentary Log (Overlay) */}
          <div className="absolute bottom-6 left-6 w-96 max-h-48 overflow-y-auto space-y-2 pointer-events-none custom-scrollbar pr-2">
             {gameState.events.map((event) => (
               <div key={event.id} className={`
                  p-3 rounded-r-lg border-l-4 shadow-lg backdrop-blur-sm animate-fade-in
                  ${event.type === 'DANGER' ? 'bg-red-900/80 border-red-500 text-red-100' : 
                    event.type === 'BUFF' ? 'bg-emerald-900/80 border-emerald-500 text-emerald-100' :
                    event.type === 'COMMENTARY' ? 'bg-indigo-900/80 border-indigo-500 text-indigo-100 italic' :
                    'bg-slate-800/80 border-slate-500 text-slate-200'}
               `}>
                 <div className="flex gap-2">
                    {event.type === 'COMMENTARY' && <MessageSquare size={16} className="mt-1 flex-shrink-0" />}
                    <span className="text-sm font-medium">{event.text}</span>
                 </div>
               </div>
             ))}
          </div>
        </div>

        {/* Right: Sidebar */}
        <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-xl">
          {role === 'HOST' ? (
             <div className="p-6 h-full flex flex-col">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                   <Users size={20} className="text-blue-400"/> Viewer Lobby
                </h2>
                
                {gameState.viewers.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 opacity-50">
                    <Users size={48} className="mb-2" />
                    <p>Chưa có ai vào phòng...</p>
                    <p className="text-xs mt-2 text-center">Copy Room ID trên góc trái<br/>và gửi cho bạn bè!</p>
                  </div>
                ) : (
                  <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                     {gameState.viewers.map(v => (
                       <div key={v.id} className="bg-slate-800 p-3 rounded flex items-center justify-between border border-slate-700">
                          <div>
                             <div className="font-bold text-indigo-300">{v.name}</div>
                             <div className="text-xs text-slate-400">{v.balance} coin</div>
                          </div>
                          {v.betOn && (
                             <span className={`text-xs px-2 py-1 rounded font-bold ${v.betOn === 'WIN' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                               {v.betOn === 'WIN' ? 'Cược Thắng' : 'Cược Thua'} ({v.betAmount})
                             </span>
                          )}
                       </div>
                     ))}
                  </div>
                )}
             </div>
          ) : (
             currentViewerSelf ? (
               <ViewerControls 
                 viewer={currentViewerSelf} 
                 gameStatus={gameState.status}
                 onPurchase={onViewerPurchase}
                 onBet={onViewerBet}
               />
             ) : (
               <div className="flex items-center justify-center h-full text-slate-500">
                 Đang tải thông tin...
               </div>
             )
          )}
        </aside>
      </main>
    </div>
  );
};

export default App;