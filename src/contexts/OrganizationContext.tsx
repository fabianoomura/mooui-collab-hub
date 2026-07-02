import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  color: string;
  logo_url?: string | null;
  role: string; // user's role in this org
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization) => void;
  isLoading: boolean;
  isAdmin: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ['organizations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('organization_id, role, status, access_expires_at')
        .eq('user_id', user.id);
      if (error) throw error;
      const activeMemberships = (memberships ?? []).filter((membership: any) => {
        const status = membership.status ?? 'active';
        if (status !== 'active') return false;
        if (!membership.access_expires_at) return true;
        return new Date(membership.access_expires_at).getTime() > Date.now();
      });
      if (!activeMemberships.length) return [];

      const orgIds = activeMemberships.map(m => m.organization_id);
      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds);
      if (orgError) throw orgError;

      const roleMap = new Map(activeMemberships.map(m => [m.organization_id, m.role]));
      return (orgs || []).map(org => ({
        ...org,
        role: roleMap.get(org.id) || 'member',
      })) as Organization[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (organizations.length === 0) {
      if (currentOrg) setCurrentOrgState(null);
      return;
    }
    if (currentOrg && organizations.some((org) => org.id === currentOrg.id)) return;
    const saved = localStorage.getItem('mooui_current_org');
    const found = saved ? organizations.find(o => o.id === saved) : null;
    setCurrentOrgState(found || organizations[0]);
  }, [organizations, currentOrg]);

  const setCurrentOrg = (org: Organization) => {
    setCurrentOrgState(org);
    localStorage.setItem('mooui_current_org', org.id);
  };

  const isAdmin = currentOrg?.role === 'admin';

  return (
    <OrganizationContext.Provider value={{ organizations, currentOrg, setCurrentOrg, isLoading, isAdmin }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useOrganization must be used within OrganizationProvider');
  return context;
}
