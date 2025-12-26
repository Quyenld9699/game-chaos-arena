import React, { useEffect, useRef } from 'react';
import { GameState, EntityType, CANVAS_WIDTH, CANVAS_HEIGHT } from '../types';

interface GameCanvasProps {
  gameState: GameState;
  isHost: boolean;
  onMove: (dx: number, dy: number) => void;
  onShoot: (targetX: number, targetY: number) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, isHost, onMove, onShoot }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);

  // Input handling
  useEffect(() => {
    if (!isHost || gameState.status !== 'PLAYING') return;

    const keysPressed: { [key: string]: boolean } = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const inputLoop = () => {
      let dx = 0;
      let dy = 0;
      if (keysPressed['ArrowUp'] || keysPressed['KeyW']) dy -= 1;
      if (keysPressed['ArrowDown'] || keysPressed['KeyS']) dy += 1;
      if (keysPressed['ArrowLeft'] || keysPressed['KeyA']) dx -= 1;
      if (keysPressed['ArrowRight'] || keysPressed['KeyD']) dx += 1;

      if (dx !== 0 || dy !== 0) {
        onMove(dx, dy);
      }
      animationFrameRef.current = requestAnimationFrame(inputLoop);
    };

    inputLoop();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isHost, gameState.status, onMove]);

  // Mouse click to shoot
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isHost || gameState.status !== 'PLAYING') return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onShoot(x, y);
  };

  // Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // Clear
      ctx.fillStyle = '#1e293b'; // slate-800
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Grid Lines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      for (let i = 0; i < CANVAS_WIDTH; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
      }
      for (let i = 0; i < CANVAS_HEIGHT; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke();
      }

      // Draw Player
      const p = gameState.player;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fillRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
      
      // Player HP Bar
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(p.x - 20, p.y - p.height / 2 - 10, 40, 5);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(p.x - 20, p.y - p.height / 2 - 10, 40 * (p.hp / p.maxHp), 5);

      // Draw Enemies
      gameState.enemies.forEach(e => {
        ctx.fillStyle = e.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = e.color;
        
        if (e.type === EntityType.ENEMY_TANK) {
           ctx.fillRect(e.x - e.width / 2, e.y - e.height / 2, e.width, e.height);
           // Border for tank
           ctx.strokeStyle = '#fff';
           ctx.lineWidth = 2;
           ctx.strokeRect(e.x - e.width / 2, e.y - e.height / 2, e.width, e.height);
        } else if (e.type === EntityType.ENEMY_FAST) {
            // Triangle for fast
            ctx.beginPath();
            ctx.moveTo(e.x, e.y - e.height/2);
            ctx.lineTo(e.x - e.width/2, e.y + e.height/2);
            ctx.lineTo(e.x + e.width/2, e.y + e.height/2);
            ctx.fill();
        } else {
            // Circle for basic
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
      });

      // Draw Projectiles
      ctx.fillStyle = '#facc15'; // yellow
      gameState.projectiles.forEach(proj => {
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Overlay Texts
      if (gameState.status === 'GAME_OVER') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#ef4444';
        ctx.font = '40px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('THẤT BẠI', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.fillStyle = '#fff';
        ctx.font = '20px Roboto';
        ctx.fillText(`Điểm số: ${gameState.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
      } else if (gameState.status === 'IDLE') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = '#fff';
        ctx.font = '20px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('SẴN SÀNG?', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      }
    };

    const renderLoop = requestAnimationFrame(render);
    return () => cancelAnimationFrame(renderLoop);
  }, [gameState]);

  return (
    <div className="relative rounded-lg overflow-hidden shadow-2xl border-4 border-slate-700">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleCanvasClick}
        className="block bg-slate-800 cursor-crosshair"
      />
      {/* UI Overlay for Stats */}
      <div className="absolute top-4 left-4 text-white font-mono pointer-events-none drop-shadow-md">
        <div className="text-xl font-bold text-yellow-400">SCORE: {gameState.score}</div>
        <div className="text-sm text-slate-300">TIME: {Math.floor(gameState.timeElapsed)}s</div>
        <div className="text-sm text-red-400">ENEMIES: {gameState.enemies.length}</div>
      </div>
    </div>
  );
};

export default GameCanvas;