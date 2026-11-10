import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeFirebaseInstances } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AdminUser, authService } from '../services/authService';

export const PRIMARY_ADMIN_EMAIL = 'sobujbd679@gmail.com';

export interface WorkspaceState {
  ownerUid: string | null;
  role: 'owner' | 'member';
  memberInfo: any | null;
  isAuthorized: boolean;
  loading: boolean;
  error: string | null;
}

const WorkspaceContext = createContext<WorkspaceState | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WorkspaceState>({
    ownerUid: null,
    role: 'owner',
    memberInfo: null,
    isAuthorized: false,
    loading: true,
    error: null,
  });

  const resolveWorkspace = async (user: AdminUser | null) => {
    if (!user) {
      setState({
        ownerUid: null,
        role: 'owner',
        memberInfo: null,
        isAuthorized: false,
        loading: false,
        error: null,
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    const timeoutId = setTimeout(() => {
      setState(prev => {
        if (prev.loading) {
          const userEmail = (user.email || '').toLowerCase().trim();
          if (userEmail === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
            return {
              ...prev,
              ownerUid: user.uid || null,
              role: 'owner',
              isAuthorized: true,
              loading: false,
              error: null,
            };
          }
          return {
            ...prev,
            isAuthorized: false,
            loading: false,
            error: 'আপনার অ্যাক্সেস নেই, অ্যাডমিনকে বলুন আপনার ইমেইল যোগ করতে',
          };
        }
        return prev;
      });
    }, 10000);

    try {
      const email = (user.email || '').toLowerCase().trim();
      const { db } = initializeFirebaseInstances();

      if (!db) {
        clearTimeout(timeoutId);
        setState({
          ownerUid: user.uid || null,
          role: email === PRIMARY_ADMIN_EMAIL.toLowerCase() ? 'owner' : 'member',
          memberInfo: null,
          isAuthorized: true,
          loading: false,
          error: null,
        });
        return;
      }

      const teamDocRef = doc(db, 'config', 'team');
      let teamSnap;
      try {
        teamSnap = await getDoc(teamDocRef);
      } catch (err: any) {
        console.error('Error fetching config/team:', err);
      }

      clearTimeout(timeoutId);

      // 1. Is user Primary Admin?
      if (email === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
        if (!teamSnap || !teamSnap.exists()) {
          try {
            await setDoc(teamDocRef, {
              adminEmail: PRIMARY_ADMIN_EMAIL,
              memberEmails: [],
              members: [],
              createdAt: new Date().toISOString(),
            }, { merge: true });
          } catch (e) {
            console.error('Failed to create config/team:', e);
          }
        }
        setState({
          ownerUid: user.uid || null,
          role: 'owner',
          memberInfo: { email, name: user.name, role: 'অ্যাডমিন', team: 'ম্যানেজমেন্ট' },
          isAuthorized: true,
          loading: false,
          error: null,
        });
        return;
      }

      // 2. Non-primary user: Check config/team
      if (teamSnap && teamSnap.exists()) {
        const teamData = teamSnap.data();
        const adminEmail = (teamData.adminEmail || '').toLowerCase().trim();

        if (adminEmail === email) {
          setState({
            ownerUid: user.uid || null,
            role: 'owner',
            memberInfo: { email, name: user.name, role: 'অ্যাডমিন', team: 'ম্যানেজমেন্ট' },
            isAuthorized: true,
            loading: false,
            error: null,
          });
          return;
        }

        const members: any[] = Array.isArray(teamData.members) ? teamData.members : [];
        const member = members.find((m: any) => (m.email || '').toLowerCase().trim() === email);

        if (member) {
          if (member.active !== false) {
            const isMemberAdmin = member.role === 'admin' || member.role === 'অ্যাডমিন';
            setState({
              ownerUid: null,
              role: isMemberAdmin ? 'owner' : 'member',
              memberInfo: member,
              isAuthorized: true,
              loading: false,
              error: null,
            });
            return;
          } else {
            setState({
              ownerUid: null,
              role: 'member',
              memberInfo: member,
              isAuthorized: false,
              loading: false,
              error: 'আপনার অ্যাক্সেস সাময়িকভাবে বন্ধ করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।',
            });
            return;
          }
        }
      }

      // 3. User is not authorized
      setState({
        ownerUid: null,
        role: 'member',
        memberInfo: null,
        isAuthorized: false,
        loading: false,
        error: 'আপনার অ্যাক্সেস নেই, অ্যাডমিনকে বলুন আপনার ইমেইল যোগ করতে',
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Workspace resolution error:', err);
      setState({
        ownerUid: null,
        role: 'member',
        memberInfo: null,
        isAuthorized: false,
        loading: false,
        error: 'আপনার অ্যাক্সেস নেই, অ্যাডমিনকে বলুন আপনার ইমেইল যোগ করতে',
      });
    } finally {
      clearTimeout(timeoutId);
      setState(prev => (prev.loading ? { ...prev, loading: false } : prev));
    }
  };

  useEffect(() => {
    const handleAuthChange = () => {
      const user = authService.getCurrentUser();
      resolveWorkspace(user);
    };

    window.addEventListener('auth_state_changed', handleAuthChange);
    handleAuthChange();

    return () => window.removeEventListener('auth_state_changed', handleAuthChange);
  }, []);

  return (
    <WorkspaceContext.Provider value={state}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
