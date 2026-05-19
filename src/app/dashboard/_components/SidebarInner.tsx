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
  BarChart3,
  BookOpen,
  Settings,
  LogOut,
  FolderKanban,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { Project } from '@/lib/types';
import ProjectSwitcher from './ProjectSwitcher';
import styles from '../dashboard.module.css';

type NavItem = {
  label: string;
  icon: ReactNode;
  path: string;
  match?: (pathname: string) => boolean;
};
type NavSection = { title?: string; items: NavItem[] };

export default function SidebarInner({
  children,
  projects,
  activeProjectId,
  userEmail,
}: {
  children: React.ReactNode;
  projects: Project[];
  activeProjectId: string;
  userEmail: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const ip = { size: 17, strokeWidth: 1.75 };

  const sections: NavSection[] = [
    {
      title: 'Studio',
      items: [
        {
          label: 'Questionnaires',
          icon: <ClipboardList {...ip} />,
          path: '/dashboard',
          match: (p) => p === '/dashboard' || p.startsWith('/dashboard/questionnaire'),
        },
        { label: 'Ads', icon: <Megaphone {...ip} />, path: '/dashboard/ads' },
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
      title: 'Activity',
      items: [
        { label: 'Responses', icon: <BarChart3 {...ip} />, path: '/dashboard/responses' },
        { label: 'Import Docs', icon: <BookOpen {...ip} />, path: '/docs' },
      ],
    },
    {
      items: [
        { label: 'Projects', icon: <FolderKanban {...ip} />, path: '/dashboard/projects' },
        { label: 'Settings', icon: <Settings {...ip} />, path: '/dashboard/settings' },
      ],
    },
  ];

  const isActive = (item: NavItem) =>
    item.match ? item.match(pathname) : pathname === item.path;

  // Warm every sidebar route on mount so first-click lag in dev disappears.
  // In production, Next's built-in Link prefetch already handles this.
  useEffect(() => {
    for (const section of sections) {
      for (const item of section.items) {
        router.prefetch(item.path);
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
              {section.items.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`${styles.navItem} ${isActive(item) ? styles.active : ''}`}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
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

      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}
