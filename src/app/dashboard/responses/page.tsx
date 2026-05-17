'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart3 } from 'lucide-react';
import styles from '../dashboard.module.css';

interface ResponseRow {
  id: string;
  questionnaire_id: string;
  session_id: string;
  total_score: number | null;
  started_at: string;
  completed_at: string | null;
  questionnaire_title?: string;
}

export default function ResponsesPage() {
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [responseAnswers, setResponseAnswers] = useState<any[]>([]);

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    const supabase = createClient();
    const { data: questionnaires } = await supabase.from('questionnaires').select('id, title');
    const { data } = await supabase.from('responses').select('*').order('started_at', { ascending: false });

    const enriched = (data || []).map((r: any) => ({
      ...r,
      questionnaire_title: questionnaires?.find((q: any) => q.id === r.questionnaire_id)?.title || 'Unknown',
    }));

    setResponses(enriched);
    setLoading(false);
  };

  const viewDetails = async (responseId: string) => {
    if (selectedResponse === responseId) {
      setSelectedResponse(null);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.from('response_answers').select('*').eq('response_id', responseId).order('answered_at');
    setResponseAnswers(data || []);
    setSelectedResponse(responseId);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className={styles.contentBody}>
      <div className={styles.largeTitleBlock}>
        <h1 className={styles.largeTitle}>Responses</h1>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: '180px', borderRadius: 'var(--radius-xl)' }} />
      ) : responses.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}><BarChart3 size={28} strokeWidth={1.5} /></div>
          <h2 className={styles.emptyStateTitle}>No responses yet</h2>
          <p className={styles.emptyStateDesc}>Publish a questionnaire and share the link to collect responses.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {responses.map((r) => (
            <div key={r.id}>
              <div
                className="card"
                onClick={() => viewDetails(r.id)}
                style={{ cursor: 'pointer', padding: '0.875rem 1.125rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.1875rem', fontSize: '0.875rem', letterSpacing: '-0.012em' }}>
                      {r.questionnaire_title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem' }}>
                      <span>Session: {r.session_id.substring(0, 8)}…</span>
                      <span>{formatDate(r.started_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {r.total_score !== null && (
                      <span className="badge badge-accent">Score: {r.total_score}</span>
                    )}
                    <span className={`badge ${r.completed_at ? 'badge-success' : 'badge-warning'}`}>
                      {r.completed_at ? 'Completed' : 'Partial'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedResponse === r.id && responseAnswers.length > 0 && (
                <div style={{
                  marginTop: '0.375rem', padding: '0.875rem 1.125rem',
                  background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--separator)',
                }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Answers ({responseAnswers.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {responseAnswers.map((ans: any) => (
                      <div key={ans.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        padding: '0.625rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-secondary)',
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.1875rem', fontFamily: "ui-monospace, 'SF Mono', monospace" }}>
                            {ans.question_id.substring(0, 8)}…
                          </div>
                          <div style={{ fontSize: '0.8125rem' }}>
                            {ans.answer?.value || ans.answer?.selected_options?.join(', ') || '—'}
                          </div>
                          {ans.ai_reasoning && (
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.1875rem', fontStyle: 'italic' }}>
                              AI: {ans.ai_reasoning}
                            </div>
                          )}
                        </div>
                        {ans.score !== null && (
                          <span className="badge badge-accent" style={{ flexShrink: 0 }}>{ans.score} pts</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
