import {AuthGate} from '@/components/auth-gate';
import {AppShell} from '@/components/app-shell';

export default function ProtectedLandingPage() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}
