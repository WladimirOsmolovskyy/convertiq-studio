'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import styles from './dashboard.module.css';

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

  const navItems = [
    { label: 'Questionnaires', icon: '📋', path: '/dashboard' },
    { label: 'Responses', icon: '📊', path: '/dashboard/responses' },
    { label: 'Import Docs', icon: '📖', path: '/docs' },
    { label: 'Settings', icon: '⚙️', path: '/dashboard/settings' },
  ];

  return (
    <div className={styles.dashboardLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarLogo}>✦</div>
          <span className={styles.sidebarBrand}>QuizBuilder</span>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`${styles.navItem} ${pathname === item.path ? styles.active : ''}`}
              onClick={() => router.push(item.path)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {userEmail ? userEmail[0].toUpperCase() : '?'}
            </div>
            <span className={styles.userEmail}>{userEmail}</span>
          </div>
          <button className={`${styles.navItem}`} onClick={handleLogout} style={{ marginTop: '0.5rem' }}>
            <span className={styles.navIcon}>🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}
