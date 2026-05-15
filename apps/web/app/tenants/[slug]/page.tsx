import { TenantClient } from './TenantClient';

export default function TenantPage({ params }: { params: { slug: string } }) {
  return <TenantClient slug={params.slug} />;
}
