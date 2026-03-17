/**
 * District Detail Panel — fills its parent container.
 * Positioning and animation are handled by the parent (App.tsx right sidebar).
 */

import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, X } from 'lucide-react';
import { getDistrictColor } from '../../constants/districtColors';
import { formatTransactionDateTime } from '../../utils/dateFormat';
import { normalizeDistrictFor3D } from '../../utils/districtMap';

interface Transaction {
  description: string;
  amount: number;
  currency?: string;
  type?: 'expense' | 'income' | 'investment';
  classification?: {
    district: string;
    confidence: number;
    reason: string;
    icon: string;
    color: string;
  };
  timestamp: number;
}

interface DistrictDetailPanelProps {
  selectedDistrict: string | null;
  transactions: Transaction[];
  onClose: () => void;
}

export function DistrictDetailPanel({
  selectedDistrict,
  transactions,
  onClose,
}: DistrictDetailPanelProps) {
  // 선택된 구역의 거래만 필터링 (양쪽 모두 정규화하여 비교 — API 응답 district와 3D building name 일치)
  const filteredTransactions = transactions.filter((tx) => {
    const txDistrict = tx.classification?.district ?? (tx as any).district;
    const normalizedTx = normalizeDistrictFor3D(txDistrict);
    const normalizedSelected = normalizeDistrictFor3D(selectedDistrict);
    return normalizedTx === normalizedSelected;
  });

  const totalAmount = filteredTransactions.reduce(
    (sum, tx) => sum + (tx.amount || 0),
    0
  );

  const averageAmount =
    filteredTransactions.length > 0
      ? totalAmount / filteredTransactions.length
      : 0;

  const districtColor = getDistrictColor(selectedDistrict);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        color: '#fff',
      }}
    >
          {/* 헤더 */}
          <div
            style={{
              padding: '24px',
              borderBottom: `1px solid ${districtColor}40`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 'bold',
                  fontFamily: 'var(--font-display)',
                  color: districtColor,
                  textShadow: `0 0 10px ${districtColor}`,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}
              >
                {selectedDistrict}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#94a3b8' }}>
                {filteredTransactions.length} transactions
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              <X size={24} />
            </button>
          </div>

          {/* 통계 카드 */}
          <div
            style={{
              padding: '24px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '16px',
                borderRadius: '12px',
                border: `1px solid ${districtColor}30`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                }}
              >
                <DollarSign size={16} color={districtColor} />
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Total Spend
                </span>
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: districtColor,
                }}
              >
                ${totalAmount.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '16px',
                borderRadius: '12px',
                border: `1px solid ${districtColor}30`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                }}
              >
                <TrendingUp size={16} color={districtColor} />
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Average
                </span>
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: districtColor,
                }}
              >
                ${averageAmount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Transaction History list */}
          <div className="cyberpunk-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px', marginRight: 8 }}>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: '600',
                fontFamily: 'var(--font-display)',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '16px',
              }}
            >
              Transaction History
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredTransactions.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: '#64748b',
                    padding: '40px 20px',
                  }}
                >
                  No transactions in this district yet
                </div>
              ) : (
                [...filteredTransactions]
                  .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
                  .map((tx, index) => {
                  const description =
                    tx.description ||
                    (tx as any).district ||
                    'Unknown Transaction';
                  const amount = tx.amount || 0;

                  return (
                    <motion.div
                      key={`${tx.timestamp}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      style={{
                        background: 'rgba(0, 0, 0, 0.2)',
                        padding: '16px',
                        borderRadius: '12px',
                        border: `1px solid ${districtColor}20`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#fff',
                            marginBottom: '4px',
                          }}
                        >
                          {description}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {formatTransactionDateTime(tx.timestamp)}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: '18px',
                          fontWeight: 'bold',
                          color:
                            (tx as any).type === 'income'
                              ? '#10b981'
                              : (tx as any).type === 'investment'
                                ? '#6366f1'
                                : '#ef4444',
                        }}
                      >
                        {(tx as any).type === 'income' || (tx as any).type === 'investment'
                          ? `+$${amount.toFixed(2)}`
                          : `-$${amount.toFixed(2)}`}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
    </motion.div>
  );
}
