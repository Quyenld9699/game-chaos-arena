import React, { useState } from 'react';
import { ShoppingCart, Skull, Zap, DollarSign, Swords } from 'lucide-react';
import { Viewer, GameStatus } from '../types';
import { SHOP_ITEMS } from '../constants';

interface ViewerControlsProps {
  viewer: Viewer;
  gameStatus: GameStatus;
  onPurchase: (itemId: string, cost: number) => void;
  onBet: (type: 'WIN' | 'LOSE', amount: number) => void;
}

const ViewerControls: React.FC<ViewerControlsProps> = ({ viewer, gameStatus, onPurchase, onBet }) => {
  const [activeTab, setActiveTab] = useState<'SHOP' | 'BET'>('SHOP');
  const [betAmount, setBetAmount] = useState(100);

  const canBet = gameStatus === GameStatus.IDLE || (gameStatus === GameStatus.PLAYING && !viewer.betOn);

  return (
    <div className="h-full bg-slate-900 border-l border-slate-700 p-4 flex flex-col text-slate-100">
      <div className="mb-6 bg-slate-800 p-4 rounded-lg shadow-lg">
        <div className="flex items-center gap-3 mb-2">
           <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold">
             {viewer.name.substring(0, 1)}
           </div>
           <div>
             <h3 className="font-bold text-lg text-indigo-300">{viewer.name}</h3>
             <div className="flex items-center text-yellow-400 text-sm">
                <DollarSign size={14} />
                <span>{viewer.balance} Coin</span>
             </div>
           </div>
        </div>
        {viewer.betOn && (
           <div className={`text-xs font-bold px-2 py-1 rounded inline-block ${viewer.betOn === 'WIN' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
              ĐÃ CƯỢC: CHỦ ROOM {viewer.betOn === 'WIN' ? 'THẮNG' : 'THUA'} ({viewer.betAmount})
           </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('SHOP')}
          className={`flex-1 py-2 rounded font-bold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'SHOP' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
          <ShoppingCart size={16} /> Cửa Hàng
        </button>
        <button
          onClick={() => setActiveTab('BET')}
          className={`flex-1 py-2 rounded font-bold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'BET' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
        >
          <Swords size={16} /> Cá Cược
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {activeTab === 'SHOP' ? (
          <div className="space-y-3">
             <p className="text-xs text-slate-400 mb-2 italic">Mua vật phẩm để tương tác với game!</p>
             {SHOP_ITEMS.map((item) => (
               <button
                 key={item.id}
                 disabled={viewer.balance < item.cost || gameStatus !== GameStatus.PLAYING}
                 onClick={() => onPurchase(item.id, item.cost)}
                 className={`w-full p-3 rounded-lg flex items-center justify-between group transition-all
                    ${viewer.balance < item.cost || gameStatus !== GameStatus.PLAYING
                      ? 'bg-slate-800 opacity-50 cursor-not-allowed' 
                      : item.type === 'BUFF' 
                        ? 'bg-emerald-900/30 border border-emerald-700/50 hover:bg-emerald-800/50' 
                        : 'bg-red-900/30 border border-red-700/50 hover:bg-red-800/50'
                    }
                 `}
               >
                 <div className="flex items-center gap-3">
                    {item.type === 'BUFF' ? <Zap className="text-emerald-400" size={20} /> : <Skull className="text-red-400" size={20} />}
                    <div className="text-left">
                      <div className="font-bold text-sm">{item.name}</div>
                      <div className="text-xs text-slate-400">{item.type === 'BUFF' ? 'Hỗ trợ' : 'Tấn công'}</div>
                    </div>
                 </div>
                 <div className="font-bold text-yellow-500 text-sm">
                   {item.cost} $
                 </div>
               </button>
             ))}
          </div>
        ) : (
          <div className="p-2">
            {!canBet ? (
              <div className="text-center text-slate-500 py-10 border border-dashed border-slate-700 rounded">
                Hiện không thể đặt cược.<br/>
                <span className="text-xs">(Đã vào game hoặc đã cược)</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-400 mb-1">Số tiền cược</label>
                   <input 
                      type="range" 
                      min="10" 
                      max={viewer.balance} 
                      step="10" 
                      value={betAmount} 
                      onChange={(e) => setBetAmount(parseInt(e.target.value))}
                      className="w-full accent-purple-500 mb-2"
                   />
                   <div className="text-right text-yellow-400 font-mono font-bold">{betAmount} $</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => onBet('WIN', betAmount)}
                    className="p-4 bg-slate-800 border-2 border-green-600 rounded-lg hover:bg-green-900/20 transition-colors"
                  >
                    <div className="text-green-500 font-bold mb-1">Cược THẮNG</div>
                    <div className="text-xs text-slate-400">Streamer sống sót</div>
                  </button>
                  <button 
                    onClick={() => onBet('LOSE', betAmount)}
                    className="p-4 bg-slate-800 border-2 border-red-600 rounded-lg hover:bg-red-900/20 transition-colors"
                  >
                    <div className="text-red-500 font-bold mb-1">Cược THUA</div>
                    <div className="text-xs text-slate-400">Streamer thất bại</div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewerControls;
