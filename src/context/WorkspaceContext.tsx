import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeFirebaseInstances } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AdminUser, authService } from '../services/authService';

export interface WorkspaceState {
  ownerUid: string | null;
  role: 'owner' | 'member';
  memberInfo: any | null;
  loading: boolean;
  error: string | null;
}

const WorkspaceContext = createContext<WorkspaceState | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WorkspaceState>({
    ownerUid: null,
    role: 'owner',
    memberInfo: null,
    loading: true,
    error: null,
  });

  const resolveWorkspace = async (user: AdminUser | null) => {
    if (!user) {
      setState(prev => ({ ...prev, ownerUid: null, loading: false }));
      return;
    }

    const { db } = initializeFirebaseInstances();
    if (!db) {
      // Local storage mode - always owner
      setState({ ownerUid: user.uid || null, role: 'owner', memberInfo: null, loading: false, error: null });
      return;
    }

    try {
      const email = user.email.toLowerCase();
      const db = initializeFirebaseInstances().db;

      if (db) {
        // Auto-create config/team if it doesn't exist
        const teamDocRef = doc(db, 'config', 'team');
        const teamSnap = await getDoc(teamDocRef);
        if (!teamSnap.exists()) {
          try {
            await setDoc(teamDocRef, {
              adminEmail: email,
              members: [],
              createdAt: new Date().toISOString()
            });
          } catch (e) {
            console.error('Failed to auto-create config/team:', e);
          }
        }
      }

      const memberDocRef = doc(db!, 'teamMembers', email);
      const memberSnap = await getDoc(memberDocRef);

      if (memberSnap.exists()) {
        const data = memberSnap.data();
        if (data.active === true) {
          setState({
            ownerUid: data.ownerUid,
            role: 'member',
            memberInfo: data,
            loading: false,
            error: null,
          });
          return;
        } else if (data.active === false) {
          setState({
            ownerUid: null,
            role: 'member',
            memberInfo: data,
            loading: false,
            error: 'আপনার অ্যাক্সেস সাময়িকভাবে বন্ধ করা হয়েছে। মালিকের সাথে যোগাযোগ করুন।',
          });
          return;
        }
      }

      // No team membership or inactive - treat as owner of their own workspace
      setState({
        ownerUid: user.uid || null,
        role: 'owner',
        memberInfo: null,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Workspace resolution error:', err);
      // Fallback to own workspace on error (ensures user always sees their own leads)
      setState({
        ownerUid: user?.uid || null,
        role: 'owner',
        memberInfo: null,
        loading: false,
        error: null,
      });
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
