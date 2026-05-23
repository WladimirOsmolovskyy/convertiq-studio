'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Users } from 'lucide-react';
import type { Question, LeadField } from '@/lib/types';
import styles from './leads.module.css';

type ResponseRow = {
  id: string;
  session_id: string;
  total_score: number | null;
  audience_id: string | null;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
};

type AudienceRow = { id: string; name: string; color: string | null };

function pickFieldByLabel(fields: LeadField[], re: RegExp): LeadField | undefined {
  return fields.find((f) => re.test(f.label || ''));
}

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
  audience: AudienceRow | null;
  started_at: string;
  completed_at: string | null;
  durationMs: number | null;
};

export default function LeadsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const [questionsRes, qRes, audiencesRes] = await Promise.all([
        supabase
          .from('questions')
          .select('id, type, title, sort_order')
          .eq('questionnaire_id', id)
          .order('sort_order'),
        supabase
          .from('questionnaires')
          .select('lead_fields, template:lead_field_templates(fields)')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('questionnaire_audiences')
          .select('id, name, color')
          .eq('questionnaire_id', id),
      ]);
      const audienceMap = new Map<string, AudienceRow>(
        ((audiencesRes.data ?? []) as AudienceRow[]).map((a) => [a.id, a]),
      );
      const questions = (questionsRes.data || []) as Pick<Question, 'id' | 'type' | 'title'>[];

      const templateFields = (() => {
        const p = qRes.data?.template as unknown;
        if (Array.isArray(p)) return (p[0] as { fields?: LeadField[] } | undefined)?.fields ?? [];
        return (p as { fields?: LeadField[] } | null | undefined)?.fields ?? [];
      })();
      const qFields = (qRes.data?.lead_fields as LeadField[] | undefined) ?? [];
      const effectiveFields = [...templateFields, ...qFields];

      const nameField = pickFieldByLabel(effectiveFields, /^name\b|first ?name|full ?name/i);
      const emailField = pickFieldByLabel(effectiveFields, /^email\b|e-?mail/i);

      // Heuristic fallback to legacy behavior when no configured fields match.
      const fallbackEmailQ = questions.find((q) => q.type === 'email');
      const fallbackNameQ =
        questions.find(
          (q) => (q.type === 'text' || q.type === 'textarea') && /name/i.test(q.title),
        ) || questions.find((q) => q.type === 'text');

      const responsesRes = await supabase
        .from('responses')
        .select('id, session_id, total_score, audience_id, started_at, completed_at, metadata')
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

      const resolveFromConfig = (
        responseMeta: Record<string, unknown> | null,
        responseId: string,
        field: LeadField | undefined,
      ): string | null => {
        if (!field) return null;
        const stored = (responseMeta?.lead_fields as Record<string, string> | undefined)?.[field.id];
        if (stored) return stored;
        if (field.kind === 'question' && field.questionId) {
          const a = answers.find(
            (x) => x.response_id === responseId && x.question_id === field.questionId,
          );
          return a?.answer?.value ?? null;
        }
        if (field.urlParam) {
          const legacy = (responseMeta?.lead_fields as Record<string, string> | undefined)?.[field.urlParam];
          return legacy ?? null;
        }
        return null;
      };

      const mapped: Lead[] = responses.map((r) => {
        let name = resolveFromConfig(r.metadata, r.id, nameField);
        let email = resolveFromConfig(r.metadata, r.id, emailField);
        if (!name && fallbackNameQ) {
          name = answers.find((a) => a.response_id === r.id && a.question_id === fallbackNameQ.id)?.answer?.value ?? null;
        }
        if (!email && fallbackEmailQ) {
          email = answers.find((a) => a.response_id === r.id && a.question_id === fallbackEmailQ.id)?.answer?.value ?? null;
        }
        const durationMs =
          r.completed_at && r.started_at
            ? new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()
            : null;
        return {
          id: r.id,
          name,
          email,
          score: r.total_score,
          audience: r.audience_id ? audienceMap.get(r.audience_id) ?? null : null,
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
          <div className={styles.cell}>Audience</div>
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
            <div className={styles.cell}>
              {lead.audience ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: lead.audience.color ?? 'var(--text-muted)',
                      display: 'inline-block',
                    }}
                  />
                  {lead.audience.name}
                </span>
              ) : (
                <span className={styles.dim}>——</span>
              )}
            </div>
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
