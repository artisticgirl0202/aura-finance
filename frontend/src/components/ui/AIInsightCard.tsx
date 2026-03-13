/**
 * AIInsightCard — Safe rendering of AI advice/insight data
 * ─────────────────────────────────────────────────────────────────
 * Handles Raw JSON strings from backend with try-catch parsing.
 * Prevents horizontal scroll and text overflow. Renders structured UI.
 */

import { Lightbulb } from 'lucide-react';
import { motion } from 'framer-motion';

export interface ParsedAIInsight {
  category?: string;
  advice_type?: string;
  title?: string;
  body?: string;
  message?: string;
  advice?: string;
  supporting_data?: Record<string, unknown>;
  estimated_impact?: string;
  action_items?: string[];
  [key: string]: unknown;
}

function parseInsightItem(item: unknown): ParsedAIInsight | null {
  if (item == null) return null;
  if (typeof item === 'object' && !Array.isArray(item)) {
    return item as ParsedAIInsight;
  }
  if (typeof item === 'string') {
    try {
      const parsed = JSON.parse(item) as unknown;
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as ParsedAIInsight)
        : null;
    } catch {
      return { body: item, title: 'Insight' };
    }
  }
  return null;
}

function getDisplayTitle(parsed: ParsedAIInsight, fallback: string): string {
  return (
    (parsed.title ?? parsed.category ?? parsed.advice_type ?? fallback) as string
  ).slice(0, 80) || fallback;
}

function getDisplayBody(parsed: ParsedAIInsight): string {
  const text =
    parsed.body ?? parsed.message ?? parsed.advice ?? '';
  return typeof text === 'string' ? text.slice(0, 500) : String(text).slice(0, 500);
}

interface AIInsightCardProps {
  item: unknown;
  index: number;
}

export function AIInsightCard({ item, index }: AIInsightCardProps) {
  const parsed = parseInsightItem(item);
  if (!parsed) return null;

  const title = getDisplayTitle(parsed, `Insight ${index + 1}`);
  const body = getDisplayBody(parsed);
  const impact = parsed.estimated_impact as string | undefined;
  const actionItems = Array.isArray(parsed.action_items) ? parsed.action_items : [];
  const supportingData = parsed.supporting_data as Record<string, unknown> | undefined;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      style={{
        background: 'rgba(6,182,212,0.05)',
        border: '1px solid rgba(6,182,212,0.15)',
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 10,
        overflow: 'hidden',
        wordBreak: 'break-word' as const,
        overflowWrap: 'break-word',
        overflowX: 'hidden',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#06b6d4',
          marginBottom: 4,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: '#94a3b8',
          lineHeight: 1.5,
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          overflowX: 'hidden',
        }}
      >
        {body || 'No details available.'}
      </div>
      {impact && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'rgba(16,185,129,0.1)',
            color: '#10b981',
            border: '1px solid rgba(16,185,129,0.2)',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            display: 'flex', alignItems: 'flex-start', gap: 6,
          }}
        >
          <Lightbulb size={14} strokeWidth={2} style={{ flexShrink: 0, marginRight: 6, color: '#10b981' }} /> {impact}
        </div>
      )}
      {actionItems.length > 0 && (
        <ul
          style={{
            margin: '8px 0 0 0',
            paddingLeft: 18,
            fontSize: 11,
            color: '#64748b',
            lineHeight: 1.6,
            wordBreak: 'break-word',
          }}
        >
          {actionItems.slice(0, 5).map((a, i) => (
            <li key={i}>{String(a)}</li>
          ))}
        </ul>
      )}
      {supportingData &&
        Object.keys(supportingData).length > 0 && (
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              wordBreak: 'break-word',
            }}
          >
            {Object.entries(supportingData).slice(0, 4).map(([k, v]) => (
              <span
                key={k}
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: 'rgba(139,92,246,0.1)',
                  color: '#a78bfa',
                  border: '1px solid rgba(139,92,246,0.2)',
                  overflowWrap: 'break-word',
                }}
              >
                {k}: {String(v)}
              </span>
            ))}
          </div>
        )}
    </motion.div>
  );
}
