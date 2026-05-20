'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown,
  ExternalLink,
  LayoutGrid,
  Plus,
  Search,
  ClipboardList,
  Megaphone,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from 'nanoid';
import styles from '../dashboard.module.css';

type QuestionnaireLite = {
  id: string;
  title: string;
  slug: string;
  is_published: boolean;
  updated_at: string;
  domain?: { domain: string } | null;
};

type AdTemplateLite = {
  id: string;
  title: string;
  updated_at: string;
};

type Section = 'questionnaires' | 'ads-templates' | 'ads-generations' | 'none';

const QUESTIONNAIRE_LS_KEY = 'convertiq.activeQuestionnaireId';
const AD_TEMPLATE_LS_KEY = 'convertiq.activeAdTemplateId';

function detectSection(pathname: string): Section {
  if (pathname === '/dashboard') return 'questionnaires';
  if (pathname.startsWith('/dashboard/questionnaire')) return 'questionnaires';
  if (pathname.startsWith('/dashboard/leads')) return 'questionnaires';
  if (pathname.startsWith('/dashboard/ads/generations')) return 'ads-generations';
  if (pathname.startsWith('/dashboard/ads')) return 'ads-templates';
  return 'none';
}

function activeQuestionnaireIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/dashboard\/questionnaire\/([^/]+)/);
  return m?.[1] ?? null;
}

function activeAdTemplateIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/dashboard\/ads\/templates\/([^/]+)/);
  return m?.[1] ?? null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB');
}

export default function TopBar({
  questionnaires,
  adTemplates,
  activeProjectId,
}: {
  questionnaires: QuestionnaireLite[];
  adTemplates: AdTemplateLite[];
  activeProjectId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const section = detectSection(pathname);

  const urlQuestionnaireId = activeQuestionnaireIdFromPath(pathname);
  const urlAdTemplateId = activeAdTemplateIdFromPath(pathname);

  // Persist URL-derived active ids to localStorage so the bar/sub-nav can still
  // pick them up when the user navigates back to a list page.
  useEffect(() => {
    if (urlQuestionnaireId) {
      try {
        localStorage.setItem(QUESTIONNAIRE_LS_KEY, urlQuestionnaireId);
      } catch {}
    }
  }, [urlQuestionnaireId]);

  useEffect(() => {
    if (urlAdTemplateId) {
      try {
        localStorage.setItem(AD_TEMPLATE_LS_KEY, urlAdTemplateId);
      } catch {}
    }
  }, [urlAdTemplateId]);

  const activeQuestionnaireId = useMemo(() => {
    if (urlQuestionnaireId) return urlQuestionnaireId;
    if (typeof window === 'undefined') return questionnaires[0]?.id ?? null;
    const stored = (() => {
      try {
        return localStorage.getItem(QUESTIONNAIRE_LS_KEY);
      } catch {
        return null;
      }
    })();
    if (stored && questionnaires.some((q) => q.id === stored)) return stored;
    return questionnaires[0]?.id ?? null;
  }, [urlQuestionnaireId, questionnaires]);

  const activeAdTemplateId = useMemo(() => {
    if (urlAdTemplateId) return urlAdTemplateId;
    if (typeof window === 'undefined') return adTemplates[0]?.id ?? null;
    const stored = (() => {
      try {
        return localStorage.getItem(AD_TEMPLATE_LS_KEY);
      } catch {
        return null;
      }
    })();
    if (stored && adTemplates.some((t) => t.id === stored)) return stored;
    return adTemplates[0]?.id ?? null;
  }, [urlAdTemplateId, adTemplates]);

  if (section === 'none') return null;

  return (
    <div className={styles.topBar}>
      {section === 'questionnaires' && (
        <QuestionnairePicker
          items={questionnaires}
          activeId={activeQuestionnaireId}
          activeProjectId={activeProjectId}
          onCreated={(id) => {
            try {
              localStorage.setItem(QUESTIONNAIRE_LS_KEY, id);
            } catch {}
            router.push(`/dashboard/questionnaire/${id}/content`);
          }}
        />
      )}
      {section === 'ads-templates' && (
        <AdTemplatePicker
          items={adTemplates}
          activeId={activeAdTemplateId}
        />
      )}
      {section === 'ads-generations' && (
        <div className={styles.topBarStatic}>
          <Megaphone size={15} strokeWidth={1.75} />
          <span>Ad Generations</span>
        </div>
      )}
    </div>
  );
}

/* ─── Questionnaire picker ─────────────────────────────────────── */
function QuestionnairePicker({
  items,
  activeId,
  activeProjectId,
  onCreated,
}: {
  items: QuestionnaireLite[];
  activeId: string | null;
  activeProjectId: string;
  onCreated: (id: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = items.find((q) => q.id === activeId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.title.toLowerCase().includes(q));
  }, [items, query]);

  const handleSelect = (id: string) => {
    setOpen(false);
    try {
      localStorage.setItem(QUESTIONNAIRE_LS_KEY, id);
    } catch {}
    router.push(`/dashboard/questionnaire/${id}/content`);
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }
    const slug = nanoid(10);
    const { data, error } = await supabase
      .from('questionnaires')
      .insert({
        user_id: user.id,
        project_id: activeProjectId,
        title: 'Untitled Questionnaire',
        slug,
        is_published: false,
      })
      .select()
      .single();
    if (data && !error) {
      await supabase.from('questionnaire_designs').insert({
        questionnaire_id: data.id,
        config: {},
      });
      setOpen(false);
      onCreated(data.id);
    }
    setCreating(false);
  };

  const publishedUrl =
    active?.is_published && active.domain?.domain
      ? `https://${active.domain.domain}/${active.slug}`
      : null;

  return (
    <div className={styles.topBarPicker} ref={ref}>
      <button
        type="button"
        className={styles.topBarTrigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.topBarTriggerLabel}>
          {active?.title ?? 'Select questionnaire'}
        </span>
        <ChevronDown size={14} strokeWidth={1.75} />
      </button>

      {publishedUrl && (
        <a
          href={publishedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.topBarExtLink}
          aria-label="Open published questionnaire"
          title={publishedUrl}
        >
          <ExternalLink size={15} strokeWidth={1.75} />
        </a>
      )}

      {open && (
        <div className={styles.topBarMenu} role="listbox">
          <div className={styles.topBarMenuHeader}>
            <span className={styles.topBarMenuTitle}>Recent</span>
            <Search size={13} strokeWidth={1.75} className={styles.topBarMenuSearchIcon} />
          </div>

          {items.length > 6 && (
            <input
              className={styles.topBarMenuSearch}
              placeholder="Search questionnaires…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}

          <div className={styles.topBarMenuList}>
            {filtered.length === 0 ? (
              <div className={styles.topBarMenuEmpty}>No matches.</div>
            ) : (
              filtered.slice(0, 12).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.topBarMenuItem}
                  onClick={() => handleSelect(item.id)}
                >
                  <span className={styles.topBarMenuThumb}>
                    <ClipboardList size={15} strokeWidth={1.75} />
                  </span>
                  <span className={styles.topBarMenuItemBody}>
                    <span className={styles.topBarMenuItemTitle}>{item.title}</span>
                    <span className={styles.topBarMenuItemMeta}>{timeAgo(item.updated_at)}</span>
                  </span>
                  <span
                    className={`${styles.topBarMenuDot} ${
                      item.is_published ? styles.topBarMenuDotGreen : styles.topBarMenuDotAmber
                    }`}
                    aria-hidden
                  />
                </button>
              ))
            )}
          </div>

          <div className={styles.topBarMenuDivider} />

          <Link
            href="/dashboard"
            className={styles.topBarMenuAction}
            onClick={() => setOpen(false)}
          >
            <LayoutGrid size={14} strokeWidth={1.75} />
            <span>Go to Overview</span>
          </Link>
          <button
            type="button"
            className={styles.topBarMenuAction}
            onClick={handleCreate}
            disabled={creating}
          >
            <Plus size={14} strokeWidth={2} />
            <span>{creating ? 'Creating…' : 'Create Questionnaire'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Ad template picker ──────────────────────────────────────── */
function AdTemplatePicker({
  items,
  activeId,
}: {
  items: AdTemplateLite[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = items.find((t) => t.id === activeId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const handleSelect = (id: string) => {
    setOpen(false);
    try {
      localStorage.setItem(AD_TEMPLATE_LS_KEY, id);
    } catch {}
    router.push(`/dashboard/ads/templates/${id}`);
  };

  return (
    <div className={styles.topBarPicker} ref={ref}>
      <button
        type="button"
        className={styles.topBarTrigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.topBarTriggerLabel}>
          {active?.title ?? 'Select ad template'}
        </span>
        <ChevronDown size={14} strokeWidth={1.75} />
      </button>

      {open && (
        <div className={styles.topBarMenu} role="listbox">
          <div className={styles.topBarMenuHeader}>
            <span className={styles.topBarMenuTitle}>Recent</span>
          </div>
          <div className={styles.topBarMenuList}>
            {items.length === 0 ? (
              <div className={styles.topBarMenuEmpty}>No templates yet.</div>
            ) : (
              items.slice(0, 12).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.topBarMenuItem}
                  onClick={() => handleSelect(item.id)}
                >
                  <span className={styles.topBarMenuThumb}>
                    <Megaphone size={15} strokeWidth={1.75} />
                  </span>
                  <span className={styles.topBarMenuItemBody}>
                    <span className={styles.topBarMenuItemTitle}>{item.title}</span>
                    <span className={styles.topBarMenuItemMeta}>{timeAgo(item.updated_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>

          <div className={styles.topBarMenuDivider} />

          <Link
            href="/dashboard/ads/templates"
            className={styles.topBarMenuAction}
            onClick={() => setOpen(false)}
          >
            <LayoutGrid size={14} strokeWidth={1.75} />
            <span>Go to Templates</span>
          </Link>
        </div>
      )}
    </div>
  );
}
