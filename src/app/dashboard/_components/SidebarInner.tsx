'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ClipboardList,
  Megaphone,
  Palette,
  PenLine,
  LayoutGrid,
  BookOpen,
  Settings,
  LogOut,
  FolderKanban,
  Tag,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Project } from '@/lib/types';
import ProjectSwitcher from './ProjectSwitcher';
import TopBar from './TopBar';
import styles from '../dashboard.module.css';

const QUESTIONNAIRE_LS_KEY = 'convertiq.activeQuestionnaireId';

type QuestionnaireLite = {
  id: string;
  title: string;
  slug: string;
  is_published: boolean;
  updated_at: string;
  domain?: { domain: string } | null;
};

type AdTemplateLite = { id: string; title: string; updated_at: string };

type NavChild = {
  label: string;
  path: string;
  match?: (pathname: string) => boolean;
};
type NavItem = {
  label: string;
  icon: ReactNode;
  path: string;
  match?: (pathname: string) => boolean;
  children?: NavChild[];
};
type NavSection = { title?: string; items: NavItem[] };

export default function SidebarInner({
  children,
  projects,
  activeProjectId,
  userEmail,
  questionnaires,
  adTemplates,
}: {
  children: React.ReactNode;
  projects: Project[];
  activeProjectId: string;
  userEmail: string;
  questionnaires: QuestionnaireLite[];
  adTemplates: AdTemplateLite[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Active questionnaire id: URL > localStorage > first available
  const urlQuestionnaireId = useMemo(() => {
    const m = pathname.match(/^\/dashboard\/questionnaire\/([^/]+)/);
    return m?.[1] ?? null;
  }, [pathname]);

  const [storedQuestionnaireId, setStoredQuestionnaireId] = useState<string | null>(null);
  // Bridge localStorage into React state: read once on mount; write + update
  // whenever the URL switches to a different questionnaire.
  useEffect(() => {
    try {
      setStoredQuestionnaireId(localStorage.getItem(QUESTIONNAIRE_LS_KEY));
    } catch {}
  }, []);
  useEffect(() => {
    if (!urlQuestionnaireId) return;
    try {
      localStorage.setItem(QUESTIONNAIRE_LS_KEY, urlQuestionnaireId);
    } catch {}
    setStoredQuestionnaireId(urlQuestionnaireId);
  }, [urlQuestionnaireId]);

  const activeQuestionnaireId =
    urlQuestionnaireId ??
    (storedQuestionnaireId && questionnaires.some((q) => q.id === storedQuestionnaireId)
      ? storedQuestionnaireId
      : questionnaires[0]?.id ?? null);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const ip = { size: 17, strokeWidth: 1.75 };

  const qTab = (tab: string) =>
    activeQuestionnaireId ? `/dashboard/questionnaire/${activeQuestionnaireId}/${tab}` : '/dashboard';

  const questionnaireChildren: NavChild[] = [
    {
      label: 'Overview',
      path: '/dashboard',
      match: (p) => p === '/dashboard',
    },
    {
      label: 'Content',
      path: qTab('content'),
      match: (p) => /^\/dashboard\/questionnaire\/[^/]+\/content/.test(p),
    },
    {
      label: 'Logic',
      path: qTab('logic'),
      match: (p) => /^\/dashboard\/questionnaire\/[^/]+\/logic/.test(p),
    },
    {
      label: 'Scoring',
      path: qTab('scoring'),
      match: (p) => /^\/dashboard\/questionnaire\/[^/]+\/scoring/.test(p),
    },
    {
      label: 'Design',
      path: qTab('design'),
      match: (p) => /^\/dashboard\/questionnaire\/[^/]+\/design/.test(p),
    },
    {
      label: 'Settings',
      path: qTab('settings'),
      match: (p) => /^\/dashboard\/questionnaire\/[^/]+\/settings/.test(p),
    },
    {
      label: 'Preview',
      path: qTab('preview'),
      match: (p) => /^\/dashboard\/questionnaire\/[^/]+\/preview/.test(p),
    },
    {
      label: 'Leads',
      path: activeQuestionnaireId
        ? `/dashboard/questionnaire/${activeQuestionnaireId}/leads`
        : '/dashboard/leads',
      match: (p) =>
        p.startsWith('/dashboard/leads') ||
        /^\/dashboard\/questionnaire\/[^/]+\/leads/.test(p),
    },
  ];

  const sections: NavSection[] = [
    {
      title: 'Studio',
      items: [
        {
          label: 'Questionnaires',
          icon: <ClipboardList {...ip} />,
          path: '/dashboard',
          match: (p) =>
            p === '/dashboard' ||
            p.startsWith('/dashboard/questionnaire') ||
            p.startsWith('/dashboard/leads'),
          children: questionnaireChildren,
        },
        {
          label: 'Ads',
          icon: <Megaphone {...ip} />,
          path: '/dashboard/ads/templates',
          match: (p) => p === '/dashboard/ads' || p.startsWith('/dashboard/ads/'),
          children: [
            {
              label: 'Templates',
              path: '/dashboard/ads/templates',
              match: (p) => p === '/dashboard/ads' || p.startsWith('/dashboard/ads/templates'),
            },
            {
              label: 'Generations',
              path: '/dashboard/ads/generations',
              match: (p) => p.startsWith('/dashboard/ads/generations'),
            },
          ],
        },
        { label: 'Brand', icon: <Palette {...ip} />, path: '/dashboard/brand' },
        { label: 'Copy', icon: <PenLine {...ip} />, path: '/dashboard/copy' },
      ],
    },
    {
      title: 'Tools',
      items: [
        { label: 'All Tools', icon: <LayoutGrid {...ip} />, path: '/dashboard/tools' },
      ],
    },
    {
      title: 'Global',
      items: [
        { label: 'Import Docs', icon: <BookOpen {...ip} />, path: '/docs' },
        { label: 'Projects', icon: <FolderKanban {...ip} />, path: '/dashboard/projects' },
        { label: 'Lead templates', icon: <Tag {...ip} />, path: '/dashboard/lead-templates' },
        { label: 'Settings', icon: <Settings {...ip} />, path: '/dashboard/settings' },
      ],
    },
  ];

  const isActive = (item: { match?: (p: string) => boolean; path: string }) =>
    item.match ? item.match(pathname) : pathname === item.path;

  // Warm every sidebar route on mount so first-click lag in dev disappears.
  // In production, Next's built-in Link prefetch already handles this.
  useEffect(() => {
    for (const section of sections) {
      for (const item of section.items) {
        router.prefetch(item.path);
        for (const child of item.children ?? []) {
          router.prefetch(child.path);
        }
      }
    }
    // sections is constructed inline above; dependency on router only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <div className={styles.dashboardLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarBrand}>ConvertIQ Studio</span>
        </div>

        <div className={styles.sidebarSubheader}>
          <ProjectSwitcher projects={projects} activeProjectId={activeProjectId} />
        </div>

        <nav className={styles.sidebarNav}>
          {sections.map((section, i) => (
            <div key={i} className={styles.sidebarSectionGroup}>
              {section.title && (
                <div className={styles.sidebarSection}>{section.title}</div>
              )}
              {section.items.map((item) => {
                const itemActive = isActive(item);
                return (
                  <div key={item.path}>
                    <Link
                      href={item.path}
                      className={`${styles.navItem} ${itemActive ? styles.active : ''}`}
                    >
                      <span className={styles.navIcon}>{item.icon}</span>
                      {item.label}
                    </Link>
                    {item.children && itemActive && (
                      <div className={styles.navChildren}>
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            href={child.path}
                            className={`${styles.navChild} ${isActive(child) ? styles.navChildActive : ''}`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {userEmail ? userEmail[0].toUpperCase() : '?'}
            </div>
            <span className={styles.userEmail}>{userEmail}</span>
            <button
              className={styles.signOutBtn}
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      <main className={styles.mainContent}>
        <TopBar
          questionnaires={questionnaires}
          adTemplates={adTemplates}
          activeProjectId={activeProjectId}
        />
        {children}
      </main>
    </div>
  );
}
