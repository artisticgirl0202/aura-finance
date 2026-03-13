/**
 * UiIcon — lucide-react icon wrapper for consistent Enterprise UI.
 * Maps emoji/string keys to professional vector icons with aligned styling.
 */

import {
  AlertCircle,
  AlertTriangle,
  BarChart2,
  Banknote,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  PieChart,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const EMOJI_TO_ICON: Record<string, LucideIcon> = {
  '💡': AlertCircle,
  '⚠️': AlertTriangle,
  '🌟': Sparkles,
  '🚨': AlertCircle,
  '🔒': Lock,
  '⚡': Zap,
  '✅': CheckCircle2,
  '❌': X,
  '🔎': Search,
  '💰': Wallet,
  '💸': Banknote,
  '📊': BarChart2,
  '📈': TrendingUp,
  '🎯': Target,
  '🏆': Target,
  '👍': CheckCircle2,
  '↻': Loader2,
  '⟳': Loader2,
  '🏦': Banknote,
  '💳': Wallet,
  '💎': Sparkles,
};

const NAMED_ICONS: Record<string, LucideIcon> = {
  info: AlertCircle,
  warning: AlertTriangle,
  success: Sparkles,
  danger: AlertCircle,
  lightbulb: AlertCircle,
  'alert-triangle': AlertTriangle,
  sparkles: Sparkles,
  'alert-circle': AlertCircle,
  lock: Lock,
  zap: Zap,
  target: Target,
  wallet: Wallet,
  'bar-chart': BarChart2,
  'pie-chart': PieChart,
  search: Search,
  check: CheckCircle2,
  x: X,
  'trash': Trash2,
  'trending-up': TrendingUp,
  load: Loader2,
};

interface UiIconProps {
  /** Icon key: lucide name or emoji */
  name: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function UiIcon({ name, size = 18, color = 'currentColor', style = {}, className }: UiIconProps) {
  const Icon = NAMED_ICONS[name] ?? EMOJI_TO_ICON[name] ?? AlertCircle;
  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={2}
      style={{ flexShrink: 0, verticalAlign: 'middle', ...style }}
      className={className}
    />
  );
}

export {
  AlertCircle,
  AlertTriangle,
  BarChart2,
  Banknote,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  PieChart,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
  Zap,
};
