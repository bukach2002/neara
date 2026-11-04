import { AppShell } from '../../components/neara/app-shell';
import { TenantClient } from './TenantClient';

export default function TenantPage({ params }: { params: { slug: string } }) {
  return (
    <AppShell tabbar={false} sticky>
      <TenantClient slug={params.slug} />
    </AppShell>
  );
}
