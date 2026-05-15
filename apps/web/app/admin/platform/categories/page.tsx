import { AdminShell } from '../../components/AdminShell';
import { CategoriesClient } from './CategoriesClient';

export default function CategoriesPage() {
  return (
    <AdminShell>
      <CategoriesClient />
    </AdminShell>
  );
}
