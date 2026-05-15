import { ResetPasswordClient } from './ResetPasswordClient';

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  return <ResetPasswordClient token={searchParams.token ?? ''} />;
}
