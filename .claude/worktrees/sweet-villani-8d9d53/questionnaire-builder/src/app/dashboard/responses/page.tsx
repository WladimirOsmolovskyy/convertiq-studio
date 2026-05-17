'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
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
    <>
      <div className={styles.contentHeader}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700 }}>Responses</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            View submissions from your published questionnaires
          </p>
        </div>
      </div>

      <div className={styles.contentBody}>
        {loading ? (
          <div className="skeleton" style={{ height: '200px' }} />
        ) : responses.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>📊</div>
            <h2 className={styles.emptyStateTitle}>No responses yet</h2>
            <p className={styles.emptyStateDesc}>Publish a questionnaire and share the link to collect responses.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {responses.map((r) => (
              <div key={r.id}>
                <div
                  className="card card-hover"
                  onClick={() => viewDetails(r.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{r.questionnaire_title}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem' }}>
                        <span>Session: {r.session_id.substring(0, 8)}...</span>
                        <span>{formatDate(r.started_at)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {r.total_score !== null && (
                        <span className="badge badge-accent">Score: {r.total_score}</span>
                      )}
                      <span className={`badge ${r.completed_at ? 'badge-success' : 'badge-warning'}`}>
                        {r.completed_at ? 'Completed' : 'Partial'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {selectedResponse === r.id && responseAnswers.length > 0 && (
                  <div className="animate-fade-in" style={{ marginTop: '0.5rem', padding: '1rem 1.5rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                      Answers ({responseAnswers.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {responseAnswers.map((ans: any) => (
                        <div key={ans.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Question: {ans.question_id.substring(0, 8)}...</div>
                            <div style={{ fontSize: '0.875rem' }}>
                              {ans.answer?.value || ans.answer?.selected_options?.join(', ') || '—'}
                            </div>
                            {ans.ai_reasoning && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                AI: {ans.ai_reasoning}
                              </div>
                            )}
                          </div>
                          {ans.score !== null && (
                            <span className="badge badge-accent" style={{ alignSelf: 'center' }}>{ans.score} pts</span>
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
    </>
  );
}
