'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft } from 'lucide-react';
import type { Question, QuestionOption, LeadField } from '@/lib/types';
import { resolveLeadFields } from '@/lib/leadFields';
import styles from '../leads.module.css';

type ResponseRow = {
  id: string;
  questionnaire_id: string;
  session_id: string;
  total_score: number | null;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
};

type AnswerRow = {
  id: string;
  response_id: string;
  question_id: string;
  answer: { value?: string; selected_options?: string[] } | null;
  score: number | null;
  ai_reasoning: string | null;
  answered_at: string;
};

function formatAnswer(
  answer: AnswerRow['answer'],
  question: Pick<Question, 'type' | 'options'> | undefined,
): string {
  if (!answer) return '—';
  if (answer.value) return answer.value;
  const ids = answer.selected_options ?? [];
  if (ids.length === 0) return '—';
  if (!question) return ids.join(', ');
  const labels = ids
    .map((id) => question.options.find((o: QuestionOption) => o.id === id)?.label ?? id)
    .filter(Boolean);
  return labels.join(', ');
}

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string; leadId: string }>;
}) {
  const { id, leadId } = use(params);
  const router = useRouter();
  const [lead, setLead] = useState<ResponseRow | null>(null);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [leadFieldDefs, setLeadFieldDefs] = useState<LeadField[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [respRes, answersRes, questionsRes, qRes] = await Promise.all([
        supabase
          .from('responses')
          .select('id, questionnaire_id, session_id, total_score, started_at, completed_at, metadata')
          .eq('id', leadId)
          .eq('questionnaire_id', id)
          .maybeSingle(),
        supabase
          .from('response_answers')
          .select('*')
          .eq('response_id', leadId)
          .order('answered_at'),
        supabase
          .from('questions')
          .select('*')
          .eq('questionnaire_id', id)
          .order('sort_order'),
        supabase
          .from('questionnaires')
          .select('lead_fields, project:projects(lead_fields)')
          .eq('id', id)
          .maybeSingle(),
      ]);

      if (!respRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLead(respRes.data as ResponseRow);
      setAnswers((answersRes.data || []) as AnswerRow[]);
      setQuestions((questionsRes.data || []) as Question[]);
      const projectFields = (() => {
        const p = qRes.data?.project as unknown;
        if (Array.isArray(p)) return (p[0] as { lead_fields?: LeadField[] } | undefined)?.lead_fields;
        return (p as { lead_fields?: LeadField[] } | null | undefined)?.lead_fields;
      })();
      setLeadFieldDefs(
        resolveLeadFields(
          projectFields ?? [],
          (qRes.data?.lead_fields as LeadField[] | undefined) ?? [],
        ),
      );
      setLoading(false);
    };
    load();
  }, [id, leadId]);

  if (loading) {
    return (
      <div className={styles.body}>
        <div className={styles.bodyInner}>
          <div className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-xl)' }} />
        </div>
      </div>
    );
  }

  if (notFound || !lead) {
    return (
      <div className={styles.body}>
        <div className={styles.bodyInner}>
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>Lead not found</h2>
            <p className={styles.emptyDesc}>
              This lead may have been deleted or does not belong to this questionnaire.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const emailQ = questions.find((q) => q.type === 'email');
  const nameQ =
    questions.find(
      (q) => (q.type === 'text' || q.type === 'textarea') && /name/i.test(q.title),
    ) || questions.find((q) => q.type === 'text');

  const email = emailQ ? answers.find((a) => a.question_id === emailQ.id)?.answer?.value : null;
  const name = nameQ ? answers.find((a) => a.question_id === nameQ.id)?.answer?.value : null;

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  const durationMs =
    lead.completed_at && lead.started_at
      ? new Date(lead.completed_at).getTime() - new Date(lead.started_at).getTime()
      : null;

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '—';
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const host = typeof lead.metadata === 'object' && lead.metadata
    ? (lead.metadata as Record<string, unknown>).host
    : null;
  const userAgent = typeof lead.metadata === 'object' && lead.metadata
    ? (lead.metadata as Record<string, unknown>).user_agent
    : null;
  const capturedFields =
    typeof lead.metadata === 'object' && lead.metadata
      ? ((lead.metadata as Record<string, unknown>).lead_fields as Record<string, string> | undefined)
      : undefined;
  const capturedEntries = capturedFields ? Object.entries(capturedFields) : [];

  return (
    <div className={styles.body}>
      <div className={styles.bodyInner}>
      <div className={styles.detailHeader}>
        <button
          className={styles.backBtn}
          onClick={() => router.push(`/dashboard/questionnaire/${id}/leads`)}
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          All leads
        </button>
      </div>

      <h1 className={styles.detailTitle}>{name || email || `Lead · ${lead.session_id.slice(0, 8)}…`}</h1>

      <div className={styles.metaGrid} style={{ marginTop: '1.25rem' }}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Name</span>
          <span className={styles.metaValue}>{name || '——'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Email</span>
          <span className={styles.metaValue}>{email || '——'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Started</span>
          <span className={styles.metaValue}>{formatDate(lead.started_at)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Completed</span>
          <span className={styles.metaValue}>{formatDate(lead.completed_at)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Duration</span>
          <span className={styles.metaValue}>{formatDuration(durationMs)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Score</span>
          <span className={styles.metaValue}>
            {lead.total_score !== null ? lead.total_score : '——'}
          </span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Source</span>
          <span className={styles.metaValue}>{(host as string) || '——'}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Session</span>
          <span className={styles.metaValue} style={{ fontFamily: "ui-monospace, 'SF Mono', monospace", fontSize: '0.8125rem' }}>
            {lead.session_id}
          </span>
        </div>
      </div>

      {(leadFieldDefs.length > 0 || capturedEntries.length > 0) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Custom fields</div>
          <div className={styles.metaGrid}>
            {(leadFieldDefs.length > 0
              ? leadFieldDefs.map((f) => ({
                  key: f.urlParam,
                  label: f.label || f.urlParam,
                  value: capturedFields?.[f.urlParam],
                }))
              : capturedEntries.map(([k, v]) => ({ key: k, label: k, value: v }))
            ).map((row) => (
              <div key={row.key} className={styles.metaItem}>
                <span className={styles.metaLabel}>{row.label}</span>
                <span className={styles.metaValue}>{row.value || '——'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Answers ({answers.length})</div>
        {answers.length === 0 ? (
          <div className={styles.answerCard}>
            <span className={styles.dim}>No answers recorded.</span>
          </div>
        ) : (
          <div className={styles.answerList}>
            {answers.map((a) => {
              const q = questions.find((qq) => qq.id === a.question_id);
              return (
                <div key={a.id} className={styles.answerCard}>
                  <div className={styles.answerQ}>{q?.title || a.question_id}</div>
                  <div>
                    <span className={styles.answerA}>{formatAnswer(a.answer, q)}</span>
                    {a.score !== null && (
                      <span className={`badge badge-accent ${styles.answerScore}`}>
                        {a.score} pts
                      </span>
                    )}
                  </div>
                  {a.ai_reasoning && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem', fontStyle: 'italic' }}>
                      AI: {a.ai_reasoning}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {typeof userAgent === 'string' && userAgent.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Device</div>
          <div className={styles.answerCard}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
              {userAgent}
            </span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
