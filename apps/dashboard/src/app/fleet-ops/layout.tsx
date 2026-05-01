import { FleetOpsSidebar } from '@/components/FleetOpsSidebar';

export const metadata = {
  title: 'VoltLedger — Fleet Ops',
  description: 'Fleet readiness and battery health for EV operators',
};

export default function FleetOpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <FleetOpsSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
