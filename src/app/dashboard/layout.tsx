'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, type ReactNode } from 'react';
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
} from 'lucide-react';
import styles from './dashboard.module.css';

type NavItem = { label: string; icon: ReactNode; path: string; match?: (pathname: string) => boolean };
type NavSection = { title?: string; items: NavItem[] };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || '');
    });
  }, []);

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
        { label: 'Settings', icon: <Settings {...ip} />, path: '/dashboard/settings' },
      ],
    },
  ];

  const isActive = (item: NavItem) =>
    item.match ? item.match(pathname) : pathname === item.path;

  return (
    <div className={styles.dashboardLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarBrand}>Studio</span>
        </div>

        <nav className={styles.sidebarNav}>
          {sections.map((section, i) => (
            <div key={i} className={styles.sidebarSectionGroup}>
              {section.title && (
                <div className={styles.sidebarSection}>{section.title}</div>
              )}
              {section.items.map((item) => (
                <button
                  key={item.path}
                  className={`${styles.navItem} ${isActive(item) ? styles.active : ''}`}
                  onClick={() => router.push(item.path)}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {item.label}
                </button>
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
