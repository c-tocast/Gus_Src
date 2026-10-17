import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts';
import {
  Pin,
  PinOff,
  Eye,
  Database,
  Sparkles,
  BarChart2,
  PieChart as PieIcon,
  LineChart as LineIcon,
  Activity,
  Code,
} from 'lucide-react';
import { AnalyticsChartSpec } from '../types';

interface DynamicChartRendererProps {
  spec: AnalyticsChartSpec;
  isPinned?: boolean;
  onTogglePin?: (spec: AnalyticsChartSpec) => void;
}

const PALETTE = ['#8B5CF6', '#10B981', '#3B82F6', '#EC4899', '#F59E0B', '#6366F1', '#14B8A6', '#F43F5E'];

export const DynamicChartRenderer: React.FC<DynamicChartRendererProps> = ({
  spec,
  isPinned = false,
  onTogglePin,
}) => {
  const [showSampleData, setShowSampleData] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const realHasData = Array.isArray(spec.dataset) && spec.dataset.length > 0;
  const activeDataset = showSampleData || !realHasData
    ? (spec.sampleDataset && spec.sampleDataset.length > 0 ? spec.sampleDataset : spec.dataset)
    : spec.dataset;

  const dataKeys = spec.dataKeys && spec.dataKeys.length > 0 ? spec.dataKeys : ['value'];
  const xAxisKey = spec.xAxisKey || 'category';

  const renderChartGraphic = () => {
    if (!activeDataset || activeDataset.length === 0) {
      return (
        <div className="h-48 flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          No chart data available
        </div>
      );
    }

    switch (spec.chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={activeDataset} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '12px', border: 'none', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              {dataKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={PALETTE[idx % PALETTE.length]}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: PALETTE[idx % PALETTE.length] }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        const pieDataKey = dataKeys[0] || 'value';
        return (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={activeDataset}
                dataKey={pieDataKey}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                paddingAngle={4}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {activeDataset.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '12px', border: 'none', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={activeDataset} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '12px', border: 'none', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              {dataKeys.map((key, idx) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={PALETTE[idx % PALETTE.length]}
                  fill={PALETTE[idx % PALETTE.length]}
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
      default:
        return (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={activeDataset} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '12px', border: 'none', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              {dataKeys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={PALETTE[idx % PALETTE.length]}
                  radius={[6, 6, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  const getChartIcon = () => {
    switch (spec.chartType) {
      case 'line': return <LineIcon className="w-4 h-4 text-violet-600" />;
      case 'pie': return <PieIcon className="w-4 h-4 text-indigo-600" />;
      case 'area': return <Activity className="w-4 h-4 text-emerald-600" />;
      default: return <BarChart2 className="w-4 h-4 text-violet-600" />;
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:shadow-md transition-shadow relative space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200/80 shrink-0">
            {getChartIcon()}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-800 truncate">{spec.title}</h4>
            {spec.description && (
              <p className="text-[11px] text-slate-500 truncate">{spec.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {spec.sqlQueryDescription && (
            <button
              type="button"
              onClick={() => setShowSql(!showSql)}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                showSql ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
              }`}
              title="Toggle SQL Query Logic"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          )}

          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(spec)}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                isPinned
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
              }`}
              title={isPinned ? 'Unpin from dashboard' : 'Pin to top dashboard'}
            >
              {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
                {isPinned ? 'Pinned' : 'Pin'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* SQL Query Modal / Drawer overlay */}
      {showSql && spec.sqlQueryDescription && (
        <div className="p-2.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] space-y-1 border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans uppercase tracking-wider">
            <span className="flex items-center gap-1"><Database className="w-3 h-3 text-violet-400" /> Generated SQL Execution</span>
          </div>
          <p className="text-emerald-400 break-all select-all">{spec.sqlQueryDescription}</p>
        </div>
      )}

      {/* Sparse Data Notice & Toggle (Approach 5A) */}
      {(!realHasData || showSampleData) && (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs text-amber-900">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-[11px] font-medium truncate">
              {!realHasData ? 'Sparse workspace data — showing sample preview' : 'Viewing with sample preview data'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSampleData(!showSampleData)}
            className="px-2 py-1 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg text-[11px] font-bold text-amber-950 shrink-0 cursor-pointer flex items-center gap-1"
          >
            <Eye className="w-3 h-3 text-amber-700" />
            <span>{showSampleData ? 'Real Data' : 'Sample Data'}</span>
          </button>
        </div>
      )}

      {/* Recharts Render Area */}
      <div className="pt-1">
        {renderChartGraphic()}
      </div>

      {/* Summary Note */}
      {spec.summaryNote && (
        <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200/60 p-2 rounded-xl italic">
          💡 {spec.summaryNote}
        </div>
      )}
    </div>
  );
};
