// Tarjeta de métricas KPI para el Dashboard administrativo
import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export const MetricCard = ({ title, value, change, isPositive = true, icon: Icon, color = "purple" }) => {
  const colorMap = {
    purple: "from-purple-500/20 to-indigo-500/10 text-purple-400 border-purple-500/30",
    blue: "from-blue-500/20 to-cyan-500/10 text-blue-400 border-blue-500/30",
    emerald: "from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30",
    amber: "from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30",
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400">{title}</span>
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[color]} border flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="text-2xl font-black text-white tracking-tight mb-2">
        {value}
      </div>

      {change && (
        <div className="flex items-center gap-1 text-xs">
          {isPositive ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
          )}
          <span className={isPositive ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
            {change}
          </span>
        </div>
      )}
    </div>
  );
};

export default MetricCard;
