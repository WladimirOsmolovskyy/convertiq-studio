'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Users } from 'lucide-react';
import type { Question } from '@/lib/types';
import styles from './leads.module.css';

type ResponseRow = {
  id: string;
  session_id: string;
  total_score: number | null;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
};

type AnswerRow = {
  response_id: string;
  question_id: string;
  answer: { value?: string; selected_options?: string[] } | null;
};

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  score: number | null;
  started_at: string;
  completed_at: string | null;
  durationMs: number | null;
};

function pickLeadFields(
  responseId: string,
  answers: AnswerRow[],
  nameQuestionId: string | null,
  emailQuestionId: string | null,
): { name: string | null; email: string | null } {
  let name: string | null = null;
  let email: string | null = null;
  for (const a of answers) {
    if (a.response_id !== responseId) continue;
    const value = a.answer?.value ?? null;
    if (!value) continue;
    if (nameQuestionId && a.question_id === nameQuestionId && !name) name = value;
    if (emailQuestionId && a.question_id === emailQuestionId && !email) email = value;
  }
  return { name, email };
}

export default function LeadsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const questionsRes = await supabase
        .from('questions')
        .select('id, type, title, sort_order')
        .eq('questionnaire_id', id)
        .order('sort_order');
      const questions = (questionsRes.data || []) as Pick<Question, 'id' | 'type' | 'title'>[];

      const emailQ = questions.find((q) => q.type === 'email');
      const nameQ =
        questions.find(
          (q) => (q.type === 'text' || q.type === 'textarea') && /name/i.test(q.title),
        ) || questions.find((q) => q.type === 'text');

      const responsesRes = await supabase
        .from('responses')
        .select('id, session_id, total_score, started_at, completed_at, metadata')
        .eq('questionnaire_id', id)
        .order('started_at', { ascending: false });
      const responses = (responsesRes.data || []) as ResponseRow[];

      let answers: AnswerRow[] = [];
      if (responses.length > 0) {
        const answersRes = await supabase
          .from('response_answers')
          .select('response_id, question_id, answer')
          .in(
            'response_id',
            responses.map((r) => r.id),
          );
        answers = (answersRes.data || []) as AnswerRow[];
      }

      const mapped: Lead[] = responses.map((r) => {
        const fields = pickLeadFields(r.id, answers, nameQ?.id ?? null, emailQ?.id ?? null);
        const durationMs =
          r.completed_at && r.started_at
            ? new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()
            : null;
        return {
          id: r.id,
          name: fields.name,
          email: fields.email,
          score: r.total_score,
          started_at: r.started_at,
          completed_at: r.completed_at,
          durationMs,
        };
      });

      setLeads(mapped);
      setLoading(false);
    };
    load();
  }, [id]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatDuration = (ms: number | null) => {
    if (ms === null) return '—';
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className={styles.body}>
        <div className={styles.bodyInner}>
          <div className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-xl)' }} />
        </div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className={styles.body}>
        <div className={styles.bodyInner}>
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Users size={28} strokeWidth={1.5} />
            </div>
            <h2 className={styles.emptyTitle}>No leads yet</h2>
            <p className={styles.emptyDesc}>
              Publish this questionnaire and share the link — completed sessions show up here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.body}>
      <div className={styles.bodyInner}>
      <div className={styles.table}>
        <div className={`${styles.row} ${styles.header}`}>
          <div className={styles.cell}>Name</div>
          <div className={styles.cell}>Email</div>
          <div className={styles.cell}>Date</div>
          <div className={styles.cell}>Duration</div>
          <div className={`${styles.cell} ${styles.cellRight}`}>Score</div>
        </div>
        {leads.map((lead) => (
          <button
            key={lead.id}
            className={styles.row}
            onClick={() => router.push(`/dashboard/questionnaire/${id}/leads/${lead.id}`)}
          >
            <div className={styles.cell}>{lead.name || <span className={styles.dim}>——</span>}</div>
            <div className={styles.cell}>
              {lead.email || <span className={styles.dim}>——</span>}
            </div>
            <div className={styles.cell}>{formatDate(lead.started_at)}</div>
            <div className={styles.cell}>{formatDuration(lead.durationMs)}</div>
            <div className={`${styles.cell} ${styles.cellRight}`}>
              {lead.score !== null ? (
                <span className="badge badge-accent">{lead.score}</span>
              ) : (
                <span className={`badge ${lead.completed_at ? 'badge-success' : 'badge-warning'}`}>
                  {lead.completed_at ? 'Completed' : 'Partial'}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}
